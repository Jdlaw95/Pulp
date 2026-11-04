import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "../../../../../lib/auth";
import { getSettings } from "../../../../../lib/settings";
import { todaySAST } from "../../../../../lib/dates";
import { packSize } from "../../../../../lib/pricing";
import { orderBreakdown, type Order, type Product } from "../../../../../lib/types";
import ManualOrderForm, { type OrderInitial } from "../../new/ManualOrderForm";
import type { OrderMode } from "../../../../../lib/pricing";

export default async function EditOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db } = await requireAdmin();
  const [{ data: orderRow }, { data: productRows }, settings] = await Promise.all([
    db.from("orders").select("*, order_items(flavor_breakdown, unit_price_zar)").eq("id", id).maybeSingle(),
    db.from("products").select("*").eq("type", "single").order("created_at", { ascending: true }),
    getSettings(),
  ]);
  if (!orderRow) notFound();
  const order = orderRow as Order;
  const products = (productRows ?? []) as Product[];

  // Stored amounts are pieces we make; the form works in picks, so a pack of 2 goes back to 1 pick.
  const items: Record<string, number> = {};
  const unmatched: string[] = [];
  for (const [name, pieces] of Object.entries(orderBreakdown(order))) {
    const p = products.find((x) => x.name === name);
    if (!p) { unmatched.push(`${pieces}x ${name}`); continue; }
    items[p.id] = Math.max(1, Math.round(pieces / packSize(p)));
  }

  const mode: OrderMode = order.box_type === "Trio" || order.box_type === "Box of 6" ? order.box_type : "Custom";
  const initial: OrderInitial = {
    orderId: order.id,
    orderRef: order.order_ref,
    name: order.customer_name,
    phone: order.customer_phone,
    email: order.customer_email ?? "",
    mode,
    items,
    total: Number(order.total_zar),
    date: order.requested_date,
    slot: order.pickup_slot ?? "",
    status: order.status,
    gift: order.gift_note ?? "",
    consent: Boolean(order.marketing_consent),
    unmatched,
  };

  return (
    <div className="space-y-4">
      <Link href="/admin/orders" className="text-sm text-gray-500 underline">&larr; Back to orders</Link>
      <h1 className="font-serif text-3xl">Edit order {order.order_ref}</h1>
      <p className="text-sm text-gray-600">Changes are saved straight away and nothing is sent to the customer. If you change the order, remember to tell them.</p>
      <ManualOrderForm products={products} prices={settings.prices} slots={settings.pickup_slots} today={todaySAST()} initial={initial} />
    </div>
  );
}
