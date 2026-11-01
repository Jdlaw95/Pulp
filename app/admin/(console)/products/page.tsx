import { requireAdmin } from "../../../lib/auth";
import type { Product } from "../../../lib/types";
import ProductsManager from "./ProductsManager";

export default async function ProductsPage() {
  const { db } = await requireAdmin();
  const { data } = await db.from("products").select("*").eq("type", "single").order("created_at", { ascending: true });
  return (
    <div className="space-y-4">
      <h1 className="font-serif text-3xl">Products</h1>
      <p className="text-sm text-gray-600">Set each flavour price, and whether it is sold each or as a pack (for example R28 for 2). Box prices are under Settings.</p>
      <ProductsManager products={(data ?? []) as Product[]} />
    </div>
  );
}
