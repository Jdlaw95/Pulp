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
import { parsePhone, parseSocial, PLATFORMS } from "../lib/contact";
import { clearUnlocked, hashCode, isUnlocked, setUnlocked, verifyCode } from "../lib/pin";

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

// ---- Production board ---------------------------------------------------

const BOARD_HINT = "The production board needs one new table. Run supabase/production-board.sql in the Supabase SQL editor, then try again.";

/** Saves how many of a flavour have been made for a collection date. Called on every tick, so no page revalidation. */
export async function setProductionMade(date: string, flavour: string, made: number): Promise<Result> {
  const { db } = await requireAdmin();
  if (!isValidISODate(date)) return { ok: false, message: "Pick a valid date" };
  const name = String(flavour ?? "").trim().slice(0, 80);
  if (!name) return { ok: false, message: "Unknown flavour" };
  if (!Number.isInteger(made) || made < 0 || made > 500) return { ok: false, message: "That number looks off" };
  const before = await db.from("production_progress").select("made").eq("date", date).eq("flavour", name).maybeSingle();
  const prev = Number((before.data as { made?: number } | null)?.made) || 0;
  const { error } = await db
    .from("production_progress")
    .upsert({ date, flavour: name, made, updated_at: new Date().toISOString() }, { onConflict: "date,flavour" });
  if (error) return { ok: false, message: /relation|schema cache|does not exist/i.test(error.message) ? BOARD_HINT : error.message };

  // Dipping always comes from the freezer: every tick takes one filled piece out, every untick puts it back.
  const dipped = made - prev;
  if (dipped !== 0) {
    const move = await db.from("stock_moves").insert({
      flavour: name,
      stage: "filled",
      change: -dipped,
      reason: dipped > 0 ? `Dipped for ${date}` : `Unticked on board for ${date}`,
    });
    if (move.error && !/relation|schema cache|does not exist/i.test(move.error.message)) console.error("Freezer move failed:", move.error.message);
  }
  return { ok: true };
}

// ---- Freezer -------------------------------------------------------------

const FREEZER_HINT = "The freezer needs new tables. Run supabase/freezer.sql in the Supabase SQL editor, then try again.";
const freezerError = (m: string) => (/relation|schema cache|does not exist/i.test(m) ? FREEZER_HINT : m);
const cleanFlavour = (f: unknown) => String(f ?? "").trim().slice(0, 80);
const okCount = (n: number, min: number, max: number) => Number.isInteger(n) && n >= min && n <= max;

type StockResult = Result & { ids?: number[] };

/** Manual stock change: a compote session (+) or a correction (+ or -) on either stage. */
export async function adjustStock(flavour: string, stage: string, change: number, reason: string): Promise<StockResult> {
  const { db } = await requireAdmin();
  const name = cleanFlavour(flavour);
  if (!name) return { ok: false, message: "Unknown flavour" };
  if (stage !== "compote" && stage !== "filled") return { ok: false, message: "Unknown stage" };
  if (!okCount(change, -500, 500) || change === 0) return { ok: false, message: "That number looks off" };
  const why = String(reason ?? "").trim().slice(0, 120) || "Correction";
  const { data, error } = await db.from("stock_moves").insert({ flavour: name, stage, change, reason: why }).select("id");
  if (error) return { ok: false, message: freezerError(error.message) };
  return { ok: true, ids: (data ?? []).map((r: { id: number }) => r.id) };
}

/** Adding mousse moves pieces from "compote only" to "ready to dip" in one go. */
export async function addMousse(flavour: string, pieces: number): Promise<StockResult> {
  const { db } = await requireAdmin();
  const name = cleanFlavour(flavour);
  if (!name) return { ok: false, message: "Unknown flavour" };
  if (!okCount(pieces, 1, 500)) return { ok: false, message: "Choose between 1 and 500 pieces" };

  const level = await db.from("stock_levels").select("qty").eq("flavour", name).eq("stage", "compote").maybeSingle();
  if (level.error) return { ok: false, message: freezerError(level.error.message) };
  const compote = Number((level.data as { qty?: number } | null)?.qty) || 0;
  if (compote < pieces) {
    return { ok: false, message: `Only ${Math.max(0, compote)} ${name} compote is logged, so mousse can't go on ${pieces}. Log the compote first, or count the freezer.` };
  }

  const label = `Added mousse to ${pieces}`;
  const { data, error } = await db
    .from("stock_moves")
    .insert([
      { flavour: name, stage: "compote", change: -pieces, reason: label },
      { flavour: name, stage: "filled", change: pieces, reason: label },
    ])
    .select("id");
  if (error) return { ok: false, message: freezerError(error.message) };
  return { ok: true, ids: (data ?? []).map((r: { id: number }) => r.id) };
}

