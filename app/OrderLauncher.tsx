"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import OrderModal from "./OrderModal";
import type { Product } from "./lib/types";
import type { Prices } from "./lib/pricing";

type Config = {
  products: Product[];
  prices: Prices;
  slots: string[];
  depositPercent: number;
  earliestDate: string;
  blackouts: { date: string; reason: string | null }[];
  ordersOpen: boolean;
};

const Ctx = createContext<{ open: () => void; ordersOpen: boolean }>({ open: () => {}, ordersOpen: true });

/** Wrap the page once; every <OrderButton/> inside opens the same order dialog. */
export function OrderProvider({ children, ...config }: Config & { children: ReactNode }) {
  const [isOpen, setOpen] = useState(false);
  return (
    <Ctx.Provider value={{ open: () => config.ordersOpen && setOpen(true), ordersOpen: config.ordersOpen }}>
      {children}
      <OrderModal
        isOpen={isOpen}
        onClose={() => setOpen(false)}
        products={config.products}
        prices={config.prices}
        slots={config.slots}
        depositPercent={config.depositPercent}
        earliestDate={config.earliestDate}
        blackouts={config.blackouts}
      />
    </Ctx.Provider>
  );
}

export function OrderButton({ variant, label = "Order now" }: { variant: "hero" | "bar" | "link"; label?: string }) {
  const { open, ordersOpen } = useContext(Ctx);
  const cls =
    variant === "hero"
      ? "rounded-full bg-pulp-text px-10 py-4 text-sm uppercase tracking-widest text-pulp-bg transition hover:bg-black disabled:opacity-40"
      : variant === "bar"
        ? "w-full rounded-full bg-pulp-text py-4 text-sm uppercase tracking-widest text-pulp-bg shadow-lg transition hover:bg-black disabled:opacity-40"
        : "rounded-full border border-pulp-text px-5 py-2 text-xs uppercase tracking-widest transition hover:bg-pulp-text hover:text-pulp-bg disabled:opacity-40";
  return (
    <button type="button" disabled={!ordersOpen} onClick={open} className={cls}>
      {ordersOpen ? label : "Orders paused"}
    </button>
  );
}
