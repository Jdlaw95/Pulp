import { NextResponse } from "next/server";
import { hasServiceKey, serverDb } from "../../../../lib/supabase";
import { isAllowed, userDb } from "../../../../lib/auth";
import { groupCustomers } from "../../../../lib/customers";
import type { Order } from "../../../../lib/types";
import { rand } from "../../../../lib/types";
import { fmtDate, todaySAST } from "../../../../lib/dates";
import { pdfResponse, tablePdf } from "../../../../lib/pdf";

export async function GET() {
  const authDb = await userDb();
  const { data: { user } } = await authDb.auth.getUser();
  if (!user || !isAllowed(user.email)) return new NextResponse("Unauthorized", { status: 401 });
  const db = hasServiceKey() ? serverDb() : authDb;

  const { data } = await db.from("orders").select("id, customer_name, customer_email, customer_phone, total_zar, status, created_at, marketing_consent").limit(5000);
  const list = groupCustomers((data ?? []) as Order[]).filter((c) => c.consent);

  const pdf = tablePdf({
    title: "Marketing list",
    subtitle: `${list.length} customer${list.length === 1 ? "" : "s"} who agreed to marketing`,
    head: ["Name", "Email", "Phone", "Orders", "Spent", "Last order"],
    rows: list.map((c) => [c.name, c.email, c.phone, c.orders, rand(c.spent), fmtDate(c.lastOrder.slice(0, 10))]),
    columnStyles: { 3: { halign: "right", cellWidth: 16 }, 4: { halign: "right", cellWidth: 20 }, 5: { cellWidth: 24 } },
  });

  return pdfResponse(pdf, `pulp-marketing-list-${todaySAST()}.pdf`);
}
