import { addDays, isoInSAST, startOfWeek, todaySAST } from "./dates";
import { orderBreakdown, orderPieces, type Order } from "./types";

const active = (o: Order) => o.status !== "cancelled";
const paid = (o: Order) => ["confirmed", "ready", "collected"].includes(o.status);

export function computeStats(orders: Order[], depositPercent: number) {
  const today = todaySAST();
  const thisWeek = startOfWeek(today);
  const lastWeek = addDays(thisWeek, -7);

  const live = orders.filter(active);
  const inWeek = (o: Order, start: string) => {
    const d = isoInSAST(o.created_at);
    return d >= start && d < addDays(start, 7);
  };

  const sum = (list: Order[]) => list.reduce((a, o) => a + Number(o.total_zar), 0);
  const paidThis = sum(live.filter((o) => paid(o) && inWeek(o, thisWeek)));
  const paidLast = sum(live.filter((o) => paid(o) && inWeek(o, lastWeek)));
  const bookedThis = sum(live.filter((o) => inWeek(o, thisWeek)));

  const awaiting = orders.filter((o) => o.status === "pending_payment");
  const awaitingAmount = awaiting.reduce((a, o) => a + (Number(o.total_zar) * depositPercent) / 100, 0);
  const overdue = awaiting.filter((o) => Date.now() - new Date(o.created_at).getTime() > 24 * 3600 * 1000);

  const aov = live.length ? sum(live) / live.length : 0;

  const byEmail = new Map<string, number>();
  for (const o of live) {
    const e = o.customer_email.trim().toLowerCase();
    byEmail.set(e, (byEmail.get(e) ?? 0) + 1);
  }
  const customers = byEmail.size;
  const repeat = [...byEmail.values()].filter((n) => n > 1).length;

  const flavourTotals: Record<string, number> = {};
  for (const o of live) for (const [n, q] of Object.entries(orderBreakdown(o))) flavourTotals[n] = (flavourTotals[n] ?? 0) + q;
  const topFlavours = Object.entries(flavourTotals).sort((a, b) => b[1] - a[1]);

  // Paid revenue for the last 8 weeks, oldest first
  const weeks = Array.from({ length: 8 }, (_, i) => addDays(thisWeek, -7 * (7 - i))).map((start) => ({
    start,
    revenue: sum(live.filter((o) => paid(o) && inWeek(o, start))),
  }));

  // Pieces booked for each of the next 7 collection days
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i)).map((date) => {
    const list = live.filter((o) => o.requested_date.slice(0, 10) === date);
    return { date, pieces: list.reduce((a, o) => a + orderPieces(o), 0), orders: list.length };
  });

  return { paidThis, paidLast, bookedThis, awaiting, awaitingAmount, overdue, aov, customers, repeat, topFlavours, weeks, days, totalOrders: live.length };
}
