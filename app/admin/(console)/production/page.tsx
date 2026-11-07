import Link from "next/link";
import { requireAdmin } from "../../../lib/auth";
import { getSettings } from "../../../lib/settings";
import { loadOrders } from "../../data";
import { addDays, fmtDate, isValidISODate, todaySAST } from "../../../lib/dates";
import { formatBreakdown, orderBreakdown, orderPieces, statusLabel } from "../../../lib/types";
import PrintButton from "../PrintButton";
import { loadStock } from "../../../lib/stock";
import ProductionBoard, { type BoardRow } from "./ProductionBoard";

export default async function ProductionPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const sp = await searchParams;
  const { db } = await requireAdmin();
  const settings = await getSettings();

  const today = todaySAST();
  const all = await loadOrders(db, { from: today, to: addDays(today, 60) });
  const live = all.filter((o) => o.status !== "cancelled");

  // Default to the next day that has orders, otherwise tomorrow.
  const nextWithOrders = live.map((o) => o.requested_date.slice(0, 10)).sort()[0];
  const date = sp.date && isValidISODate(sp.date) ? sp.date : nextWithOrders ?? addDays(today, 1);

  const orders = live
    .filter((o) => o.requested_date.slice(0, 10) === date)
    .sort((a, b) => (a.pickup_slot ?? "").localeCompare(b.pickup_slot ?? ""));
  const confirmed = orders.filter((o) => o.status !== "pending_payment");
  const pendingOrders = orders.filter((o) => o.status === "pending_payment");

  const tally = (list: typeof orders) => {
    const t: Record<string, number> = {};
    for (const o of list) for (const [n, q] of Object.entries(orderBreakdown(o))) t[n] = (t[n] ?? 0) + q;
    return t;
  };
  const tConfirmed = tally(confirmed);
  const tPending = tally(pendingOrders);
  // Saved tick-off progress for this date (missing table = board shows but cannot save yet).
  const progress = await db.from("production_progress").select("flavour, made").eq("date", date);
  const boardReady = !progress.error;
  const madeBy: Record<string, number> = {};
  for (const p of (progress.data ?? []) as { flavour: string; made: number }[]) madeBy[p.flavour] = Number(p.made) || 0;

  const flavours = [...new Set([...Object.keys(tConfirmed), ...Object.keys(tPending)])].sort();
  // Keep flavours that were made but are no longer ordered (e.g. a cancellation) so the spares stay visible.
  const boardNames = [...new Set([...flavours, ...Object.keys(madeBy).filter((f) => madeBy[f] > 0)])].sort();
  const freezer = await loadStock(db);
  const boardRows: BoardRow[] = boardNames.map((name) => ({
    name,
    need: tConfirmed[name] ?? 0,
    pending: tPending[name] ?? 0,
    made: madeBy[name] ?? 0,
    frozen: freezer.ok ? freezer.stock[name]?.filled ?? 0 : null,
  }));
  const totalConfirmed = confirmed.reduce((a, o) => a + orderPieces(o), 0);
  const totalPending = pendingOrders.reduce((a, o) => a + orderPieces(o), 0);
  const cap = settings.daily_capacity;

  return (
    <div className="space-y-5">
      <div className="no-print flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-serif text-3xl">Production list</h1>
        <div className="flex gap-2">
          <Link href={`?date=${addDays(date, -1)}`} aria-label="Previous day" className="flex items-center rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm hover:bg-gray-50">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
          </Link>
          <form className="flex gap-2" method="get">
            <input key={date} type="date" name="date" defaultValue={date} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm" />
            <button className="rounded-lg bg-pulp-text px-4 py-2 text-sm text-white">Go</button>
          </form>
          <Link href={`?date=${addDays(date, 1)}`} aria-label="Next day" className="flex items-center rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm hover:bg-gray-50">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
          </Link>
          <PrintButton />
        </div>
      </div>

      <div>
        <h2 className="font-serif text-2xl">{fmtDate(date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</h2>
        <p className="text-sm text-gray-600">
          {totalConfirmed} to make{totalPending > 0 && <> · {totalPending} more if the unpaid orders confirm</>}
          {cap ? <> · daily limit {cap}</> : null}
        </p>
      </div>

      {orders.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-gray-500">Nothing booked for this day.</div>
      ) : (
        <>
          <ProductionBoard key={date} date={date} rows={boardRows} ready={boardReady} />

          <section className="print-only overflow-hidden rounded-xl border border-gray-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
                <tr><th className="px-4 py-3">Flavour</th><th className="px-4 py-3 text-right">Make</th><th className="px-4 py-3 text-right">If unpaid confirm</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {flavours.map((f) => (
                  <tr key={f}>
                    <td className="px-4 py-3 font-medium">{f}</td>
                    <td className="px-4 py-3 text-right text-lg tabular-nums">{tConfirmed[f] ?? 0}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-500">{tPending[f] ? `+${tPending[f]}` : "–"}</td>
                  </tr>
                ))}
                <tr className="bg-gray-50 font-semibold">
                  <td className="px-4 py-3">Total</td>
                  <td className="px-4 py-3 text-right text-lg tabular-nums">{totalConfirmed}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-500">{totalPending ? `+${totalPending}` : "–"}</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section className="space-y-2">
            <h3 className="font-serif text-xl">Orders ({orders.length})</h3>
            {orders.map((o) => (
              <div key={o.id} className="rounded-xl border border-gray-200 bg-white p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold"><span className="mr-2 font-mono">{o.order_ref}</span>{o.customer_name}</p>
                  <p className="text-gray-500">{o.pickup_slot ?? "No time chosen"} · {statusLabel(o.status)}</p>
                </div>
                <p className="mt-1">{o.box_type ? `${o.box_type}: ` : ""}{formatBreakdown(o)}</p>
                <p className="text-gray-600">{o.customer_phone}</p>
                {o.gift_note && <p className="mt-1 rounded bg-amber-50 px-2 py-1 text-amber-900">Gift note: {o.gift_note}</p>}
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
