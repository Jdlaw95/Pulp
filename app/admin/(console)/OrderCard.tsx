"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { deleteOrder, setOrderStatus } from "../actions";
import { NEXT_STATUS, STATUSES, formatBreakdown, rand, type Order } from "../../lib/types";
import { toIntlPhone, waLink } from "../../lib/config";
import { fmtDate } from "../../lib/dates";
import type { Bank } from "../../lib/bank";

const colors: Record<string, string> = {
  pending_payment: "bg-amber-100 text-amber-800 border-amber-200",
  confirmed: "bg-blue-100 text-blue-800 border-blue-200",
  ready: "bg-purple-100 text-purple-800 border-purple-200",
  collected: "bg-emerald-100 text-emerald-800 border-emerald-200",
  cancelled: "bg-red-100 text-red-800 border-red-200",
};

function bankLines(bank: Bank | null): string {
  if (!bank || !bank.accountNumber) return "(banking details not set yet, add them in Settings)";
  return [
    bank.name && `Bank: ${bank.name}`,
    bank.accountName && `Name: ${bank.accountName}`,
    `Account no: ${bank.accountNumber}`,
    bank.branchCode && `Branch code: ${bank.branchCode}`,
  ].filter(Boolean).join("\n");
}

// WhatsApp shows *text* in bold and _text_ in italics. Blank lines keep the message from reading as one block.
function whatsappText(o: Order, bank: Bank | null, deposit: number): string {
  const first = o.customer_name.split(" ")[0];
  const when = fmtDate(o.requested_date);
  const collect = o.pickup_slot ? `${when}, ${o.pickup_slot}` : when;
  switch (o.status) {
    case "pending_payment":
      return [
        `Hi ${first}! \u{1F353} Thanks for your Pulp order.`,
        "",
        `*Order ${o.order_ref}*`,
        formatBreakdown(o),
        `Collection: ${collect}`,
        `Total: ${rand(Number(o.total_zar))}`,
        "",
        `To confirm it, please pay a *${rand(deposit)} deposit* by EFT within 24 hours.`,
        "",
        "*Banking details*",
        bankLines(bank),
        `Reference: *${o.order_ref}*`,
        "",
        "Send your proof of payment here once it is done and we will confirm your order.",
        "",
        "Thank you! \u{1F343}",
        "_Pulp · Illusion Collection_",
      ].join("\n");
    case "confirmed":
      return `Hi ${first}! \u{1F353}\n\nYour deposit is in and your order *${o.order_ref}* is confirmed for ${collect}.\n\nWe will let you know as soon as it is ready.\n\nThank you! \u{1F343}\n_Pulp · Illusion Collection_`;
    case "ready":
      return `Hi ${first}! \u{1F353}\n\nYour order *${o.order_ref}* is ready for collection.\n\nWhen suits you to pop by?\n\n_Pulp · Illusion Collection_`;
    default:
      return `Hi ${first}! A quick note about your Pulp order ${o.order_ref}.`;
  }
}

export default function OrderCard({ order, depositPercent, bank }: { order: Order; depositPercent: number; bank: Bank | null }) {
  const [status, setStatus] = useState(order.status);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [gone, setGone] = useState(false);
  const next = NEXT_STATUS[status];
  const deposit = (Number(order.total_zar) * depositPercent) / 100;

  const change = (value: string) => {
    const prev = status;
    setStatus(value);
    setError("");
    start(async () => {
      const r = await setOrderStatus(order.id, value);
      if (!r.ok) {
        setStatus(prev);
        setError(r.message ?? "Could not update");
      }
    });
  };

  const remove = () =>
    start(async () => {
      const r = await deleteOrder(order.id);
      if (!r.ok) {
        setError(r.message ?? "Could not delete");
        setConfirmDelete(false);
        return;
      }
      setGone(true);
      router.refresh();
    });

  if (gone) return null;

  return (
    <article className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="rounded bg-gray-100 px-2 py-1 font-mono text-base font-bold">{order.order_ref}</span>
          <span className={`rounded-full border px-3 py-1 text-xs font-bold ${colors[status] ?? "bg-gray-100 text-gray-700 border-gray-200"}`}>
            {STATUSES.find((s) => s.value === status)?.label ?? status}
          </span>
        </div>
        <span className="text-xs text-gray-500">Ordered {new Date(order.created_at).toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Johannesburg" })}</span>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="font-semibold">{order.customer_name}</p>
          <p className="text-sm text-gray-600">{order.customer_phone}</p>
          <p className="text-sm text-gray-600">{order.customer_email}</p>
          {order.marketing_consent && <p className="mt-1 text-xs text-emerald-700">Agreed to marketing</p>}
        </div>
        <div className="text-sm">
          <p><span className="font-medium">Collect:</span> {fmtDate(order.requested_date, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}{order.pickup_slot ? `, ${order.pickup_slot}` : ""}</p>
          <p><span className="font-medium">Order:</span> {order.box_type ? `${order.box_type}: ` : ""}{formatBreakdown(order)}</p>
          <p><span className="font-medium">Total:</span> {rand(Number(order.total_zar))} <span className="text-gray-500">({depositPercent}% deposit {rand(deposit)})</span></p>
          {order.gift_note && <p className="mt-1 rounded bg-amber-50 px-2 py-1 text-amber-900">Gift note: {order.gift_note}</p>}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-gray-100 pt-4">
        {next && (
          <button onClick={() => change(next.value)} disabled={pending} className="rounded-lg bg-pulp-text px-4 py-2 text-sm font-medium text-white transition hover:bg-black disabled:opacity-50">
            {next.label}
          </button>
        )}
        <a href={waLink(whatsappText({ ...order, status }, bank, deposit), toIntlPhone(order.customer_phone))} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-emerald-600 px-4 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-50">
          {status === "pending_payment" ? "Send banking details" : "WhatsApp"}
        </a>
        <select value={status} onChange={(e) => change(e.target.value)} disabled={pending} aria-label="Change status" className="ml-auto rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm">
          {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <Link href={`/admin/orders/${order.id}/edit`} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50">Edit order</Link>
        {confirmDelete ? (
          <span className="flex items-center gap-2 text-sm">
            <span className="text-red-700">Delete {order.order_ref} for good?</span>
            <button onClick={remove} disabled={pending} className="rounded-lg bg-red-600 px-3 py-2 font-medium text-white disabled:opacity-50">Yes, delete</button>
            <button onClick={() => setConfirmDelete(false)} className="rounded-lg border border-gray-300 px-3 py-2">Keep</button>
          </span>
        ) : (
          <button onClick={() => setConfirmDelete(true)} className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-700 hover:bg-red-50">Delete</button>
        )}
      </div>
      {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
    </article>
  );
}
