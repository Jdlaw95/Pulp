import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const opts = { auth: { persistSession: false, autoRefreshToken: false } } as const;

/** Anonymous, read-mostly client for public data (menu, settings). Server or browser. */
export function publicDb() {
  return createClient(url, anon, opts);
}

/**
 * Server-only client for handling customer orders. Uses the service-role key when it is set
 * (add SUPABASE_SERVICE_ROLE_KEY to .env.local and Vercel), otherwise falls back to the anon key
 * so the site keeps working. NEVER import this from a client component.
 */
export function serverDb() {
  return createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY || anon, opts);
}

export const hasServiceKey = () => Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
