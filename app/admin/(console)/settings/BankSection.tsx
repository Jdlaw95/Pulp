"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { lockBank, saveBank, setBankCode, unlockBank } from "../../actions";
import type { Bank } from "../../../lib/bank";

const field = "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm";
const label = "mb-1 block text-sm font-medium";
type Msg = { ok: boolean; text: string } | null;

export default function BankSection({ tableMissing, hasCode, bank }: { tableMissing: boolean; hasCode: boolean; bank: Bank | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const [code, setCode] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [changing, setChanging] = useState(false);
  const [f, setF] = useState<Bank>(bank ?? { name: "", accountName: "", accountNumber: "", branchCode: "" });

  const run = async (fn: () => Promise<{ ok: boolean; message?: string }>, okText?: string) => {
    setBusy(true);
    setMsg(null);
    const r = await fn();
    setBusy(false);
    setMsg({ ok: r.ok, text: r.message ?? (r.ok ? okText ?? "Done" : "Something went wrong") });
    if (r.ok) { setCode(""); setNext(""); setAgain(""); setChanging(false); router.refresh(); }
    return r.ok;
  };

  const shell = (children: React.ReactNode) => (
    <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-5">
      <div>
        <h2 className="font-serif text-xl">Bank details</h2>
        <p className="text-xs text-gray-500">Emailed to customers with their order. Protected by a security code that only you know.</p>
      </div>
      {children}
      {msg && <p role="status" className={`text-sm font-medium ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>{msg.text}</p>}
    </section>
  );

  if (tableMissing)
    return shell(<p className="text-sm text-amber-800">One database step is missing. Run <code>supabase/pulp-upgrade.sql</code> in the Supabase SQL editor, then refresh this page.</p>);

  // No code yet: choose one first.
  if (!hasCode)
    return shell(
      <form onSubmit={(e) => { e.preventDefault(); if (next !== again) return setMsg({ ok: false, text: "The two codes do not match." }); run(() => setBankCode("", next)); }} className="space-y-3">
        <p className="text-sm text-gray-700">Choose a security code (at least 6 characters). You will need it each time you open or change these details. If you forget it, it can only be reset in Supabase.</p>
        <div><label className={label} htmlFor="b-new">New code</label><input id="b-new" type="password" autoComplete="new-password" className={field} value={next} onChange={(e) => setNext(e.target.value)} /></div>
        <div><label className={label} htmlFor="b-again">Repeat code</label><input id="b-again" type="password" autoComplete="new-password" className={field} value={again} onChange={(e) => setAgain(e.target.value)} /></div>
        <button disabled={busy || next.length < 6} className="rounded-lg bg-pulp-text px-4 py-2 text-sm font-bold text-white disabled:opacity-40">{busy ? "Saving…" : "Set code"}</button>
      </form>
    );

  // Locked.
  if (!bank)
    return shell(
      <form onSubmit={(e) => { e.preventDefault(); run(() => unlockBank(code)); }} className="space-y-3">
        <div><label className={label} htmlFor="b-code">Security code</label><input id="b-code" type="password" autoComplete="off" className={field} value={code} onChange={(e) => setCode(e.target.value)} /></div>
        <button disabled={busy || !code} className="rounded-lg bg-pulp-text px-4 py-2 text-sm font-bold text-white disabled:opacity-40">{busy ? "Checking…" : "Unlock"}</button>
      </form>
    );

  // Unlocked for ten minutes.
  return shell(
    <>
      <form onSubmit={(e) => { e.preventDefault(); run(() => saveBank(f), "Saved"); }} className="space-y-3">
        <div><label className={label} htmlFor="b-bank">Bank</label><input id="b-bank" className={field} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
        <div><label className={label} htmlFor="b-an">Account name</label><input id="b-an" className={field} value={f.accountName} onChange={(e) => setF({ ...f, accountName: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={label} htmlFor="b-num">Account number</label><input id="b-num" inputMode="numeric" className={field} value={f.accountNumber} onChange={(e) => setF({ ...f, accountNumber: e.target.value })} /></div>
          <div><label className={label} htmlFor="b-br">Branch code</label><input id="b-br" inputMode="numeric" className={field} value={f.branchCode} onChange={(e) => setF({ ...f, branchCode: e.target.value })} /></div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button disabled={busy} className="rounded-lg bg-pulp-text px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{busy ? "Saving…" : "Save bank details"}</button>
          <button type="button" disabled={busy} onClick={() => run(lockBank)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm">Lock now</button>
          <button type="button" onClick={() => setChanging((c) => !c)} className="px-2 py-2 text-sm text-gray-600 underline">Change code</button>
        </div>
        <p className="text-xs text-gray-500">This locks itself again after 10 minutes.</p>
      </form>
      {changing && (
        <form onSubmit={(e) => { e.preventDefault(); if (next !== again) return setMsg({ ok: false, text: "The two new codes do not match." }); run(() => setBankCode(code, next), "Code changed"); }} className="space-y-3 border-t border-gray-100 pt-4">
          <div><label className={label} htmlFor="b-cur">Current code</label><input id="b-cur" type="password" autoComplete="off" className={field} value={code} onChange={(e) => setCode(e.target.value)} /></div>
          <div><label className={label} htmlFor="b-n2">New code</label><input id="b-n2" type="password" autoComplete="new-password" className={field} value={next} onChange={(e) => setNext(e.target.value)} /></div>
          <div><label className={label} htmlFor="b-a2">Repeat new code</label><input id="b-a2" type="password" autoComplete="new-password" className={field} value={again} onChange={(e) => setAgain(e.target.value)} /></div>
          <button disabled={busy || next.length < 6 || !code} className="rounded-lg bg-pulp-text px-4 py-2 text-sm font-bold text-white disabled:opacity-40">Change code</button>
        </form>
      )}
    </>
  );
}
