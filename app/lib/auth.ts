import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";

/** Supabase client that acts as the logged-in admin (row-level security applies). */
export async function userDb() {
  const store = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (list) => {
          try {
            list.forEach(({ name, value, options }) => store.set(name, value, options));
          } catch {
            // Called from a Server Component; proxy.ts refreshes the session instead.
          }
        },
      },
    }
  );
}

function allowlist(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isAllowed(email: string | undefined | null) {
  const list = allowlist();
  return list.length === 0 || list.includes((email ?? "").toLowerCase());
}

/** Every admin page and action calls this. Redirects to login unless a valid admin session exists. */
export const requireAdmin = cache(async () => {
  const db = await userDb();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect("/admin/login?reason=session");
  if (!isAllowed(user.email)) {
    console.error(`[admin] ${user.email} is signed in but is not listed in ADMIN_EMAILS`);
    redirect("/admin/login?reason=not-allowed");
  }
  return { db, user };
});
