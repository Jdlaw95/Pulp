import { NextResponse } from "next/server";
import { isAllowed, userDb } from "../../lib/auth";
import { loadOrders } from "../data";
import { formatBreakdown, statusLabel } from "../../lib/types";

// Spreadsheet programs run text that starts with these as formulas, so defuse them.
const cell = (v: unknown) => {
  let s = String(v ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
};

export async function GET(request: Request) {
  const db = await userDb();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user || !isAllowed(user.email)) return new NextResponse("Unauthorized", { status: 401 });

  const sp = new URL(request.url).searchParams;
  const orders = await loadOrders(db, {
    q: sp.get("q") ?? undefined,
    status: sp.get("status") ?? undefined,
    from: sp.get("from") ?? undefined,
    to: sp.get("to") ?? undefined,
  });

  const header = ["Order ref", "Ordered", "Collect date", "Collect time", "Status", "Name", "Email", "Phone", "Order", "Gift note", "Total (ZAR)", "Marketing consent"];
  const rows = orders.map((o) => [
    o.order_ref, o.created_at, o.requested_date, o.pickup_slot ?? "", statusLabel(o.status), o.customer_name, o.customer_email,
    o.customer_phone, `${o.box_type ? o.box_type + ": " : ""}${formatBreakdown(o)}`, o.gift_note ?? "", o.total_zar, o.marketing_consent ? "yes" : "no",
  ]);
  const csv = [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="pulp-orders-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