/** Stocktake: sets both freezer numbers to what was counted, logging the difference. */
export async function countFreezer(flavour: string, compote: number, ready: number): Promise<StockResult> {
  const { db } = await requireAdmin();
  const name = cleanFlavour(flavour);
  if (!name) return { ok: false, message: "Unknown flavour" };
  if (!okCount(compote, 0, 500) || !okCount(ready, 0, 500)) return { ok: false, message: "Counts must be whole numbers from 0 to 500" };

  const levels = await db.from("stock_levels").select("stage, qty").eq("flavour", name);
  if (levels.error) return { ok: false, message: freezerError(levels.error.message) };
  const now: Record<string, number> = { compote: 0, filled: 0 };
  for (const l of (levels.data ?? []) as { stage: string; qty: number }[]) now[l.stage] = Number(l.qty) || 0;

  const rows = [
    { flavour: name, stage: "compote", change: compote - now.compote, reason: "Freezer count" },
    { flavour: name, stage: "filled", change: ready - now.filled, reason: "Freezer count" },
  ].filter((r) => r.change !== 0);
  if (!rows.length) return { ok: true };
  const { data, error } = await db.from("stock_moves").insert(rows).select("id");
  if (error) return { ok: false, message: freezerError(error.message) };
  return { ok: true, ids: (data ?? []).map((r: { id: number }) => r.id) };
}

/** Undo the last freezer action by removing the rows it added. */
export async function undoStock(ids: number[]): Promise<Result> {
  const { db } = await requireAdmin();
  const clean = (Array.isArray(ids) ? ids : []).filter((n) => Number.isInteger(n) && n > 0).slice(0, 10);
  if (!clean.length) return { ok: false, message: "Nothing to undo" };
  const { error } = await db.from("stock_moves").delete().in("id", clean);
  if (error) return { ok: false, message: freezerError(error.message) };
  return { ok: true };
}

