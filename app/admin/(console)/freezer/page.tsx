import { requireAdmin } from "../../../lib/auth";
import { loadOrders } from "../../data";
import { addDays, todaySAST } from "../../../lib/dates";
import { DEFAULT_MOULD, DEMAND_DAYS, loadDemand, loadStock, type StockMove } from "../../../lib/stock";
import FreezerBoard, { type FreezerRow } from "./FreezerBoard";

export default async function FreezerPage() {
  const { db } = await requireAdmin();
  const today = todaySAST();

  const [products, orders, stock, log] = await Promise.all([
    db.from("products").select("name").eq("type", "single").eq("active", true).order("created_at", { ascending: true }),
    loadOrders(db, { from: today, to: addDays(today, DEMAND_DAYS - 1) }),
    loadStock(db),
    db.from("stock_moves").select("*").order("created_at", { ascending: false }).limit(20),
  ]);
  const demand = await loadDemand(db, orders);

  // Every active flavour, plus anything still holding stock or ordered (e.g. a flavour switched off this week).
  const names = [
    ...new Set([
      ...((products.data ?? []) as { name: string }[]).map((p) => p.name),
      ...Object.keys(stock.stock).filter((f) => stock.stock[f].compote !== 0 || stock.stock[f].filled !== 0),
      ...Object.keys(demand.toDip),
    ]),
  ];

  const rows: FreezerRow[] = names.map((name) => {
    const s = stock.settings[name];
    const size = s?.mould_size ?? DEFAULT_MOULD;
    return {
      name,
      compote: stock.stock[name]?.compote ?? 0,
      filled: stock.stock[name]?.filled ?? 0,
      toDip: demand.toDip[name] ?? 0,
      pending: demand.pending[name] ?? 0,
      mouldSize: size,
      parCompote: s?.par_compote ?? 0,
      parFilled: s?.par_filled ?? 0,
    };
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-serif text-3xl">Freezer</h1>
        <p className="text-sm text-gray-600">
          What&apos;s in the freezer and what orders need over the next {DEMAND_DAYS} days. Ticking a piece on the Production board takes one from &ldquo;Ready to dip&rdquo;.
        </p>
      </div>
      <FreezerBoard rows={rows} log={(log.data ?? []) as StockMove[]} ready={stock.ok} />
    </div>
  );
}
