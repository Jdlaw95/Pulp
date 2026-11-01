import type { Metadata } from "next";
import { requireAdmin } from "../../lib/auth";
import AdminNav from "./AdminNav";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireAdmin();
  return (
    <div className="min-h-screen bg-gray-100">
      <AdminNav email={user.email ?? ""} />
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">{children}</div>
    </div>
  );
}
