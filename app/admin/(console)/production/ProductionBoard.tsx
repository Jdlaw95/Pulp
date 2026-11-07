"use client";

import { useRef, useState } from "react";
import { setProductionMade } from "../../actions";
import { colourFor } from "../../../lib/colours";

export type BoardRow = {
  name: string;
  need: number; // pieces for confirmed (paid) orders
  pending: number; // extra pieces if unpaid orders confirm
  made: number; // saved progress
  frozen: number | null; // filled pieces in the freezer (null = freezer not set up)
};

export default function ProductionBoard({ date, rows, ready }: { date: string; rows: BoardRow[]; ready: boolean }) {
  const [made, setMade] = useState<Record<string, number>>(() => Object.fromEntries(rows.map((r) => [r.name, r.made])));
  const [history, setHistory] = useState<{ name: string; prev: number }[]>([]);
  const [error, setError] = useState<string | null>(ready ? null : "Ticks will not be saved until supabase/production-board.sql has been run.");
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  // Saves run one after another so a fast run of taps can never land out of order.
  function save(name: string, next: number, prev: number) {
    queue.current = queue.current.then(async () => {
      const res = await setProductionMade(date, name, next).catch(() => ({ ok: false, message: "Could not reach the server. Check your connection." }));
      if (!res.ok) {
        setError(res.message ?? "Could not save that tick.");
        setMade((m) => (m[name] === next ? { ...m, [name]: prev } : m));
      }
    });
  }

  function change(name: string, next: number) {
    const prev = made[name] ?? 0;
    if (next === prev) return;
    setError(ready ? null : error);
    setMade((m) => ({ ...m, [name]: next }));
    setHistory((h) => [...h.slice(-49), { name, prev }]);
    if (ready) save(name, next, prev);
  }

  function undo() {
    const last = history[history.length - 1];
    if (!last) return;
    setHistory((h) => h.slice(0, -1));
    const current = made[last.name] ?? 0;
    setMade((m) => ({ ...m, [last.name]: last.prev }));
    if (ready) save(last.name, last.prev, current);
  }

  const totalNeed = rows.reduce((a, r) => a + r.need, 0);
  const totalDone = rows.reduce((a, r) => a + Math.min(made[r.name] ?? 0, r.need), 0);
  const pct = totalNeed ? Math.round((totalDone / totalNeed) * 100) : 0;
  const allDone = totalNeed > 0 && totalDone === totalNeed;

  return (
    <section className="no-print rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-gray-500">Made so far</p>
          <p className="text-3xl tabular-nums">
            {totalDone} <span className="text-gray-400">/ {totalNeed}</span>
          </p>
        </div>
        <button
          onClick={undo}
          disabled={history.length === 0}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm transition hover:bg-gray-50 disabled:opacity-40"
        >
          Undo
        </button>
      </div>

      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-gray-100" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-pulp-green transition-[width] duration-300" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-2 text-xs text-gray-500">
        {allDone ? "Everything for confirmed orders is made." : "Tap a circle when a piece is made. Tap a filled one to untick back to it."}
        {rows.some((r) => r.pending > 0) && " Dashed circles are for unpaid orders."}
      </p>

      {error && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{error}</p>}

      <div className="mt-2 divide-y divide-gray-100">
        {rows.map((r) => {
          const done = made[r.name] ?? 0;
          const colour = colourFor(r.name);
          const slots = Math.max(r.need + r.pending, done);
          const left = Math.max(0, r.need - done);
          const extra = Math.max(0, done - r.need - r.pending);
          return (
            <div key={r.name} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
              <div className="flex items-center justify-between gap-3 sm:w-40 sm:flex-col sm:items-start sm:gap-0">
                <p className="font-medium">{r.name}</p>
                <p className={`text-sm ${left === 0 && r.need > 0 ? "text-pulp-green" : "text-gray-500"}`}>
                  {r.need === 0 ? "None confirmed" : left === 0 ? "Done" : `${left} to go`}
                  {extra > 0 && ` · ${extra} spare`}
                </p>
                {r.frozen !== null && (() => {
                  const inFreezer = r.frozen - (done - r.made);
                  return <p className={`text-xs ${inFreezer < 0 ? "text-red-700" : inFreezer < left ? "text-amber-700" : "text-gray-400"}`}>{inFreezer} ready to dip in freezer</p>;
                })()}
              </div>
              <div className="flex flex-1 flex-wrap gap-2">
                {Array.from({ length: slots }, (_, i) => {
                  const filled = i < done;
                  const dashed = i >= r.need && i < r.need + r.pending;
                  return (
                    <button
                      key={i}
                      onClick={() => change(r.name, filled ? i : i + 1)}
                      aria-label={`${r.name} ${i + 1} of ${slots}${filled ? ", made" : ""}`}
                      aria-pressed={filled}
                      className={`flex h-11 w-11 items-center justify-center rounded-full border-2 transition active:scale-90 ${dashed ? "border-dashed" : ""}`}
                      style={{
                        borderColor: filled || !dashed ? colour : `${colour}80`,
                        background: filled ? colour : "transparent",
                      }}
                    >
                      {filled && (
                        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="white" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M5 12l5 5L20 7" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
              {left > 0 && (
                <button onClick={() => change(r.name, r.need)} className="self-start rounded-lg px-3 py-2 text-sm text-gray-600 underline hover:text-pulp-text sm:self-center">
                  All made
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
