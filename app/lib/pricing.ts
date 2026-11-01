export type OrderMode = "Trio" | "Box of 6" | "Custom";

export type Prices = { trio: number; box6: number };

export const DEFAULT_PRICES: Prices = { trio: 75, box6: 150 };

// Existing "bundle" product rows in Supabase that order_items point at.
export const BOX_PRODUCT_IDS = {
  Trio: "fbdef79c-569a-4321-884a-cfb25b5f31d5",
  "Box of 6": "40f13357-a558-418c-b57d-a15298cc796e",
} as const;

export type Sellable = { id: string; price_zar: number; pack_size?: number | null };

export function boxSize(mode: OrderMode): number | null {
  return mode === "Trio" ? 3 : mode === "Box of 6" ? 6 : null;
}

/** Pieces in one sale of this product: 1 normally, 2 for something sold as "R28 for 2". */
export function packSize(p: { pack_size?: number | null }): number {
  return Math.max(1, Math.floor(Number(p.pack_size) || 1));
}

const money = (n: number) => "R" + (Number.isInteger(n) ? n : n.toFixed(2));

export function priceLabel(p: { price_zar: number; pack_size?: number | null }): string {
  const n = packSize(p);
  return n > 1 ? `${money(Number(p.price_zar))} for ${n}` : `${money(Number(p.price_zar))} each`;
}

/**
 * The one place prices are worked out, used by the order form for display and by the server as the source of truth.
 * `units` is quantity per product: pieces inside a Trio / Box of 6, or packs when picking singles.
 * Boxes are a fixed price but count one place per pick (a pack of 2 is still one pick); singles are each product's own price per pack.
 */
export function orderTotal(mode: OrderMode, units: Record<string, number>, products: Sellable[], prices: Prices) {
  const byId = new Map(products.map((p) => [p.id, p]));
  let pieces = 0; // places used in a box: every pick counts as 1, whatever is in the pack
  let made = 0; // what we actually make and package (a pack of 2 is 2)
  let unitCount = 0;
  let custom = 0;
  for (const [id, qty] of Object.entries(units)) {
    const p = byId.get(id);
    if (!p || !qty) continue;
    unitCount += qty;
    pieces += qty;
    made += qty * packSize(p);
    custom += qty * Number(p.price_zar);
  }
  const total = mode === "Trio" ? prices.trio : mode === "Box of 6" ? prices.box6 : Math.round(custom * 100) / 100;
  return { total, pieces, made, units: unitCount };
}
