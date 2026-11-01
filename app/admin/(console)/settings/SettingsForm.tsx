"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addBlackout, removeBlackout, saveSettings } from "../../actions";
import type { Settings } from "../../../lib/settings";
import { fmtDate } from "../../../lib/dates";

const field = "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm";
const label = "mb-1 block text-sm font-medium";
const hint = "mt-1 text-xs text-gray-500";

export default function SettingsForm({ settings, blackouts }: { settings: Settings; blackouts: { date: string; reason: string | null }[] }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(saveSettings, null);
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState("");
  const [, start] = useTransition();

  const block = async () => {
    setMsg("");
    const r = await addBlackout(date, reason);
    if (!r.ok) return setMsg(r.message ?? "Could not add");
    setDate(""); setReason("");
    start(() => router.refresh());
  };
  const unblock = async (d: string) => {
    const r = await removeBlackout(d);
    if (!r.ok) return setMsg(r.message ?? "Could not remove");
    start(() => router.refresh());
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <form action={action} className="space-y-6 rounded-xl border border-gray-200 bg-white p-5">
        <label className="flex items-start gap-3">
          <input type="checkbox" name="orders_open" defaultChecked={settings.orders_open} className="mt-1 h-4 w-4" />
          <span>
            <span className="block text-sm font-medium">Taking orders</span>
            <span className={hint}>Untick to pause ordering on the website, for example when you are fully booked or away.</span>
          </span>
        </label>

        <fieldset>
          <legend className="mb-2 font-serif text-lg">Prices (R)</legend>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={label} htmlFor="price_trio">Trio</label><input id="price_trio" name="price_trio" type="number" min={1} defaultValue={settings.prices.trio} className={field} /></div>
            <div><label className={label} htmlFor="price_box6">Box of 6</label><input id="price_box6" name="price_box6" type="number" min={1} defaultValue={settings.prices.box6} className={field} /></div>
          </div>
          <p className={hint}>Fixed prices for the boxes. Each flavour has its own price under Products.</p>
        </fieldset>

        <fieldset>
          <legend className="mb-2 font-serif text-lg">Orders</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={label} htmlFor="deposit_percent">Deposit (%)</label>
              <input id="deposit_percent" name="deposit_percent" type="number" min={0} max={100} defaultValue={settings.deposit_percent} className={field} />
            </div>
            <div>
              <label className={label} htmlFor="min_notice_days">Notice needed (days)</label>
              <input id="min_notice_days" name="min_notice_days" type="number" min={0} max={30} defaultValue={settings.min_notice_days} className={field} />
            </div>
            <div>
              <label className={label} htmlFor="daily_capacity">Daily limit (pieces)</label>
              <input id="daily_capacity" name="daily_capacity" type="number" min={1} defaultValue={settings.daily_capacity ?? ""} placeholder="No limit" className={field} />
              <p className={hint}>The most pieces you can make for one collection day. Customers see a date as full once it is reached.</p>
            </div>
            <div>
              <label className={label} htmlFor="cutoff_hour">Daily cut-off hour</label>
              <input id="cutoff_hour" name="cutoff_hour" type="number" min={0} max={23} defaultValue={settings.cutoff_hour ?? ""} placeholder="None" className={field} />
              <p className={hint}>0 to 23, Cape Town time. After this hour the earliest date moves out one more day.</p>
            </div>
          </div>
        </fieldset>

        <div>
          <label className={label} htmlFor="pickup_slots">Collection times (one per line)</label>
          <textarea id="pickup_slots" name="pickup_slots" rows={4} defaultValue={settings.pickup_slots.join("\n")} className={field} />
        </div>

        <div className="flex items-center gap-3">
          <button disabled={pending} className="rounded-lg bg-pulp-text px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">{pending ? "Saving…" : "Save settings"}</button>
          {state && <p role="status" className={`text-sm ${state.ok ? "text-emerald-700" : "text-red-600"}`}>{state.message}</p>}
        </div>
      </form>

      <section className="h-fit space-y-3 rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="font-serif text-lg">Closed days</h2>
        <p className={hint}>Customers cannot choose these collection dates.</p>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={field} aria-label="Date to close" />
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional)" className={field} />
        <button onClick={block} disabled={!date} className="w-full rounded-lg bg-pulp-text py-2 text-sm font-bold text-white disabled:opacity-40">Close this day</button>
        {msg && <p role="alert" className="text-sm text-red-600">{msg}</p>}
        <ul className="divide-y divide-gray-100">
          {blackouts.length === 0 && <li className="py-2 text-sm text-gray-500">No closed days.</li>}
          {blackouts.map((b) => (
            <li key={b.date} className="flex items-center justify-between py-2 text-sm">
              <span>{fmtDate(b.date, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}{b.reason ? <span className="text-gray-500"> · {b.reason}</span> : null}</span>
              <button onClick={() => unblock(b.date)} className="text-xs text-red-600 underline">Remove</button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
