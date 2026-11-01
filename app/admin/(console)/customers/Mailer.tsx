"use client";

import { useState } from "react";
import { sendMailer } from "../../actions";

const field = "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm";

export default function Mailer({ recipients }: { recipients: number }) {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const go = async (test: boolean) => {
    setBusy(true);
    setMsg(null);
    const r = await sendMailer(subject, body, test);
    setBusy(false);
    setConfirm(false);
    setMsg({ ok: r.ok, text: r.message ?? (r.ok ? "Sent." : "Could not send.") });
    if (r.ok && !test) { setSubject(""); setBody(""); }
  };

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-xl">Send a mailer</h2>
          <p className="text-sm text-gray-600">Goes only to the {recipients} {recipients === 1 ? "person" : "people"} who agreed to marketing. Every email has an unsubscribe link.</p>
        </div>
        <button onClick={() => setOpen((o) => !o)} className="rounded-lg bg-pulp-text px-4 py-2 text-sm text-white">{open ? "Close" : "Write mailer"}</button>
      </div>
      {open && (
        <div className="mt-4 space-y-3">
          <input className={field} placeholder="Subject" maxLength={150} value={subject} onChange={(e) => setSubject(e.target.value)} />
          <textarea className={field} rows={8} placeholder={"Hi there,\n\nWrite your message here. Leave a blank line between paragraphs."} maxLength={5000} value={body} onChange={(e) => setBody(e.target.value)} />
          <p className="text-xs text-gray-500">Plain text. We add the Pulp header, a sign-off and the unsubscribe line for you.</p>
          {msg && <p role="status" className={`text-sm font-medium ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>{msg.text}</p>}
          <div className="flex flex-wrap items-center gap-3">
            <button disabled={busy} onClick={() => go(true)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm disabled:opacity-50">Send test to me</button>
            {confirm ? (
              <span className="flex items-center gap-2 text-sm">
                <span>Send to {recipients} {recipients === 1 ? "person" : "people"}?</span>
                <button disabled={busy} onClick={() => go(false)} className="rounded-lg bg-red-600 px-3 py-2 font-medium text-white disabled:opacity-50">{busy ? "Sending…" : "Yes, send"}</button>
                <button disabled={busy} onClick={() => setConfirm(false)} className="rounded-lg border border-gray-300 px-3 py-2">Cancel</button>
              </span>
            ) : (
              <button disabled={busy || recipients === 0 || subject.trim().length < 3 || body.trim().length < 10} onClick={() => setConfirm(true)} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40">Send to customers</button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
