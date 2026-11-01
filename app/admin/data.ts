import type { SupabaseClient } from "@supabase/supabase-js";
import type { Order } from "../lib/types";

const SELECT = "*, order_items(flavor_breakdown, unit_price_zar)";

export async function loadOrders(
  db: SupabaseClient,
  f: { q?: string; status?: string; from?: string; to?: string; limit?: number } = {}
): Promise<Order[]> {
  let query = db.from("orders").select(SELECT).order("created_at", { ascending: false }).limit(f.limit ?? 1000);
  if (f.status && f.status !== "all") query = query.eq("status", f.status);
  if (f.from) query = query.gte("requested_date", f.from);
  if (f.to) query = query.lte("requested_date", f.to);
  if (f.q) {
    // Strip characters that have meaning inside a PostgREST filter string.
    const q = f.q.replace(/[,()%*\\]/g, " ").trim();
    if (q) query = query.or(`customer_name.ilike.%${q}%,order_ref.ilike.%${q}%,customer_phone.ilike.%${q}%,customer_email.ilike.%${q}%`);
  }
  const { data, error } = await query;
  if (error) {
    console.error("loadOrders:", error.message);
    return [];
  }
  return (data ?? []) as Order[];
}
