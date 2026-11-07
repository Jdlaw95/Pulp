"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addMousse, adjustStock, countFreezer, saveStockSetting, undoStock } from "../../actions";
import { colourFor } from "../../../lib/colours";
import type { StockMove } from "../../../lib/stock";

export type FreezerRow = {
  name: string;
  compote: number; // "compote only": frozen compote, no mousse yet
  filled: number; // "ready to dip": compote + mousse, frozen
  toDip: number; // confirmed pieces orders still need, next 7 days
  pending: number; // more if unpaid orders confirm
  mouldSize: number;
  parCompote: number; // keep at least (compote only)
  parFilled: number; // keep at least (ready to dip)
};

type Result = { ok: boolean; message?: string; ids?: number[] };
type Run = (label: string, action: () => Promise<Result>, after?: () => void) => void;
type Tone = "danger" | "warning" | "success" | "neutral";

const TONE: Record<Tone, string> = {
  danger: "bg-red-50 text-red-800",
  warning: "bg-amber-50 text-amber-900",
  success: "bg-emerald-50 text-emerald-800",
  neutral: "bg-gray-100 text-gray-600",
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const moulds = (pieces: number, size: number) => plural(Math.ceil(pieces / size), "mould");

function status(r: FreezerRow): { text: string; tone: Tone } {
  if (r.filled < 0 || r.compote < 0) return { text: "Numbers look off. Count the freezer", tone: "danger" };
  const shortReady = Math.max(0, r.toDip - r.filled);
  const shortCompote = Math.max(0, shortReady - r.compote);
  if (shortCompote > 0) return { text: `Make compote for ${moulds(shortCompote, r.mouldSize)}, then add mousse`, tone: "danger" };
  if (shortReady > 0) return { text: `Add mousse to ${moulds(shortReady, r.mouldSize)} to cover orders`, tone: "warning" };
  const low = r.filled - r.toDip < r.parFilled || r.compote < r.parCompote;
  if (r.toDip > 0) return low ? { text: "Orders covered, running low", tone: "warning" } : { text: "Orders covered", tone: "success" };
  return low ? { text: "Running low", tone: "warning" } : { text: "No orders this week", tone: "neutral" };
}

const btn = "rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm transition hover:bg-gray-50 disabled:opacity-40";
const STAGE_WORD: Record<string, string> = { compote: "compote only", filled: "ready to dip" };

function Tile({ value, label, sub, tone }: { value: number; label: string; sub: string; tone?: "warn" | "bad" }) {
  return (
    <div className="min-w-0 flex-1 rounded-lg bg-gray-50 px-2 py-2.5 text-center">
      <p className={`text-2xl tabular-nums ${tone === "bad" ? "text-red-700" : tone === "warn" ? "text-amber-700" : ""}`}>{value}</p>
      <p className="text-sm text-gray-700">{label}</p>
      <p className="text-[11px] text-gray-400">{sub}</p>
    </div>
  );
}

type Mode = null | "compote" | "mousse" | "count" | "settings";

function FlavourCard({ r, run, busy, ready }: { r: FreezerRow; run: Run; busy: boolean; ready: boolean }) {
  const [mode, setMode] = useState<Mode>(null);
  const [qty, setQty] = useState(1);
  const [unit, setUnit] = useState<"moulds" | "pieces">("moulds");
  const st = status(r);
  const pieces = unit === "moulds" ? qty * r.mouldSize : qty;
  const close = () => setMode(null);

  function open(m: Mode) {
    if (mode === m) return close();
    setMode(m);
    setUnit("moulds");
    setQty(1);
  }

  const action = (m: Exclude<Mode, null>, text: string) => (
    <button
      onClick={() => open(m)}
      disabled={!ready}
      aria-expanded={mode === m}
      className={`min-w-[8rem] flex-1 rounded-lg border px-3 py-2.5 text-sm transition disabled:opacity-40 ${mode === m ? "border-pulp-text bg-gray-50" : "border-gray-300 bg-white hover:bg-gray-50"}`}
    >
      {text}
    </button>
  );

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full" style={{ background: colourFor(r.name) }} />
          <h2 className="text-lg font-medium">{r.name}</h2>
          <span className="text-xs text-gray-400">1 mould = {r.mouldSize}</span>
        </div>
        <span className={`rounded-lg px-2.5 py-1 text-xs ${TONE[st.tone]}`}>{st.text}</span>
      </div>

      <div className="flex gap-1.5">
        <Tile value={r.compote} label="Compote only" sub="frozen, no mousse" tone={r.compote < 0 ? "bad" : r.compote < r.parCompote ? "warn" : undefined} />
        <Tile value={r.filled} label="Ready to dip" sub={`keep at least ${r.parFilled}`} tone={r.filled < 0 ? "bad" : r.filled - r.toDip < r.parFilled ? "warn" : undefined} />
        <Tile value={r.toDip} label="Orders need" sub={r.pending ? `+${r.pending} if unpaid pay` : "next 7 days"} />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {action("compote", "I made compote")}
        {action("mousse", "I added mousse")}
        {action("count", "Count the freezer")}
      </div>

      {(mode === "compote" || mode === "mousse") && (
        <div className="mt-3 rounded-lg bg-gray-50 p-3">
          <p className="mb-2 text-sm">{mode === "compote" ? "How much compote did you make?" : "How many did you add mousse to?"}</p>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <button className={`${btn} h-11 w-11 text-lg`} aria-label="Less" onClick={() => setQty((q) => Math.max(1, q - 1))}>−</button>
              <span className="min-w-[2ch] text-center text-2xl tabular-nums">{qty}</span>
              <button className={`${btn} h-11 w-11 text-lg`} aria-label="More" onClick={() => setQty((q) => Math.min(unit === "moulds" ? 50 : 500, q + 1))}>+</button>
            </div>
            <div className="inline-flex overflow-hidden rounded-lg border border-gray-300 text-sm">
              {(["moulds", "pieces"] as const).map((u) => (
                <button key={u} onClick={() => setUnit(u)} aria-pressed={unit === u} className={`px-3 py-2 ${unit === u ? "bg-pulp-text text-white" : "bg-white hover:bg-gray-50"}`}>
                  {u}
                </button>
              ))}
            </div>
          </div>
          <p className="mt-2 text-sm text-gray-600">
            = {plural(pieces, "piece")}
            {mode === "mousse" && ", moved from compote only to ready to dip"}
          </p>
          <div className="mt-3 flex gap-2">
            <button
              disabled={busy}
              className="rounded-lg bg-pulp-text px-4 py-2 text-sm text-white transition hover:opacity-90 disabled:opacity-40"
              onClick={() =>
                mode === "compote"
                  ? run(`Made ${pieces} ${r.name} compote`, () => adjustStock(r.name, "compote", pieces, "Made compote"), close)
                  : run(`Added mousse to ${pieces} ${r.name}`, () => addMousse(r.name, pieces), close)
              }
            >
              Save
            </button>
            <button className={btn} onClick={close}>Cancel</button>
          </div>
        </div>
      )}

      {mode === "count" && (
        <form
          className="mt-3 rounded-lg bg-gray-50 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const n = (k: string) => Math.max(0, Math.floor(Number(f.get(k)) || 0));
            run(`Counted ${r.name}`, () => countFreezer(r.name, n("compote"), n("ready")), close);
          }}
        >
          <p className="mb-2 text-sm">What&apos;s in the freezer right now? Count single pieces.</p>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm text-gray-600">
              Compote only
              <input name="compote" type="number" inputMode="numeric" min={0} max={500} defaultValue={Math.max(0, r.compote)} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-lg" />
            </label>
            <label className="text-sm text-gray-600">
              Ready to dip
              <input name="ready" type="number" inputMode="numeric" min={0} max={500} defaultValue={Math.max(0, r.filled)} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-lg" />
            </label>
          </div>
          <p className="mt-2 text-xs text-gray-500">This replaces the numbers above. The difference is saved in the history.</p>
          <div className="mt-3 flex gap-2">
            <button disabled={busy} className="rounded-lg bg-pulp-text px-4 py-2 text-sm text-white transition hover:opacity-90 disabled:opacity-40">Save count</button>
            <button type="button" className={btn} onClick={close}>Cancel</button>
          </div>
        </form>
      )}

      {mode === "settings" ? (
        <form
          className="mt-3 rounded-lg bg-gray-50 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const n = (k: string) => Math.floor(Number(f.get(k)));
            run(`Saved ${r.name} settings`, () => saveStockSetting(r.name, n("mould"), n("parC"), n("parF")), close);
          }}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="text-sm text-gray-600">Pieces per mould<input name="mould" type="number" min={1} max={60} defaultValue={r.mouldSize} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2" /></label>
            <label className="text-sm text-gray-600">Keep at least, ready to dip<input name="parF" type="number" min={0} max={500} defaultValue={r.parFilled} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2" /></label>
            <label className="text-sm text-gray-600">Keep at least, compote only<input name="parC" type="number" min={0} max={500} defaultValue={r.parCompote} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2" /></label>
          </div>
          <div className="mt-3 flex gap-2">
            <button disabled={busy} className="rounded-lg bg-pulp-text px-4 py-2 text-sm text-white transition hover:opacity-90 disabled:opacity-40">Save settings</button>
            <button type="button" className={btn} onClick={close}>Cancel</button>
          </div>
        </form>
      ) : (
        <button onClick={() => open("settings")} disabled={!ready} className="mt-3 text-xs text-gray-500 underline hover:text-pulp-text disabled:opacity-40">
          Settings
        </button>
      )}
    </section>
  );
}

