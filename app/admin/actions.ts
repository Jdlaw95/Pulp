"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin, userDb } from "../lib/auth";
import { STATUSES } from "../lib/types";
import { isValidISODate } from "../lib/dates";
import { BOX_PRODUCT_IDS, orderTotal, packSize, type OrderMode } from "../lib/pricing";
import { getSettings } from "../lib/settings";
import { groupCustomers, validEmail } from "../lib/customers";
import { mailTransport, sendMailerEmail } from "../lib/email";
import { unsubUrl } from "../lib/unsub";
import type { Order } from "../lib/types";

type Result = { ok: boolean; message?: string };

const refresh = () => revalidatePath("/admin", "layout");

const PACK_HINT = "Selling as a pack needs one more database column. Run supabase/pulp-upgrade.sql in the Supabase SQL editor, then try again.";

function checkPrice(price: number, packSize: number): string | null {
  if (!Number.isFinite(price) || price <= 0 || price > 10000) return "Price must be more than R0.";
  if (!Number.isInteger(packSize) || packSize < 1 || packSize > 12) return "Pack size must be a whole number from 1 to 12.";
  return null;
}

export async function logout() {
  const db = await userDb();
  await db.auth.signOut();
  redirect("/admin/login");
}

export async function setOrderStatus(orderId: string, status: string): Promise<Result> {
  const { db } = await requireAdmin();
  if (!STATUSES.some((s) => s.value === status)) return { ok: false, message: "Unknown status" };
  const { error } = await db.from("orders").update({ status }).eq("id", orderId);
  if (error) return { ok: false, message: error.message };
  refresh();
  return { ok: true };
}

// ---- Products ----------------------------------------------------------

export async function toggleProduct(id: string, active: boolean): Promise<Result> {
  const { db } = await requireAdmin();
  const { error } = await db.from("products").update({ active }).eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/");
  refresh();
  return { ok: true };
}

export async function updateProduct(id: string, name: string, description: string, price: number, packSize: number): Promise<Result> {
  const { db } = await requireAdmin();
  if (!name.trim()) return { ok: false, message: "Name is required" };
  const priceCheck = checkPrice(price, packSize);
  if (priceCheck) return { ok: false, message: priceCheck };
  const base = { name: name.trim(), description: description.trim(), price_zar: price };
  let { error } = await db.from("products").update({ ...base, pack_size: packSize }).eq("id", id);
  if (error && /pack_size/i.test(error.message)) {
    if (packSize > 1) return { ok: false, message: PACK_HINT };
    ({ error } = await db.from("products").update(base).eq("id", id));
  }
  if (error) return { ok: false, message: error.message };
  revalidatePath("/");
  refresh();
  return { ok: true };
}

/** Photos upload straight from the browser to storage using a one-off signed URL, so large phone photos work. */
export async function getUploadUrl(ext: string): Promise<{ ok: true; path: string; token: string; publicUrl: string } | { ok: false; message: string }> {
  const { db } = await requireAdmin();
  const safeExt = ext.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "jpg";
  const path = `${crypto.randomUUID()}.${safeExt}`;
  const { data, error } = await db.storage.from("product-images").createSignedUploadUrl(path);
  if (error || !data) return { ok: false, message: error?.message ?? "Could not start upload" };
  const { data: pub } = db.storage.from("product-images").getPublicUrl(path);
  return { ok: true, path, token: data.token, publicUrl: pub.publicUrl };
}

export async function setProductImage(id: string, imageUrl: string): Promise<Result> {
  const { db } = await requireAdmin();
  const { error } = await db.from("products").update({ image_url: imageUrl }).eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/");
  refresh();
  return { ok: true };
}

export async function createProduct(name: string, description: string, imageUrl: string, price: number, packSize: number): Promise<Result> {
  const { db } = await requireAdmin();
  if (!name.trim()) return { ok: false, message: "Name is required" };
  const priceCheck = checkPrice(price, packSize);
  if (priceCheck) return { ok: false, message: priceCheck };
  const row = { name: name.trim(), description: description.trim(), price_zar: price, type: "single", image_url: imageUrl, active: true };
  let { error } = await db.from("products").insert({ ...row, pack_size: packSize });
  if (error && /pack_size/i.test(error.message)) {
    if (packSize > 1) return { ok: false, message: PACK_HINT };
    ({ error } = await db.from("products").insert(row));
  }
  if (error) return { ok: false, message: error.message };
  revalidatePath("/");
  refresh();
  return { ok: true };
}

// ---- Settings ----------------------------------------------------------

const int = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim();
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n) : null;
};

