import Link from "next/link";
import { requireAdmin } from "../../../../lib/auth";
import { getSettings } from "../../../../lib/settings";
import { todaySAST } from "../../../../lib/dates";
import type { Product } from "../../../../lib/types";
import ManualOrderForm from "./ManualOrderForm";

export default async function NewOrderPage() {
  const { db } = await requireAdmin();
  const settings = await getSettings();
  const { data } = await db.from("products").select("*").eq("type", "single").order("created_at", { ascending: true });
  return (
    <div className="space-y-4">
      <Link href="/admin/orders" className="text-sm text-gray-500 underline">&larr; Back to orders</Link>
      <h1 className="font-serif text-3xl">Add an order</h1>
      <p className="text-sm text-gray-600">For orders taken outside the website. Nothing is emailed to the customer, and the notice, daily limit and blackout rules are skipped.</p>
      <ManualOrderForm products={(data ?? []) as Product[]} prices={settings.prices} slots={settings.pickup_slots} today={todaySAST()} />
    </div>
  );
}
