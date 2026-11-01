"use server";

import { getSettings } from "./lib/settings";
import { serverDb, publicDb } from "./lib/supabase";
import { BOX_PRODUCT_IDS, boxSize, orderTotal, packSize, type OrderMode } from "./lib/pricing";
import { dateStatus, type DateStatus } from "./lib/availability";
import { fmtDate } from "./lib/dates";
import { sendOrderEmail } from "./lib/email";

export type OrderInput = {
  name: string;
  email: string;
  phone: string;
  date: string;
  pickupSlot: string;
  giftNote: string;
  mode: OrderMode;
  items: Record<string, number>; // product id -> units (pieces in a box, packs when picking singles)
  acceptedTerms: boolean;
  marketingConsent: boolean;
  website?: string; // honeypot, real people leave this empty
};

export type OrderResult =
  | { success: true; orderRef: string; deposit: number; total: number; emailSent: boolean }
  | { success: false; error: string };

/** Lets the order form check a date (blackouts, capacity, notice) before the customer submits. */
export async function checkDate(date: string, pieces: number): Promise<DateStatus> {
  return dateStatus(date, Math.max(0, Math.floor(pieces) || 0));
}

const clean = (s: unknown, max: number) => String(s ?? "").trim().replace(/\s+/g, " ").slice(0, max);

export async function submitOrder(input: OrderInput): Promise<OrderResult> {
  try {
    if (input.website) return { success: true, orderRef: "PULP-000", deposit: 0, total: 0, emailSent: false }; // bot trap

    const name = clean(input.name, 80);
    const email = clean(input.email, 120).toLowerCase();
    const phone = clean(input.phone, 25);
    const giftNote = clean(input.giftNote, 200);
    const date = clean(input.date, 10);

    if (name.length < 2) return { success: false, error: "Please enter your name." };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { success: false, error: "Please enter a valid email address." };
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 9 || digits.length > 15) return { success: false, error: "Please enter a valid WhatsApp number." };
    if (!input.acceptedTerms) return { success: false, error: "Please agree to the Privacy & Terms to continue." };
    if (!["Trio", "Box of 6", "Custom"].includes(input.mode)) return { success: false, error: "Please choose a box." };

    const settings = await getSettings();
    if (!settings.orders_open) return { success: false, error: "Orders are paused right now. Please check back soon." };

    const slot = settings.pickup_slots.includes(input.pickupSlot) ? input.pickupSlot : null;
    if (!slot) return { success: false, error: "Please choose a collection time." };

    // Re-check the menu on the server so quantities, names and prices cannot be faked.
    type MenuItem = { id: string; name: string; price_zar: number; pack_size?: number | null };
    const pdb = publicDb();
    let menuRes: { data: unknown[] | null; error: unknown } = await pdb.from("products").select("id, name, price_zar, pack_size").eq("active", true).eq("type", "single");
    if (menuRes.error) menuRes = await pdb.from("products").select("id, name, price_zar").eq("active", true).eq("type", "single"); // pack_size column not added yet
    if (menuRes.error || !menuRes.data) return { success: false, error: "We could not load the menu. Please try again." };
    const menu = menuRes.data as MenuItem[];
    const byId = new Map(menu.map((p) => [p.id, p]));

    const units: Record<string, number> = {};
    for (const [id, rawQty] of Object.entries(input.items ?? {})) {
      const qty = Number(rawQty);
      if (!qty) continue;
      if (!byId.has(id) || !Number.isInteger(qty) || qty < 0 || qty > 60) return { success: false, error: "Something in your order looks off. Please refresh and try again." };
      units[id] = qty;
    }

    // The price is always worked out here, never trusted from the browser.
    const { total, pieces, made } = orderTotal(input.mode, units, menu, settings.prices);
    const size = boxSize(input.mode);
    if (size !== null && pieces !== size) return { success: false, error: `Please select exactly ${size} flavours.` };
    if (pieces < 1 || pieces > 60) return { success: false, error: "Please select between 1 and 60 items." };
    const deposit = Math.round(total * settings.deposit_percent) / 100;

    // Production counts are what we physically make (a pack of 2 is 2 strawberries).
    const breakdown: Record<string, number> = {};
    for (const [id, qty] of Object.entries(units)) {
      const p = byId.get(id)!;
      breakdown[p.name] = qty * packSize(p);
    }

    const status = await dateStatus(date, made);
    if (!status.ok) return { success: false, error: status.reason ?? "That date is not available." };

    const db = serverDb();
    const base = {
      customer_name: name,
      customer_email: email,
      customer_phone: phone,
      requested_date: date,
      total_zar: total,
      status: "pending_payment",
    };
    const extras = {
      box_type: input.mode,
      pickup_slot: slot,
      gift_note: giftNote || null,
      consent_terms_at: new Date().toISOString(),
      marketing_consent: Boolean(input.marketingConsent),
    };

    let res = await db.from("orders").insert({ ...base, ...extras }).select("id, order_ref").single();
    if (res.error && /column|schema cache/i.test(res.error.message)) {
      // The new columns have not been added yet (see supabase/pulp-upgrade.sql). Keep taking orders.
      console.warn("Saving order without new columns; run supabase/pulp-upgrade.sql:", res.error.message);
      res = await db.from("orders").insert(base).select("id, order_ref").single();
    }
    if (res.error || !res.data) throw new Error(res.error?.message ?? "Could not save order");
    const order = res.data as { id: string; order_ref: string };

    const { error: itemError } = await db.from("order_items").insert({
      order_id: order.id,
      product_id: input.mode === "Trio" ? BOX_PRODUCT_IDS.Trio : BOX_PRODUCT_IDS["Box of 6"],
      quantity: 1,
      unit_price_zar: total,
      flavor_breakdown: breakdown,
    });
    if (itemError) throw new Error(itemError.message);

    let emailSent = true;
    try {
      const details = `${input.mode === "Custom" ? `Custom selection (${made})` : input.mode}: ${Object.entries(breakdown).map(([n, q]) => `${q}x ${n}`).join(", ")}`;
      await sendOrderEmail({
        to: email, name, ref: order.order_ref, dateLabel: fmtDate(date, { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
        slot, details, giftNote: giftNote || null, total, deposit, depositPercent: settings.deposit_percent,
      });
    } catch (e) {
      emailSent = false;
      console.error("Order email failed:", e);
    }

    return { success: true, orderRef: order.order_ref, deposit, total, emailSent };
  } catch (error) {
    console.error("Order submission failed:", error);
    return { success: false, error: "Something went wrong saving your order. Please try again or message us on WhatsApp." };
  }
}
