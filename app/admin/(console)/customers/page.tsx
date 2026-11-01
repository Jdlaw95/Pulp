import Link from "next/link";
import { requireAdmin } from "../../../lib/auth";
import { groupCustomers } from "../../../lib/customers";
import { toIntlPhone, waLink } from "../../../lib/config";
import { rand, type Order } from "../../../lib/types";
import Mailer from "./Mailer";

type SP = { q?: string; show?: string };

export default async function CustomersPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const { db } = await requireAdmin();
  const { data } = await db.from("orders").select("id, customer_name, customer_email, customer_phone, total_zar, status, created_at, marketing_consent").limit(5000);
  const all = groupCustomers((data ?? []) as Order[]);
  const mailable = all.filter((c) => c.consent && c.email);
  const q = (sp.q ?? "").trim().toLowerCase();
  const onlyConsent = sp.show === "consent";
  const rows = all.filter((c) => (!onlyConsent || c.consent) && (!q || [c.name, c.email, c.phone].some((v) => v.toLowerCase().includes(q))));

  const tab = (show: string, label: string) => (
    <Link href={show ? `/admin/customers?show=${show}` : "/admin/customers"} className={`rounded-full border border-gray-200 px-3 py-1.5 text-sm ${(onlyConsent ? "consent" : "") === show ? "bg-pulp-text text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>{label}</Link>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl">Customers</h1>
          <p className="text-sm text-gray-600">{all.length} customers, {all.filter((c) => c.consent).length} agreed to marketing ({mailable.length} with an email).</p>
        </div>
        <a href="/admin/customers/export" className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm hover:bg-gray-50">Export marketing list (CSV)</a>
      </div>

      <Mailer recipients={mailable.length} emailReady={Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD)} />

      <div className="flex flex-wrap items-center gap-2">
        <form method="get" className="flex min-w-0 flex-1 gap-2">
          {onlyConsent && <input type="hidden" name="show" value="consent" />}
          <input name="q" defaultValue={sp.q} placeholder="Search name, email or phone" className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm" />
          <button className="rounded-lg bg-pulp-text px-4 py-2 text-sm text-white">Search</button>
        </form>
        {tab("", "Everyone")}
        {tab("consent", "Agreed to marketing")}
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
            <tr><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Orders</th><th className="px-4 py-3">Spent</th><th className="px-4 py-3">Last order</th><th className="px-4 py-3">Marketing</th><th className="px-4 py-3" /></tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No customers match.</td></tr>}
            {rows.map((c) => (
              <tr key={c.key} className="border-b border-gray-100 last:border-0">
                <td className="px-4 py-3"><p className="font-medium">{c.name}</p><p className="text-xs text-gray-500">{c.email || "no email"} · {c.phone}</p></td>
                <td className="px-4 py-3 tabular-nums">{c.orders}</td>
                <td className="px-4 py-3 tabular-nums">{rand(c.spent)}</td>
                <td className="px-4 py-3 text-gray-600">{new Date(c.lastOrder).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Johannesburg" })}</td>
                <td className="px-4 py-3">{c.consent ? <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-800">Agreed</span> : <span className="text-xs text-gray-400">No</span>}</td>
                <td className="px-4 py-3 text-right">{c.phone && <a href={waLink(`Hi ${c.name.split(" ")[0]}!`, toIntlPhone(c.phone))} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-emerald-700 underline">WhatsApp</a>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
