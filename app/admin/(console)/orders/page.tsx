import Link from "next/link";
import { requireAdmin } from "../../../lib/auth";
import { getSettings } from "../../../lib/settings";
import { loadOrders } from "../../data";
import { STATUSES } from "../../../lib/types";
import OrderCard from "../OrderCard";

type SP = { q?: string; status?: string; from?: string; to?: string };

export default async function OrdersPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const { db } = await requireAdmin();
  const [orders, settings] = await Promise.all([loadOrders(db, sp), getSettings()]);
  const current = sp.status ?? "all";

  const exportQs = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]).toString();
  const tab = (value: string, label: string) => {
    const qs = new URLSearchParams(Object.entries({ ...sp, status: value }).filter(([k, v]) => v && !(k === "status" && value === "all")) as [string, string][]).toString();
    return (
      <Link key={value} href={`/admin/orders${qs ? `?${qs}` : ""}`} className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm ${current === value ? "bg-pulp-text text-white" : "bg-white text-gray-600 hover:bg-gray-50"} border border-gray-200`}>
        {label}
      </Link>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-serif text-3xl">Orders</h1>
        <div className="flex gap-2">
        <Link href="/admin/orders/new" className="rounded-lg bg-pulp-text px-4 py-2 text-sm text-white hover:bg-black">+ Add order</Link>
        <a href={`/admin/export${exportQs ? `?${exportQs}` : ""}`} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm hover:bg-gray-50">Export CSV</a>
        </div>
      </div>

      <form className="flex flex-wrap gap-2" method="get">
        <input type="hidden" name="status" value={current === "all" ? "" : current} />
        <input name="q" defaultValue={sp.q} placeholder="Search name, ref, phone or email" className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm" />
        <input type="date" name="from" defaultValue={sp.from} aria-label="Collection from" className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm" />
        <input type="date" name="to" defaultValue={sp.to} aria-label="Collection to" className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm" />
        <button className="rounded-lg bg-pulp-text px-4 py-2 text-sm text-white">Filter</button>
        {(sp.q || sp.from || sp.to) && <Link href="/admin/orders" className="px-2 py-2 text-sm text-gray-500 underline">Clear</Link>}
      </form>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {tab("all", "All")}
        {STATUSES.map((s) => tab(s.value, s.label))}
      </div>

      <p className="text-sm text-gray-500">{orders.length} order{orders.length === 1 ? "" : "s"}</p>

      {orders.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-gray-500">No orders match.</div>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => <OrderCard key={o.id} order={o} depositPercent={settings.deposit_percent} />)}
        </div>
      )}
    </div>
  );
}
