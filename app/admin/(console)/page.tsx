import Link from "next/link";
import { requireAdmin } from "../../lib/auth";
import { getSettings } from "../../lib/settings";
import { loadOrders } from "../data";
import { computeStats } from "../../lib/stats";
import { fmtDate } from "../../lib/dates";
import { formatBreakdown, rand } from "../../lib/types";

function Tile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "warn" }) {
  return (
    <div className={`rounded-xl border bg-white p-4 ${tone === "warn" ? "border-amber-300" : "border-gray-200"}`}>
      <p className="text-xs uppercase tracking-wider text-gray-500">{label}</p>
      <p className="mt-1 font-serif text-3xl">{value}</p>
      {sub && <p className="mt-1 text-xs text-gray-500">{sub}</p>}
    </div>
  );
}

export default async function Overview() {
  const { db } = await requireAdmin();
  const [orders, settings] = await Promise.all([loadOrders(db), getSettings()]);
  const s = computeStats(orders, settings.deposit_percent);

  const delta = s.paidLast > 0 ? Math.round(((s.paidThis - s.paidLast) / s.paidLast) * 100) : null;
  const maxWeek = Math.max(1, ...s.weeks.map((w) => w.revenue));
  const cap = settings.daily_capacity;
  const maxDay = Math.max(1, cap ?? 0, ...s.days.map((d) => d.pieces));
  const repeatPct = s.customers ? Math.round((s.repeat / s.customers) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <h1 className="font-serif text-3xl">Overview</h1>
        <Link href="/admin/production" className="rounded-lg bg-pulp-text px-4 py-2 text-sm font-medium text-white">Production list</Link>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Paid this week" value={rand(s.paidThis)} sub={delta === null ? "No paid orders last week" : `${delta >= 0 ? "+" : ""}${delta}% vs last week (${rand(s.paidLast)})`} />
        <Tile label="Awaiting deposit" value={String(s.awaiting.length)} sub={`${rand(s.awaitingAmount)} in deposits${s.overdue.length ? `, ${s.overdue.length} over 24h` : ""}`} tone={s.overdue.length ? "warn" : undefined} />
        <Tile label="Average order" value={rand(Math.round(s.aov))} sub={`${s.totalOrders} orders in total`} />
        <Tile label="Repeat customers" value={`${repeatPct}%`} sub={`${s.repeat} of ${s.customers} ordered more than once`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-1 font-serif text-xl">Next 7 days</h2>
          <p className="mb-4 text-xs text-gray-500">Pieces to make per collection day{cap ? `, daily limit ${cap}` : ""}</p>
          <ul className="space-y-2">
            {s.days.map((d) => (
              <li key={d.date}>
                <Link href={`/admin/production?date=${d.date}`} className="group flex items-center gap-3 text-sm">
                  <span className="w-24 shrink-0 text-gray-600 group-hover:text-pulp-text">{fmtDate(d.date)}</span>
                  <span className="relative h-5 flex-1 overflow-hidden rounded bg-gray-100">
                    <span className={`absolute inset-y-0 left-0 rounded ${cap && d.pieces >= cap ? "bg-red-400" : "bg-pulp-green"}`} style={{ width: `${(d.pieces / maxDay) * 100}%` }} />
                  </span>
                  <span className="w-20 shrink-0 text-right tabular-nums">{d.pieces} <span className="text-xs text-gray-400">({d.orders})</span></span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-1 font-serif text-xl">Paid revenue by week</h2>
          <p className="mb-4 text-xs text-gray-500">Last 8 weeks, by order date</p>
          <div className="flex h-36 items-end gap-2">
            {s.weeks.map((w) => (
              <div key={w.start} className="flex flex-1 flex-col items-center justify-end gap-1">
                <span className="text-[10px] tabular-nums text-gray-500">{w.revenue ? rand(w.revenue) : ""}</span>
                <div className="w-full rounded-t bg-pulp-text" style={{ height: `${Math.max(3, Math.round((w.revenue / maxWeek) * 96))}px`, opacity: w.revenue ? 1 : 0.15 }} />
                <span className="text-[10px] text-gray-400">{fmtDate(w.start, { day: "numeric", month: "short" })}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-3 font-serif text-xl">Needs attention</h2>
          {s.awaiting.length === 0 ? (
            <p className="text-sm text-gray-500">Nothing waiting on a deposit.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {s.awaiting.slice(0, 6).map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{o.order_ref} · {o.customer_name}</p>
                    <p className="truncate text-xs text-gray-500">{formatBreakdown(o)} · for {fmtDate(o.requested_date)}</p>
                  </div>
                  <span className="shrink-0 tabular-nums">{rand(Number(o.total_zar))}</span>
                </li>
              ))}
            </ul>
          )}
          <Link href="/admin/orders?status=pending_payment" className="mt-3 inline-block text-sm underline">See all awaiting deposit</Link>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-3 font-serif text-xl">Flavours by popularity</h2>
          {s.topFlavours.length === 0 ? (
            <p className="text-sm text-gray-500">No orders yet.</p>
          ) : (
            <ul className="space-y-2">
              {s.topFlavours.map(([name, qty]) => (
                <li key={name} className="flex items-center gap-3 text-sm">
                  <span className="w-28 shrink-0 truncate">{name}</span>
                  <span className="relative h-4 flex-1 overflow-hidden rounded bg-gray-100">
                    <span className="absolute inset-y-0 left-0 rounded bg-pulp-green" style={{ width: `${(qty / s.topFlavours[0][1]) * 100}%` }} />
                  </span>
                  <span className="w-10 text-right tabular-nums">{qty}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
