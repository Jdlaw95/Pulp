import { NextResponse } from "next/server";
import { hasServiceKey, serverDb } from "../../lib/supabase";
import { isAllowed, userDb } from "../../lib/auth";
import { loadOrders } from "../data";
import { formatBreakdown, rand, statusLabel } from "../../lib/types";
import { fmtDate, todaySAST } from "../../lib/dates";
import { pdfResponse, tablePdf } from "../../lib/pdf";

export async function GET(request: Request) {
  const authDb = await userDb();
  const {
    data: { user },
  } = await authDb.auth.getUser();
  if (!user || !isAllowed(user.email)) return new NextResponse("Unauthorized", { status: 401 });
  const db = hasServiceKey() ? serverDb() : authDb;

  const sp = new URL(request.url).searchParams;
  const filters = {
    q: sp.get("q") ?? undefined,
    status: sp.get("status") ?? undefined,
    from: sp.get("from") ?? undefined,
    to: sp.get("to") ?? undefined,
  };
  const orders = await loadOrders(db, filters);

  const parts = [
    filters.status && filters.status !== "all" ? statusLabel(filters.status) : "All statuses",
    filters.from || filters.to ? `collecting ${filters.from ? fmtDate(filters.from) : "…"} to ${filters.to ? fmtDate(filters.to) : "…"}` : null,
    filters.q ? `matching "${filters.q}"` : null,
  ].filter(Boolean);
  const total = orders.filter((o) => o.status !== "cancelled").reduce((a, o) => a + Number(o.total_zar), 0);

  const pdf = tablePdf({
    title: "Orders",
    subtitle: `${orders.length} order${orders.length === 1 ? "" : "s"} · ${parts.join(" · ")} · ${rand(total)} excluding cancelled`,
    landscape: true,
    head: ["Ref", "Ordered", "Collect", "Time", "Status", "Customer", "Phone", "Email", "Order", "Gift note", "Total"],
    rows: orders.map((o) => [
      o.order_ref,
      fmtDate(o.created_at.slice(0, 10)),
      fmtDate(o.requested_date),
      o.pickup_slot ?? "",
      statusLabel(o.status),
      o.customer_name,
      o.customer_phone,
      o.customer_email,
      `${o.box_type ? o.box_type + ": " : ""}${formatBreakdown(o)}`,
      o.gift_note ?? "",
      rand(Number(o.total_zar)),
    ]),
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 17 },
      2: { cellWidth: 19 },
      3: { cellWidth: 22 },
      4: { cellWidth: 20 },
      5: { cellWidth: 26 },
      6: { cellWidth: 22 },
      7: { cellWidth: 40 },
      9: { cellWidth: 28 },
      10: { cellWidth: 15, halign: "right" },
    },
  });

  return pdfResponse(pdf, `pulp-orders-${todaySAST()}.pdf`);
}
