"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { createManualOrder } from "../../../actions";
import { orderTotal, packSize, priceLabel, type OrderMode, type Prices } from "../../../../lib/pricing";
import { STATUSES, rand, type Product } from "../../../../lib/types";

const field = "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm";
const lbl = "mb-1 block text-xs font-medium text-gray-600";

export default function ManualOrderForm({ products, prices, slots, today }: { products: Product[]; prices: Prices; slots: string[]; today: string }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [mode, setMode] = useState<OrderMode>("Custom");
  const [items, setItems] = useState<Record<string, number>>({});
  const [override, setOverride] = useState("");
  const [date, setDate] = useState(today);
  const [slot, setSlot] = useState("");
  const [status, setStatus] = useState("collected");
  const [gift, setGift] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [done, setDone] = useState<string | null>(null);

  const calc = useMemo(() => orderTotal(mode, items, products, prices), [mode, items, products, prices]);
  const total = override.trim() === "" ? calc.total : Number(override);
  const boxN = mode === "Trio" ? 3 : mode === "Box of 6" ? 6 : null;

  const bump = (id: string, d: number) => setItems((p) => ({ ...p, [id]: Math.max(0, (p[id] ?? 0) + d) }));

  const reset = () => {
    setName(""); setPhone(""); setEmail(""); setItems({}); setOverride(""); setGift(""); setConsent(false); setMsg(""); setDone(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    const r = await createManualOrder({ name, phone, email, date, slot, mode, items, total: override.trim() === "" ? null : Number(override), status, giftNote: gift, marketingConsent: consent });
    setBusy(false);
    if (!r.ok) return setMsg(r.message ?? "Could not save");
    setDone(r.orderRef ?? "saved");
  };

  if (done)
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6">
        <p className="font-medium text-emerald-900">Order {done} added.</p>
        <div className="mt-4 flex gap-3">
          <button onClick={reset} className="rounded-lg bg-pulp-text px-4 py-2 text-sm text-white">Add another</button>
          <Link href="/admin/orders" className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm">Back to orders</Link>
        </div>
      </div>
    );

  return (
    <form onSubmit={submit} className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="font-serif text-xl">Customer</h2>
        <div><label className={lbl} htmlFor="mo-name">Name</label><input id="mo-name" className={field} required value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div><label className={lbl} htmlFor="mo-phone">WhatsApp / phone</label><input id="mo-phone" type="tel" className={field} value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
        <div><label className={lbl} htmlFor="mo-email">Email <span className="font-normal text-gray-500">(optional, needed for mailers)</span></label><input id="mo-email" type="email" className={field} value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 h-4 w-4" />
          <span>This customer told us they are happy to get news and offers.<span className="block text-xs text-gray-500">Only tick this if they actually agreed. It decides who receives your mailers.</span></span>
        </label>
        <h2 className="pt-2 font-serif text-xl">Collection</h2>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={lbl} htmlFor="mo-date">Date</label><input id="mo-date" type="date" required className={field} value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div>
            <label className={lbl} htmlFor="mo-slot">Time</label>
            <select id="mo-slot" className={field} value={slot} onChange={(e) => setSlot(e.target.value)}>
              <option value="">Not recorded</option>
              {slots.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className={lbl} htmlFor="mo-status">Status</label>
          <select id="mo-status" className={field} value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div><label className={lbl} htmlFor="mo-gift">Note <span className="font-normal text-gray-500">(optional)</span></label><input id="mo-gift" className={field} maxLength={200} value={gift} onChange={(e) => setGift(e.target.value)} /></div>
      </div>

      <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="font-serif text-xl">Order</h2>
        <div className="grid grid-cols-3 gap-2">
          {(["Trio", "Box of 6", "Custom"] as const).map((m) => (
            <button key={m} type="button" onClick={() => setMode(m)} aria-pressed={mode === m} className={`rounded-lg border px-2 py-2 text-sm ${mode === m ? "border-pulp-text bg-pulp-text text-white" : "border-gray-300 bg-white"}`}>
              {m === "Custom" ? "Singles" : m}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          {products.map((p) => (
            <div key={p.id} className="flex items-center justify-between">
              <span className="text-sm">{p.name}{mode === "Custom" && <span className="ml-2 text-xs text-gray-500">{priceLabel(p)}</span>}{mode !== "Custom" && packSize(p) > 1 && <span className="ml-2 text-xs text-gray-500">pack of {packSize(p)}</span>}</span>
              <span className="flex items-center gap-2">
                <button type="button" aria-label={`Remove one ${p.name}`} onClick={() => bump(p.id, -1)} className="h-8 w-8 rounded-full border border-gray-300">−</button>
                <span className="w-5 text-center tabular-nums">{items[p.id] ?? 0}</span>
                <button type="button" aria-label={`Add one ${p.name}`} onClick={() => bump(p.id, 1)} className="h-8 w-8 rounded-full border border-gray-300">+</button>
              </span>
            </div>
          ))}
        </div>
        {boxN !== null && calc.pieces !== boxN && <p className="text-xs text-amber-700">A {mode} is normally {boxN} picks, you have {calc.pieces}. You can still save it.</p>}
        <div>
          <label className={lbl} htmlFor="mo-total">Total (R)</label>
          <input id="mo-total" type="number" min={0} step="0.01" className={field} value={override} onChange={(e) => setOverride(e.target.value)} placeholder={String(calc.total)} />
          <p className="mt-1 text-xs text-gray-500">Leave empty to use today&apos;s prices ({rand(calc.total)}). Type an amount if this order was charged differently.</p>
        </div>
        <div className="flex items-baseline justify-between border-t border-gray-100 pt-3">
          <span className="font-medium">Total</span>
          <span className="font-serif text-2xl">{rand(Number.isFinite(total) ? total : 0)}</span>
        </div>
        {msg && <p role="alert" className="text-sm font-medium text-red-600">{msg}</p>}
        <button disabled={busy || calc.units === 0} className="w-full rounded-lg bg-pulp-text py-3 text-sm font-bold text-white disabled:opacity-40">{busy ? "Saving…" : "Save order"}</button>
      </div>
    </form>
  );
}