export async function saveSettings(_prev: Result | null, formData: FormData): Promise<Result> {
  const { db } = await requireAdmin();

  const trio = int(formData.get("price_trio"));
  const box6 = int(formData.get("price_box6"));
  const deposit = int(formData.get("deposit_percent"));
  const notice = int(formData.get("min_notice_days"));
  const capacity = int(formData.get("daily_capacity"));
  const cutoff = int(formData.get("cutoff_hour"));

  if (trio === null || box6 === null || trio < 1 || box6 < 1) return { ok: false, message: "Prices must be whole numbers above 0." };
  if (deposit === null || deposit < 0 || deposit > 100) return { ok: false, message: "Deposit must be between 0 and 100." };
  if (notice === null || notice < 0 || notice > 30) return { ok: false, message: "Notice must be between 0 and 30 days." };
  if (capacity !== null && capacity < 1) return { ok: false, message: "Daily limit must be 1 or more, or left empty for no limit." };
  if (cutoff !== null && (cutoff < 0 || cutoff > 23)) return { ok: false, message: "Cut-off hour must be 0 to 23, or left empty." };

  const slots = String(formData.get("pickup_slots") ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 10);
  if (slots.length === 0) return { ok: false, message: "Add at least one collection time." };

  const { error } = await db.from("shop_settings").upsert({
    id: 1,
    orders_open: formData.get("orders_open") === "on",
    price_trio: trio,
    price_box6: box6,
    deposit_percent: deposit,
    min_notice_days: notice,
    daily_capacity: capacity,
    cutoff_hour: cutoff,
    pickup_slots: slots,
    updated_at: new Date().toISOString(),
  });
  if (error) {
    const hint = /relation|does not exist|schema cache/i.test(error.message) ? " Run supabase/pulp-upgrade.sql in the Supabase SQL editor first." : "";
    return { ok: false, message: error.message + hint };
  }
  revalidatePath("/");
  refresh();
  return { ok: true, message: "Saved" };
}

export async function addBlackout(date: string, reason: string): Promise<Result> {
  const { db } = await requireAdmin();
  if (!isValidISODate(date)) return { ok: false, message: "Pick a valid date" };
  const { error } = await db.from("blackout_dates").upsert({ date, reason: reason.trim() || null });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/");
  refresh();
  return { ok: true };
}

export async function removeBlackout(date: string): Promise<Result> {
  const { db } = await requireAdmin();
  const { error } = await db.from("blackout_dates").delete().eq("date", date);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/");
  refresh();
  return { ok: true };
}

// ---- Manual orders, delete, mailer -------------------------------------

const RLS_HINT = " If this says permission denied or row-level security, run supabase/pulp-upgrade.sql in the Supabase SQL editor.";

export type ManualOrderInput = {
  name: string;
  phone: string;
  email: string;
  date: string;
  slot: string;
  mode: OrderMode;
  items: Record<string, number>; // product id -> picks
  total: number | null; // null = work it out from current prices
  status: string;
  giftNote: string;
  marketingConsent: boolean;
};

