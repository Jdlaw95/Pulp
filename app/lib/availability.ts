import { serverDb } from "./supabase";
import { getSettings, getBlackoutDates } from "./settings";
import { earliestOrderDate, fmtDate, isValidISODate, addDays, todaySAST } from "./dates";

export type DateStatus = { ok: boolean; reason?: string; remaining: number | null };

/** Pieces already booked for a collection date (cancelled orders do not count). */
export async function piecesBooked(date: string): Promise<number> {
  const { data, error } = await serverDb()
    .from("orders")
    .select("status, order_items(flavor_breakdown)")
    .eq("requested_date", date)
    .neq("status", "cancelled");
  if (error || !data) {
    console.warn("Capacity check could not read orders:", error?.message);
    return 0;
  }
  let total = 0;
  for (const o of data as { order_items?: { flavor_breakdown: Record<string, number> | null }[] }[]) {
    for (const item of o.order_items ?? []) {
      for (const qty of Object.values(item.flavor_breakdown ?? {})) total += Number(qty) || 0;
    }
  }
  return total;
}

export async function dateStatus(date: string, pieces: number): Promise<DateStatus> {
  if (!isValidISODate(date)) return { ok: false, reason: "Please pick a valid date.", remaining: null };

  const [settings, blackouts] = await Promise.all([getSettings(), getBlackoutDates()]);
  if (!settings.orders_open) return { ok: false, reason: "Orders are paused right now. Please check back soon.", remaining: null };

  const earliest = earliestOrderDate(settings.min_notice_days, settings.cutoff_hour);
  if (date < earliest) return { ok: false, reason: `The earliest date available is ${fmtDate(earliest)}.`, remaining: null };
  if (date > addDays(todaySAST(), 120)) return { ok: false, reason: "Please choose a date within the next 4 months.", remaining: null };

  const blocked = blackouts.find((b) => b.date === date);
  if (blocked) return { ok: false, reason: blocked.reason ? `We are closed that day (${blocked.reason}).` : "We are closed that day.", remaining: null };

  if (settings.daily_capacity === null) return { ok: true, remaining: null };

  const booked = await piecesBooked(date);
  const remaining = Math.max(0, settings.daily_capacity - booked);
  if (remaining === 0) return { ok: false, reason: "That day is fully booked. Please pick another date.", remaining: 0 };
  if (pieces > remaining) return { ok: false, reason: `Only ${remaining} left for that day. Try a smaller order or another date.`, remaining };
  return { ok: true, remaining };
}
