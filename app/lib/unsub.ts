import { createHmac, timingSafeEqual } from "node:crypto";

function secret() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.GMAIL_APP_PASSWORD || "";
}

export function unsubToken(email: string): string {
  return createHmac("sha256", secret()).update(email.trim().toLowerCase()).digest("hex").slice(0, 32);
}

export function checkUnsubToken(email: string, token: string): boolean {
  if (!secret() || !token) return false;
  const a = Buffer.from(unsubToken(email));
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function unsubUrl(email: string): string | null {
  const base = process.env.NEXT_PUBLIC_SITE_URL;
  if (!base || !secret()) return null;
  return `${base.replace(/\/$/, "")}/unsubscribe?e=${encodeURIComponent(email)}&t=${unsubToken(email)}`;
}
