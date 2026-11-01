export type Product = {
  id: string;
  name: string;
  description: string;
  price_zar: number;
  image_url: string;
  type: string;
  active?: boolean;
  pack_size?: number | null; // pieces per sale; 1 = sold singly
};

export type OrderItem = {
  flavor_breakdown: Record<string, number> | null;
  unit_price_zar: number;
};

export type Order = {
  id: string;
  order_ref: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  requested_date: string;
  total_zar: number;
  status: string;
  created_at: string;
  box_type?: string | null;
  pickup_slot?: string | null;
  gift_note?: string | null;
  marketing_consent?: boolean | null;
  order_items: OrderItem[];
};

export const STATUSES = [
  { value: "pending_payment", label: "Awaiting deposit" },
  { value: "confirmed", label: "Confirmed" },
  { value: "ready", label: "Ready" },
  { value: "collected", label: "Collected" },
  { value: "cancelled", label: "Cancelled" },
] as const;

export const NEXT_STATUS: Record<string, { value: string; label: string } | undefined> = {
  pending_payment: { value: "confirmed", label: "Mark deposit paid" },
  confirmed: { value: "ready", label: "Mark ready" },
  ready: { value: "collected", label: "Mark collected" },
};

export function statusLabel(value: string) {
  return STATUSES.find((s) => s.value === value)?.label ?? value;
}

export function orderBreakdown(o: Order): Record<string, number> {
  const out: Record<string, number> = {};
  for (const item of o.order_items ?? []) {
    for (const [name, qty] of Object.entries(item.flavor_breakdown ?? {})) {
      if (qty > 0) out[name] = (out[name] ?? 0) + qty;
    }
  }
  return out;
}

export function orderPieces(o: Order): number {
  return Object.values(orderBreakdown(o)).reduce((a, b) => a + b, 0);
}

export function formatBreakdown(o: Order): string {
  const b = orderBreakdown(o);
  const parts = Object.entries(b).map(([name, qty]) => `${qty}x ${name}`);
  return parts.length ? parts.join(", ") : "No flavours recorded";
}

export const rand = (n: number) =>
  "R" + (Number.isInteger(n) ? n.toString() : n.toFixed(2));
