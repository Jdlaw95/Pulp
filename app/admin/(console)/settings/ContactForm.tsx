"use client";

import { useActionState } from "react";
import { saveContact } from "../../actions";
import type { Contact } from "../../../lib/contact";

const field = "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm";
const label = "mb-1 block text-sm font-medium";

export default function ContactForm({ contact }: { contact: Contact }) {
  const [state, action, pending] = useActionState(saveContact, null);
  const url = (name: string) => contact.socials.find((s) => s.label === name)?.url ?? "";
  return (
    <form action={action} className="space-y-4 rounded-xl border border-gray-200 bg-white p-5">
      <div>
        <h2 className="font-serif text-xl">WhatsApp and socials</h2>
        <p className="text-xs text-gray-500">Shown on the website footer, the order confirmation and the privacy page.</p>
      </div>
      <div>
        <label className={label} htmlFor="c-wa">WhatsApp number</label>
        <input id="c-wa" name="whatsapp" type="tel" required defaultValue={contact.whatsappDisplay} className={field} />
      </div>
      {[
        ["instagram", "Instagram", "Instagram"],
        ["facebook", "Facebook", "Facebook"],
        ["tiktok", "TikTok", "TikTok"],
      ].map(([key, name]) => (
        <div key={key}>
          <label className={label} htmlFor={`c-${key}`}>{name}</label>
          <input id={`c-${key}`} name={key} defaultValue={url(name)} placeholder="@handle or a link. Leave empty to hide." className={field} />
        </div>
      ))}
      {state && <p role="status" className={`text-sm font-medium ${state.ok ? "text-emerald-700" : "text-red-600"}`}>{state.message}</p>}
      <button disabled={pending} className="rounded-lg bg-pulp-text px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{pending ? "Saving…" : "Save"}</button>
    </form>
  );
}
