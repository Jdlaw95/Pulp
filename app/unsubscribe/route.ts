import { serverDb, hasServiceKey } from "../lib/supabase";
import { checkUnsubToken } from "../lib/unsub";
import { SHOP } from "../lib/config";

export const dynamic = "force-dynamic";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const page = (inner: string) =>
  new Response(
    `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Unsubscribe</title><body style="font-family:Georgia,serif;background:#FDF6E9;color:#111;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0"><main style="max-width:420px;padding:24px;text-align:center"><h1 style="letter-spacing:4px">PULP</h1>${inner}</main>`,
    { headers: { "content-type": "text/html; charset=utf-8" } }
  );

export async function GET(req: Request) {
  const u = new URL(req.url);
  const e = (u.searchParams.get("e") ?? "").toLowerCase();
  const t = u.searchParams.get("t") ?? "";
  if (!checkUnsubToken(e, t)) return page("<p>This link is not valid. Message us on WhatsApp and we will remove you.</p>");
  return page(`<p>Stop emails to <strong>${esc(e)}</strong>?</p><form method="post"><input type="hidden" name="e" value="${esc(e)}"><input type="hidden" name="t" value="${esc(t)}"><button style="padding:12px 24px;border-radius:999px;border:1px solid #111;background:#111;color:#FDF6E9;font-size:14px;cursor:pointer">Unsubscribe me</button></form>`);
}

export async function POST(req: Request) {
  const form = await req.formData();
  const e = String(form.get("e") ?? "").toLowerCase();
  const t = String(form.get("t") ?? "");
  if (!checkUnsubToken(e, t)) return page("<p>This link is not valid.</p>");
  if (!hasServiceKey()) return page(`<p>We could not process that automatically. Please message us on WhatsApp and we will remove you.</p>`);
  const { error } = await serverDb().from("orders").update({ marketing_consent: false }).ilike("customer_email", e.replace(/[\\%_]/g, "\\$&"));
  if (error) {
    console.error("unsubscribe failed:", error.message);
    return page("<p>Something went wrong. Please message us on WhatsApp and we will remove you.</p>");
  }
  return page(`<p>Done. You will not get marketing emails from ${esc(SHOP.name)} any more. Order updates still reach you.</p>`);
}