export async function saveStockSetting(flavour: string, mouldSize: number, parCompote: number, parFilled: number): Promise<Result> {
  const { db } = await requireAdmin();
  const name = cleanFlavour(flavour);
  if (!name) return { ok: false, message: "Unknown flavour" };
  if (!okCount(mouldSize, 1, 60)) return { ok: false, message: "A mould holds 1 to 60 pieces" };
  if (!okCount(parCompote, 0, 500) || !okCount(parFilled, 0, 500)) return { ok: false, message: "\"Keep at least\" must be 0 to 500" };
  const { error } = await db
    .from("stock_settings")
    .upsert({ flavour: name, mould_size: mouldSize, par_compote: parCompote, par_filled: parFilled }, { onConflict: "flavour" });
  if (error) return { ok: false, message: freezerError(error.message) };
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

type Built =
  | { ok: false; message: string }
  | { ok: true; base: Record<string, unknown>; extras: Record<string, unknown>; breakdown: Record<string, number>; total: number; productId: string };

/** Checks the form and works out what to store. Shared by "add order" and "edit order". Notice, capacity and blackout rules are skipped. */
async function buildOrder(db: Db, input: ManualOrderInput): Promise<Built> {
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

  return {
    ok: true,
    total,
    breakdown,
    productId: input.mode === "Trio" ? BOX_PRODUCT_IDS.Trio : BOX_PRODUCT_IDS["Box of 6"],
    base: { customer_name: name, customer_email: email, customer_phone: phone, requested_date: input.date, total_zar: total, status: input.status },
    extras: { box_type: input.mode, pickup_slot: input.slot.trim() || null, gift_note: input.giftNote.trim() || null, marketing_consent: input.marketingConsent },
  };
}

/** For orders taken outside the website. No emails are sent. */
export async function createManualOrder(input: ManualOrderInput): Promise<Result & { orderRef?: string }> {
  const { db } = await requireAdmin();
  const built = await buildOrder(db, input);
  if (!built.ok) return built;

  const consentStamp = input.marketingConsent ? { consent_terms_at: new Date().toISOString() } : {};
  let res = await db.from("orders").insert({ ...built.base, ...built.extras, ...consentStamp }).select("id, order_ref").single();
  if (res.error && /column|schema cache/i.test(res.error.message)) res = await db.from("orders").insert(built.base).select("id, order_ref").single();
  if (res.error || !res.data) return { ok: false, message: (res.error?.message ?? "Could not save the order.") + RLS_HINT };
  const order = res.data as { id: string; order_ref: string };

  const { error: itemErr } = await db.from("order_items").insert({ order_id: order.id, product_id: built.productId, quantity: 1, unit_price_zar: built.total, flavor_breakdown: built.breakdown });
  if (itemErr) {
    await db.from("orders").delete().eq("id", order.id); // do not leave an order with no items behind
    return { ok: false, message: itemErr.message + RLS_HINT };
  }
  revalidatePath("/admin", "layout");
  return { ok: true, orderRef: order.order_ref };
}

/** Changes an existing order. The reference and the date it was placed stay as they were. No emails are sent. */
export async function updateOrder(orderId: string, input: ManualOrderInput): Promise<Result & { orderRef?: string }> {
  const { db } = await requireAdmin();
  const built = await buildOrder(db, input);
  if (!built.ok) return built;

  let res = await db.from("orders").update({ ...built.base, ...built.extras }).eq("id", orderId).select("id, order_ref");
  if (res.error && /column|schema cache/i.test(res.error.message)) res = await db.from("orders").update(built.base).eq("id", orderId).select("id, order_ref");
  if (res.error) return { ok: false, message: res.error.message + RLS_HINT };
  const row = (res.data ?? [])[0] as { id: string; order_ref: string } | undefined;
  if (!row) return { ok: false, message: "That order no longer exists." };

  const item = { product_id: built.productId, quantity: 1, unit_price_zar: built.total, flavor_breakdown: built.breakdown };
  const upd = await db.from("order_items").update(item).eq("order_id", orderId).select("id");
  if (upd.error) return { ok: false, message: upd.error.message + RLS_HINT };
  if (!upd.data || upd.data.length === 0) {
    const ins = await db.from("order_items").insert({ order_id: orderId, ...item });
    if (ins.error) return { ok: false, message: ins.error.message + RLS_HINT };
  }
  revalidatePath("/admin", "layout");
  return { ok: true, orderRef: row.order_ref };
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

// ---- Contact details (public) ------------------------------------------

export async function saveContact(_prev: Result | null, formData: FormData): Promise<Result> {
  const { db } = await requireAdmin();
  const phone = parsePhone(String(formData.get("whatsapp") ?? ""));
  if (!phone.ok) return { ok: false, message: phone.message };
  const row: Record<string, string | number> = { id: 1, whatsapp: phone.intl };
  for (const p of PLATFORMS) {
    const r = parseSocial(p.key, String(formData.get(p.key) ?? ""));
    if (!r.ok) return { ok: false, message: r.message };
    row[`social_${p.key}`] = r.url; // empty string = hidden on the site
  }
  const { error } = await db.from("shop_settings").upsert(row);
  if (error) {
    const hint = /column|schema cache|relation|does not exist/i.test(error.message) ? " Run supabase/pulp-upgrade.sql in the Supabase SQL editor first." : "";
    return { ok: false, message: error.message + hint };
  }
  revalidatePath("/");
  revalidatePath("/privacy");
  refresh();
  return { ok: true, message: "Saved. The website is updated." };
}

// ---- Bank details (locked behind a code) -------------------------------

type Priv = { pin_hash: string | null; pin_failed: number | null; pin_locked_until: string | null };
type Db = Awaited<ReturnType<typeof requireAdmin>>["db"];

const SQL_HINT = " Run supabase/pulp-upgrade.sql in the Supabase SQL editor first.";
const MAX_TRIES = 5;

async function loadPriv(db: Db): Promise<{ row: Priv | null; error: string | null }> {
  const { data, error } = await db.from("shop_private").select("pin_hash, pin_failed, pin_locked_until").eq("id", 1).maybeSingle();
  return { row: (data as Priv | null) ?? null, error: error?.message ?? null };
}

/** Checks a code with a lockout after repeated wrong tries. Returns null when the code is right, otherwise a message. */
async function checkCode(db: Db, row: Priv | null, code: string): Promise<string | null> {
  if (!row?.pin_hash) return "No security code has been set yet.";
  const until = row.pin_locked_until ? new Date(row.pin_locked_until).getTime() : 0;
  if (until > Date.now()) return `Too many wrong tries. Try again in ${Math.ceil((until - Date.now()) / 60000)} minutes.`;
  if (verifyCode(code, row.pin_hash)) {
    if (row.pin_failed) await db.from("shop_private").update({ pin_failed: 0, pin_locked_until: null }).eq("id", 1);
    return null;
  }
  const failed = (row.pin_failed ?? 0) + 1;
  await db.from("shop_private").update({ pin_failed: failed >= MAX_TRIES ? 0 : failed, pin_locked_until: failed >= MAX_TRIES ? new Date(Date.now() + 15 * 60_000).toISOString() : null }).eq("id", 1);
  return failed >= MAX_TRIES ? "Too many wrong tries. Locked for 15 minutes." : `That code is not right. ${MAX_TRIES - failed} ${MAX_TRIES - failed === 1 ? "try" : "tries"} left.`;
}

export async function unlockBank(code: string): Promise<Result> {
  const { db, user } = await requireAdmin();
  const { row, error } = await loadPriv(db);
  if (error) return { ok: false, message: error + SQL_HINT };
  const bad = await checkCode(db, row, code);
  if (bad) return { ok: false, message: bad };
  await setUnlocked(row!.pin_hash!, user.id);
  refresh();
  return { ok: true };
}

export async function lockBank(): Promise<Result> {
  await requireAdmin();
  await clearUnlocked();
  refresh();
  return { ok: true };
}

/** First time: current is ignored. After that the current code must be right. */
export async function setBankCode(current: string, next: string): Promise<Result> {
  const { db, user } = await requireAdmin();
  if (next.length < 6 || next.length > 64) return { ok: false, message: "Your code needs at least 6 characters." };
  const { row, error } = await loadPriv(db);
  if (error) return { ok: false, message: error + SQL_HINT };
  if (row?.pin_hash) {
    const bad = await checkCode(db, row, current);
    if (bad) return { ok: false, message: bad };
  }
  const hash = hashCode(next);
  const { error: e2 } = await db.from("shop_private").upsert({ id: 1, pin_hash: hash, pin_failed: 0, pin_locked_until: null });
  if (e2) return { ok: false, message: e2.message + SQL_HINT };
  await setUnlocked(hash, user.id);
  refresh();
  return { ok: true };
}

export async function saveBank(input: { name: string; accountName: string; accountNumber: string; branchCode: string }): Promise<Result> {
  const { db, user } = await requireAdmin();
  const { row, error } = await loadPriv(db);
  if (error) return { ok: false, message: error + SQL_HINT };
  if (!(await isUnlocked(row?.pin_hash, user.id))) return { ok: false, message: "Locked. Enter your security code again." };
  const clean = (v: string, max: number) => v.trim().slice(0, max);
  const name = clean(input.name, 60);
  const accountName = clean(input.accountName, 80);
  const accountNumber = clean(input.accountNumber, 24);
  const branchCode = clean(input.branchCode, 12);
  if (!/^[0-9 -]{4,24}$/.test(accountNumber)) return { ok: false, message: "Account number should be digits only." };
  if (branchCode && !/^[0-9A-Za-z -]{2,12}$/.test(branchCode)) return { ok: false, message: "Branch code does not look right." };
  const { error: e2 } = await db.from("shop_private").upsert({ id: 1, bank_name: name, bank_account_name: accountName, bank_account_number: accountNumber, bank_branch_code: branchCode });
  if (e2) return { ok: false, message: e2.message + SQL_HINT };
  refresh();
  return { ok: true, message: "Saved. New orders will email these details." };
}
