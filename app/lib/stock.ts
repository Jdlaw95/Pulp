import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, todaySAST } from "./dates";
import { orderBreakdown, type Order } from "./types";

export type Stage = "compote" | "filled";
export const STAGES: Stage[] = ["compote", "filled"];

export type StockSetting = { flavour: string; mould_size: number; par_compote: number; par_filled: number };
export type StockMove = { id: number; flavour: string; stage: Stage; change: number; reason: string; created_at: string };

export const DEFAULT_MOULD = 6;
export const DEMAND_DAYS = 7;

/** Current stock per flavour and stage, summed from the ledger. ok=false means freezer.sql has not been run. */
export async function loadStock(db: SupabaseClient) {
  const [moves, settings] = await Promise.all([
    db.from("stock_levels").select("flavour, stage, qty"),
    db.from("stock_settings").select("*"),
  ]);
  const ok = !moves.error && !settings.error;
  const stock: Record<string, { compote: number; filled: number }> = {};
  for (const m of (moves.data ?? []) as { flavour: string; stage: Stage; qty: number }[]) {
    stock[m.flavour] ??= { compote: 0, filled: 0 };
    stock[m.flavour][m.stage] = Number(m.qty) || 0;
  }
  const bySetting: Record<string, StockSetting> = {};
  for (const s of (settings.data ?? []) as StockSetting[]) bySetting[s.flavour] = s;
  return { ok, stock, settings: bySetting };
}

/**
 * Pieces still to dip per flavour over the next DEMAND_DAYS collection days (today included).
 * Confirmed orders count as `need`; unpaid orders as `pending`. Pieces already ticked on the
 * production board for a date are taken off that date's need.
 */
export async function loadDemand(db: SupabaseClient, orders: Order[]) {
  const today = todaySAST();
  const last = addDays(today, DEMAND_DAYS - 1);
  const live = orders.filter((o) => o.status !== "cancelled" && o.requested_date.slice(0, 10) >= today && o.requested_date.slice(0, 10) <= last);

  const needBy: Record<string, Record<string, number>> = {}; // date -> flavour -> pieces
  const pending: Record<string, number> = {};
  for (const o of live) {
    const d = o.requested_date.slice(0, 10);
    for (const [name, q] of Object.entries(orderBreakdown(o))) {
      if (o.status === "pending_payment") pending[name] = (pending[name] ?? 0) + q;
      else {
        needBy[d] ??= {};
        needBy[d][name] = (needBy[d][name] ?? 0) + q;
      }
    }
  }

  const prog = await db.from("production_progress").select("date, flavour, made").gte("date", today).lte("date", last);
  const madeBy: Record<string, Record<string, number>> = {};
  for (const p of (prog.data ?? []) as { date: string; flavour: string; made: number }[]) {
    madeBy[p.date] ??= {};
    madeBy[p.date][p.flavour] = Number(p.made) || 0;
  }

  const toDip: Record<string, number> = {};
  for (const [d, flavours] of Object.entries(needBy)) {
    for (const [name, need] of Object.entries(flavours)) {
      toDip[name] = (toDip[name] ?? 0) + Math.max(0, need - (madeBy[d]?.[name] ?? 0));
    }
  }
  return { toDip, pending };
}
