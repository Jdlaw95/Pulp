import type { Order } from "./types";

export type Customer = {
  key: string;
  name: string;
  email: string;
  phone: string;
  orders: number;
  spent: number;
  lastOrder: string; // ISO created_at of the newest order
  consent: boolean; // taken from the newest order, so a later opt-out wins
};

export const validEmail = (e: string | null | undefined) => /^\S+@\S+\.\S+$/.test((e ?? "").trim());

/** One row per person: matched by email, or by phone digits when there is no email. Cancelled orders do not count towards spend. */
export function groupCustomers(orders: Order[]): Customer[] {
  const map = new Map<string, Customer>();
  const sorted = [...orders].sort((a, b) => a.created_at.localeCompare(b.created_at)); // oldest first, so the newest overwrites
  for (const o of sorted) {
    const email = (o.customer_email ?? "").trim().toLowerCase();
    const digits = (o.customer_phone ?? "").replace(/\D/g, "");
    const key = validEmail(email) ? email : digits ? "tel:" + digits.slice(-9) : "id:" + o.id;
    const prev = map.get(key);
    map.set(key, {
      key,
      name: o.customer_name,
      email: validEmail(email) ? email : "",
      phone: o.customer_phone,
      orders: (prev?.orders ?? 0) + 1,
      spent: (prev?.spent ?? 0) + (o.status === "cancelled" ? 0 : Number(o.total_zar) || 0),
      lastOrder: o.created_at,
      consent: Boolean(o.marketing_consent),
    });
  }
  return [...map.values()].sort((a, b) => b.lastOrder.localeCompare(a.lastOrder));
}
