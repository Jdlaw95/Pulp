"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "../actions";

const links = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/production", label: "Production" },
  { href: "/admin/customers", label: "Customers" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/settings", label: "Settings" },
];

export default function AdminNav({ email }: { email: string }) {
  const path = usePathname();
  return (
    <header className="no-print border-b border-gray-200 bg-white">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-6 overflow-x-auto">
          <Link href="/admin" className="font-serif text-xl tracking-wide">Pulp</Link>
          <nav className="flex gap-1 text-sm">
            {links.map((l) => {
              const active = l.href === "/admin" ? path === "/admin" : path.startsWith(l.href);
              return (
                <Link key={l.href} href={l.href} className={`whitespace-nowrap rounded-lg px-3 py-2 transition ${active ? "bg-pulp-text text-pulp-bg" : "text-gray-600 hover:bg-gray-100"}`}>
                  {l.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex shrink-0 items-center gap-3 text-sm text-gray-500">
          <a href="/" target="_blank" className="hidden hover:text-pulp-text sm:inline">View site ↗</a>
          <span className="hidden max-w-[10rem] truncate lg:inline">{email}</span>
          <form action={logout}><button className="underline hover:text-pulp-text">Log out</button></form>
        </div>
      </div>
    </header>
  );
}