/** For orders taken outside the website. No emails are sent and the notice, capacity and blackout rules are skipped. */
export async function createManualOrder(input: ManualOrderInput): Promise<Result & { orderRef?: string }> {
  const { db } = await requireAdmin();
  const name = input.name.trim();
  const phone = input.phone.trim();
  const email = input.email.trim().toLowerCase();
  if (name.length < 2) return { ok: false, message: "Enter the customer's name." };
  if (phone.replace(/\D/g, "").length < 9 && !validEmail(email)) return { ok: false, message: "Enter a phone number or an email so you can find them again." };
  if (email && !validEmail(email)) return { ok: false, message: "That email address does not look right." };
  if (!isValidISODate(input.date)) return { ok: false, message: "Pick the collection date." };
  if (!STATUSES.some((s) => s.value === input.status)) return { ok: false, message: "Unknown status." };
  if (!["Trio", "Box of 6", "Custom"].includes(input.mode)) return { ok: false, message: "Unknown order type." };

  const { data: menu, error: menuErr } = await db.from("products").select("id, name, price_zar, pack_size").eq("type", "single");
  let products = menu as { id: string; name: string; price_zar: number; pack_size?: number | null }[] | null;
  if (menuErr) {
    const r = await db.from("products").select("id, name, price_zar").eq("type", "single");
    products = r.data as typeof products;
  }
  if (!products) return { ok: false, message: "Could not load the menu." };

  const units: Record<string, number> = {};
  for (const [id, q] of Object.entries(input.items)) {
    const qty = Math.floor(Number(q));
    if (!qty || qty < 0) continue;
    if (qty > 60 || !products.some((p) => p.id === id)) return { ok: false, message: "Something in the items looks off. Refresh and try again." };
    units[id] = qty;
  }
  if (Object.keys(units).length === 0) return { ok: false, message: "Choose at least one flavour." };

  const settings = await getSettings();
  const calc = orderTotal(input.mode, units, products, settings.prices);
  const total = input.total === null ? calc.total : Number(input.total);
  if (!Number.isFinite(total) || total < 0 || total > 100000) return { ok: false, message: "Total must be a number of 0 or more." };

  const breakdown: Record<string, number> = {};
  for (const p of products) if (units[p.id]) breakdown[p.name] = units[p.id] * packSize(p);

  const base = { customer_name: name, customer_email: email, customer_phone: phone, requested_date: input.date, total_zar: total, status: input.status };
  const extras = { box_type: input.mode, pickup_slot: input.slot.trim() || null, gift_note: input.giftNote.trim() || null, marketing_consent: input.marketingConsent, consent_terms_at: input.marketingConsent ? new Date().toISOString() : null };
  let res = await db.from("orders").insert({ ...base, ...extras }).select("id, order_ref").single();
  if (res.error && /column|schema cache/i.test(res.error.message)) res = await db.from("orders").insert(base).select("id, order_ref").single();
  if (res.error || !res.data) return { ok: false, message: (res.error?.message ?? "Could not save the order.") + RLS_HINT };
  const order = res.data as { id: string; order_ref: string };

  const { error: itemErr } = await db.from("order_items").insert({
    order_id: order.id,
    product_id: input.mode === "Trio" ? BOX_PRODUCT_IDS.Trio : BOX_PRODUCT_IDS["Box of 6"],
    quantity: 1,
    unit_price_zar: total,
    flavor_breakdown: breakdown,
  });
  if (itemErr) {
    await db.from("orders").delete().eq("id", order.id); // do not leave an order with no items behind
    return { ok: false, message: itemErr.message + RLS_HINT };
  }
  revalidatePath("/admin", "layout");
  return { ok: true, orderRef: order.order_ref };
}

export async function deleteOrder(orderId: string): Promise<Result> {
  const { db } = await requireAdmin();
  const { error: itemErr } = await db.from("order_items").delete().eq("order_id", orderId);
  if (itemErr) return { ok: false, message: itemErr.message + RLS_HINT };
  const { data, error } = await db.from("orders").delete().eq("id", orderId).select("id");
  if (error) return { ok: false, message: error.message + RLS_HINT };
  if (!data || data.length === 0) return { ok: false, message: "Nothing was deleted." + RLS_HINT };
  refresh();
  return { ok: true };
}

async function consentingRecipients(db: Awaited<ReturnType<typeof requireAdmin>>["db"]) {
  const { data } = await db.from("orders").select("id, customer_name, customer_email, customer_phone, total_zar, status, created_at, marketing_consent").limit(5000);
  return groupCustomers((data ?? []) as Order[]).filter((c) => c.consent && validEmail(c.email));
}

/** Sends to everyone who agreed to marketing. With testOnly it sends one copy to the admin's own address instead. */
export async function sendMailer(subject: string, body: string, testOnly: boolean): Promise<Result & { sent?: number; failed?: number }> {
  const { db, user } = await requireAdmin();
  if (subject.trim().length < 3) return { ok: false, message: "Add a subject." };
  if (body.trim().length < 10) return { ok: false, message: "Write a message first." };
  if (subject.length > 150 || body.length > 5000) return { ok: false, message: "That is too long." };
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) return { ok: false, message: "Email is not set up. Add GMAIL_USER and GMAIL_APP_PASSWORD to the environment." };

  const transporter = mailTransport();
  if (testOnly) {
    const to = user.email ?? process.env.GMAIL_USER;
    try {
      await sendMailerEmail({ to, subject: `[Test] ${subject.trim()}`, body, unsubscribeUrl: unsubUrl(to) }, transporter);
      return { ok: true, sent: 1, failed: 0, message: `Test sent to ${to}.` };
    } catch (e) {
      console.error("mailer test failed:", e);
      return { ok: false, message: "The test email could not be sent. Check the Gmail details." };
    }
  }

  const list = (await consentingRecipients(db)).slice(0, 400); // stays well inside Gmail's daily cap
  if (list.length === 0) return { ok: false, message: "Nobody has agreed to marketing yet." };
  let sent = 0;
  let failed = 0;
  for (const c of list) {
    try {
      await sendMailerEmail({ to: c.email, subject: subject.trim(), body, unsubscribeUrl: unsubUrl(c.email) }, transporter);
      sent++;
    } catch (e) {
      failed++;
      console.error("mailer failed for one recipient:", e instanceof Error ? e.message : e);
    }
  }
  return { ok: sent > 0, sent, failed, message: `Sent to ${sent} ${sent === 1 ? "person" : "people"}${failed ? `, ${failed} failed` : ""}.` };
}
