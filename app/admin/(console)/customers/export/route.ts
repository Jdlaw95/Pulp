import { NextResponse } from "next/server";
import { isAllowed, userDb } from "../../../../lib/auth";
import { groupCustomers } from "../../../../lib/customers";
import type { Order } from "../../../../lib/types";

const cell = (v: unknown) => {
  let s = String(v ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
};

export async function GET() {
  const db = await userDb();
  const { data: { user } } = await db.auth.getUser();
  if (!user || !isAllowed(user.email)) return new NextResponse("Unauthorized", { status: 401 });

  const { data } = await db.from("orders").select("id, customer_name, customer_email, customer_phone, total_zar, status, created_at, marketing_consent").limit(5000);
  const list = groupCustomers((data ?? []) as Order[]).filter((c) => c.consent);
  const csv = [["Name", "Email", "Phone", "Orders", "Spent (ZAR)", "Last order"], ...list.map((c) => [c.name, c.email, c.phone, c.orders, c.spent, c.lastOrder.slice(0, 10)])]
    .map((r) => r.map(cell).join(",")).join("\r\n");
  return new NextResponse(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="pulp-marketing-list-${new Date().toISOString().slice(0, 10)}.csv"`, "Cache-Control": "no-store" },
  });
}
