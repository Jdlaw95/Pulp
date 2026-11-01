"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { checkDate, submitOrder, type OrderResult } from "./actions";
import { boxSize, orderTotal, packSize, priceLabel, type OrderMode, type Prices } from "./lib/pricing";
import { SHOP, waLink } from "./lib/config";
import type { Product } from "./lib/types";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  prices: Prices;
  slots: string[];
  depositPercent: number;
  earliestDate: string;
  blackouts: { date: string; reason: string | null }[];
  whatsappIntl: string;
};

type Step = 1 | 2 | 3;
type DateState = { state: "idle" | "checking" | "ok" | "bad"; message?: string; remaining?: number | null };

const inputCls =
  "w-full rounded-lg border border-pulp-border bg-white px-3 py-3 text-base outline-none transition focus:border-pulp-text focus:ring-2 focus:ring-pulp-text/10";
const rand = (n: number) => "R" + (Number.isInteger(n) ? n : n.toFixed(2));

export default function OrderModal({ isOpen, onClose, products, prices, slots, depositPercent, earliestDate, blackouts, whatsappIntl }: Props) {
  const [step, setStep] = useState<Step>(1);
  const [mode, setMode] = useState<OrderMode>("Trio");
  const [flavors, setFlavors] = useState<Record<string, number>>({});
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [date, setDate] = useState("");
  const [slot, setSlot] = useState("");
  const [giftNote, setGiftNote] = useState("");
  const [terms, setTerms] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [website, setWebsite] = useState(""); // honeypot
  const [dateState, setDateState] = useState<DateState>({ state: "idle" });
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [result, setResult] = useState<Extract<OrderResult, { success: true }> | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const { total: price, pieces: totalSelected, made } = useMemo(() => orderTotal(mode, flavors, products, prices), [mode, flavors, products, prices]);
  const boxN = boxSize(mode);
  const isBox = boxN !== null;
  const maxAllowed = boxN ?? 60;
  const remaining = (boxN ?? 0) - totalSelected;
  const deposit = Math.round(price * depositPercent) / 100;
  const step1Valid = isBox ? totalSelected === boxN : totalSelected > 0;

  useEffect(() => {
    setFlavors(Object.fromEntries(products.map((p) => [p.id, 0])));
    setErrorMsg("");
  }, [mode, products]);

  // Lock page scroll and close on Escape while the dialog is open.
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && handleClose();
    window.addEventListener("keydown", onKey);
    panelRef.current?.focus();
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Ask the server whether the chosen date is open and has room.
  useEffect(() => {
    if (!date || totalSelected === 0) return setDateState({ state: "idle" });
    let cancelled = false;
    setDateState({ state: "checking" });
    checkDate(date, made)
      .then((r) => !cancelled && setDateState(r.ok ? { state: "ok", remaining: r.remaining } : { state: "bad", message: r.reason }))
      .catch(() => !cancelled && setDateState({ state: "idle" }));
    return () => {
      cancelled = true;
    };
  }, [date, totalSelected, made]);

  if (!isOpen) return null;

  const blocked = blackouts.find((b) => b.date === date);
  const step2Valid =
    name.trim().length > 1 && /^\S+@\S+\.\S+$/.test(email) && phone.replace(/\D/g, "").length >= 9 && !!slot && !!date && dateState.state === "ok" && !blocked;

  const updateFlavor = (id: string, change: number) => {
    const p = products.find((x) => x.id === id);
    if (!p) return;
    const next = totalSelected + change;
    if (next < 0 || next > maxAllowed || (flavors[id] ?? 0) + change < 0) return;
    setFlavors((p) => ({ ...p, [id]: (p[id] ?? 0) + change }));
    setErrorMsg("");
  };

  const handleClose = () => {
    onClose();
    // Reset after the dialog is gone so a finished order does not linger.
    setTimeout(() => {
      setStep(1); setMode("Trio"); setResult(null); setErrorMsg("");
      setName(""); setEmail(""); setPhone(""); setDate(""); setSlot(""); setGiftNote("");
      setTerms(false); setMarketing(false); setDateState({ state: "idle" });
    }, 200);
  };

  const handleSubmit = async () => {
    setErrorMsg("");
    if (!terms) return setErrorMsg("Please tick the box to agree to the Privacy & Terms.");
    setLoading(true);
    const res = await submitOrder({
      name, email, phone, date, pickupSlot: slot, giftNote, mode, items: flavors,
      acceptedTerms: terms, marketingConsent: marketing, website,
    });
    setLoading(false);
    if (res.success) setResult(res);
    else setErrorMsg(res.error);
  };

  const chosen = products.filter((p) => (flavors[p.id] ?? 0) > 0);
  const niceDate = date ? new Date(date + "T00:00:00Z").toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }) : "";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && handleClose()}>
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Place an order"
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-pulp-bg p-6 shadow-2xl outline-none sm:rounded-3xl"
      >
        {result ? (
          <div className="py-4 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-pulp-green/15 text-2xl text-pulp-green">✓</div>
            <h2 className="mb-2 font-serif text-3xl">Order received</h2>
            <p className="mb-5 text-sm text-gray-600">Your reference is</p>
            <p className="mb-5 inline-block rounded-lg bg-white px-4 py-2 font-mono text-lg font-bold tracking-wider">{result.orderRef}</p>
            <div className="mb-6 rounded-xl border border-pulp-border bg-white p-4 text-left text-sm leading-relaxed">
              <p className="mb-2 font-medium">Next step: we will WhatsApp you our banking details.</p>
              <p className="text-gray-600">
                Once you have them, pay your {depositPercent}% deposit of {rand(result.deposit)} within 24 hours and use <strong>{result.orderRef}</strong> as the payment reference. We confirm your order when the deposit arrives.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <a
                href={waLink(`Hi Pulp! I just placed order ${result.orderRef}.`, whatsappIntl)}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full bg-pulp-green px-6 py-3 text-sm font-medium uppercase tracking-widest text-white transition hover:opacity-90"
              >
                Message us on WhatsApp
              </a>
              <button onClick={handleClose} className="rounded-full border border-pulp-text px-6 py-3 text-sm uppercase tracking-widest transition hover:bg-pulp-text hover:text-pulp-bg">
                Close
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-serif text-2xl">Place your order</h2>
                <p className="text-xs uppercase tracking-widest text-gray-500">Step {step} of 3 · {step === 1 ? "Choose" : step === 2 ? "Your details" : "Review"}</p>
              </div>
              <button type="button" onClick={handleClose} aria-label="Close" className="text-3xl leading-none text-gray-500 hover:text-pulp-text">&times;</button>
            </div>
            <div className="flex gap-1.5" aria-hidden>
              {[1, 2, 3].map((n) => (
                <div key={n} className={`h-1 flex-1 rounded-full ${n <= step ? "bg-pulp-text" : "bg-pulp-border"}`} />
              ))}
            </div>

            {step === 1 && (
              <>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    ["Trio", "Trio", rand(prices.trio)],
                    ["Box of 6", "Box of 6", rand(prices.box6)],
                    ["Custom", "Singles", "Choose any"],
                  ] as const).map(([value, label, sub]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setMode(value)}
                      aria-pressed={mode === value}
                      className={`rounded-xl border px-2 py-3 text-center transition ${mode === value ? "border-pulp-text bg-pulp-text text-pulp-bg" : "border-pulp-border bg-white hover:border-pulp-text"}`}
                    >
                      <span className="block font-serif text-base">{label}</span>
                      <span className="block text-xs opacity-80">{sub}</span>
                    </button>
                  ))}
                </div>

                <div className="rounded-xl border border-pulp-border bg-white p-4">
                  <div className="mb-3 flex items-center justify-between border-b border-gray-100 pb-2">
                    <p className="text-sm font-medium">Choose flavours</p>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${isBox ? (remaining === 0 ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800") : totalSelected > 0 ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-500"}`}>
                      {isBox ? (remaining === 0 ? "Perfect!" : `${remaining} to go`) : `${totalSelected} selected`}
                    </span>
                  </div>
                  {products.map((p) => (
                    <div key={p.id} className="mb-3 flex items-center justify-between last:mb-0">
                      <span className="font-serif text-base">{p.name}<span className="ml-2 font-sans text-xs text-gray-500">{isBox ? (packSize(p) > 1 ? `pack of ${packSize(p)}` : "") : priceLabel(p)}</span></span>
                      <div className="flex items-center gap-3">
                        <button type="button" aria-label={`Remove one ${p.name}`} onClick={() => updateFlavor(p.id, -1)} disabled={!flavors[p.id]} className="h-9 w-9 rounded-full border border-gray-300 bg-white text-lg disabled:cursor-not-allowed disabled:opacity-30">−</button>
                        <span className="w-5 text-center font-medium tabular-nums">{flavors[p.id] || 0}</span>
                        <button type="button" aria-label={`Add one ${p.name}`} onClick={() => updateFlavor(p.id, 1)} disabled={totalSelected + 1 > maxAllowed} className="h-9 w-9 rounded-full border border-gray-300 bg-white text-lg disabled:cursor-not-allowed disabled:opacity-30">+</button>
                      </div>
                    </div>
                  ))}
                </div>

                {mode === "Custom" && ((totalSelected === 3 && price > prices.trio) || (totalSelected === 6 && price > prices.box6)) && (
                  <p className="rounded-xl border border-emerald-500 bg-emerald-50 p-3 text-sm text-emerald-900">
                    <strong>Sweet tip:</strong> a {totalSelected === 3 ? `Trio is ${rand(prices.trio)}` : `Box of 6 is ${rand(prices.box6)}`}. Switch to the box and save {rand(price - (totalSelected === 3 ? prices.trio : prices.box6))}.
                  </p>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Total</span>
                  <span className="font-serif text-2xl">{rand(price)}</span>
                </div>
                <button type="button" disabled={!step1Valid} onClick={() => setStep(2)} className="rounded-full bg-pulp-text py-4 text-sm uppercase tracking-widest text-pulp-bg transition disabled:cursor-not-allowed disabled:opacity-40">
                  Continue
                </button>
              </>
            )}

            {step === 2 && (
              <>
                <input type="text" placeholder="Full name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
                <input type="email" placeholder="Email address" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
                <input type="tel" placeholder="WhatsApp number" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} />
                {/* Honeypot: hidden from people, bots fill it in. */}
                <input type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} className="hidden" aria-hidden />

                <div>
                  <label className="mb-1 block text-sm font-medium" htmlFor="pulp-date">When would you like to collect?</label>
                  <input id="pulp-date" type="date" min={earliestDate} value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
                  <p className={`mt-1 text-xs ${dateState.state === "bad" ? "font-medium text-red-600" : dateState.state === "ok" ? "text-emerald-700" : "text-gray-500"}`} role="status">
                    {dateState.state === "checking" && "Checking availability…"}
                    {dateState.state === "bad" && dateState.message}
                    {dateState.state === "ok" && (dateState.remaining != null && dateState.remaining <= 12 ? `Available, only ${dateState.remaining} left that day.` : "That date is available.")}
                    {dateState.state === "idle" && "We need a little notice to make everything fresh."}
                  </p>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium" htmlFor="pulp-slot">Collection time</label>
                  <select id="pulp-slot" value={slot} onChange={(e) => setSlot(e.target.value)} className={inputCls}>
                    <option value="">Choose a time</option>
                    {slots.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <p className="mt-1 text-xs text-gray-500">We confirm the exact collection details with you on WhatsApp.</p>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium" htmlFor="pulp-gift">Gift note <span className="font-normal text-gray-500">(optional)</span></label>
                  <textarea id="pulp-gift" maxLength={200} rows={2} placeholder="Happy birthday, Sam!" value={giftNote} onChange={(e) => setGiftNote(e.target.value)} className={inputCls} />
                </div>

                <div className="flex gap-3">
                  <button type="button" onClick={() => setStep(1)} className="flex-1 rounded-full border border-pulp-text py-4 text-sm uppercase tracking-widest">Back</button>
                  <button type="button" disabled={!step2Valid} onClick={() => setStep(3)} className="flex-[2] rounded-full bg-pulp-text py-4 text-sm uppercase tracking-widest text-pulp-bg transition disabled:cursor-not-allowed disabled:opacity-40">Review order</button>
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <div className="rounded-xl border border-pulp-border bg-white p-4 text-sm">
                  <p className="mb-2 font-serif text-lg">{mode === "Custom" ? `Custom selection (${totalSelected})` : mode}</p>
                  <ul className="mb-3 space-y-1 text-gray-700">
                    {chosen.map((p) => <li key={p.id} className="flex justify-between"><span>{p.name}</span><span>{packSize(p) > 1 ? `${flavors[p.id]} × pack of ${packSize(p)}` : `×${flavors[p.id]}`}</span></li>)}
                  </ul>
                  <dl className="space-y-1 border-t border-gray-100 pt-3 text-gray-700">
                    <div className="flex justify-between gap-4"><dt>Collect</dt><dd className="text-right">{niceDate}, {slot}</dd></div>
                    <div className="flex justify-between gap-4"><dt>Name</dt><dd>{name}</dd></div>
                    <div className="flex justify-between gap-4"><dt>WhatsApp</dt><dd>{phone}</dd></div>
                    <div className="flex justify-between gap-4"><dt>Email</dt><dd>{email}</dd></div>
                    {giftNote && <div className="flex justify-between gap-4"><dt>Gift note</dt><dd className="text-right">{giftNote}</dd></div>}
                  </dl>
                  <div className="mt-3 flex items-baseline justify-between border-t border-gray-100 pt-3">
                    <span className="font-medium">Total</span>
                    <span className="font-serif text-2xl">{rand(price)}</span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">Pay a {depositPercent}% deposit ({rand(deposit)}) by EFT within 24 hours to confirm. Details are emailed after you order.</p>
                </div>

                <label className="flex items-start gap-3 text-sm">
                  <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-1 h-4 w-4 accent-pulp-text" />
                  <span>I agree to the <a href="/privacy" target="_blank" className="underline">Privacy &amp; Terms</a>. <span className="text-red-600">*</span></span>
                </label>
                <label className="flex items-start gap-3 text-sm text-gray-700">
                  <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} className="mt-1 h-4 w-4 accent-pulp-text" />
                  <span>Send me news and offers from {SHOP.name} by WhatsApp or email. I can opt out any time. <span className="text-gray-500">(optional)</span></span>
                </label>

                {errorMsg && <p role="alert" className="text-sm font-medium text-red-600">{errorMsg}</p>}

                <div className="flex gap-3">
                  <button type="button" onClick={() => setStep(2)} disabled={loading} className="flex-1 rounded-full border border-pulp-text py-4 text-sm uppercase tracking-widest">Back</button>
                  <button type="button" onClick={handleSubmit} disabled={loading || !terms} className="flex-[2] rounded-full bg-pulp-text py-4 text-sm uppercase tracking-widest text-pulp-bg transition disabled:cursor-not-allowed disabled:opacity-40">
                    {loading ? "Placing order…" : `Confirm order · ${rand(price)}`}
                  </button>
                </div>
              </>
            )}

            {step !== 3 && errorMsg && <p role="alert" className="text-sm font-medium text-red-600">{errorMsg}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