export default function FreezerBoard({ rows, log, ready }: { rows: FreezerRow[]; log: StockMove[]; ready: boolean }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(ready ? null : "Run supabase/freezer.sql in the Supabase SQL editor to switch the freezer on.");
  const [last, setLast] = useState<{ ids: number[]; label: string } | null>(null);

  const run: Run = (label, action, after) => {
    start(async () => {
      const res: Result = await action().catch(() => ({ ok: false, message: "Could not reach the server. Check your connection." }));
      if (!res.ok) {
        setError(res.message ?? "That did not save.");
        return;
      }
      setError(null);
      setLast(res.ids?.length ? { ids: res.ids, label } : null);
      after?.();
      router.refresh();
    });
  };

  function undo() {
    if (!last) return;
    const ids = last.ids;
    start(async () => {
      const res = await undoStock(ids);
      if (!res.ok) setError(res.message ?? "Could not undo.");
      setLast(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {error && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{error}</p>}
      {last && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">
          <span className="text-gray-700">Saved: {last.label}</span>
          <button onClick={undo} disabled={busy} className={btn}>Undo</button>
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        {rows.map((r) => (
          <FlavourCard key={r.name} r={r} run={run} busy={busy} ready={ready} />
        ))}
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="mb-2 font-medium">History</h2>
        {log.length === 0 ? (
          <p className="text-sm text-gray-500">Nothing yet. Start with &ldquo;Count the freezer&rdquo; on each flavour.</p>
        ) : (
          <ul className="divide-y divide-gray-100 text-sm">
            {log.map((m) => (
              <li key={m.id} className="flex flex-wrap justify-between gap-2 py-2">
                <span>
                  <span className={m.change > 0 ? "text-emerald-700" : "text-red-700"}>{m.change > 0 ? `+${m.change}` : m.change}</span> {m.flavour} {STAGE_WORD[m.stage] ?? m.stage}
                  <span className="text-gray-500"> · {m.reason}</span>
                </span>
                <span className="text-xs text-gray-400">
                  {new Date(m.created_at).toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
