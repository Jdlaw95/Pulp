import { publicDb } from "./supabase";
import { DEFAULT_PRICES, type Prices } from "./pricing";
import { contactFromRow, defaultContact, type Contact } from "./contact";

export type Settings = {
  orders_open: boolean;
  prices: Prices;
  daily_capacity: number | null; // max pieces per collection date; null = no limit
  min_notice_days: number;
  cutoff_hour: number | null; // after this hour (SAST) the earliest date moves out a day
  pickup_slots: string[];
  deposit_percent: number;
  contact: Contact; // public WhatsApp number and social links
};

export const DEFAULT_SETTINGS: Settings = {
  orders_open: true,
  prices: DEFAULT_PRICES,
  daily_capacity: null,
  min_notice_days: 2,
  cutoff_hour: null,
  pickup_slots: ["Morning (9am to 12pm)", "Afternoon (12pm to 4pm)", "Evening (4pm to 6pm)"],
  deposit_percent: 50,
  contact: defaultContact(),
};

type Row = {
  orders_open?: boolean | null;
  price_trio?: number | null;
  price_box6?: number | null;
  daily_capacity?: number | null;
  min_notice_days?: number | null;
  cutoff_hour?: number | null;
  pickup_slots?: string[] | null;
  deposit_percent?: number | null;
  whatsapp?: string | null;
  social_instagram?: string | null;
  social_facebook?: string | null;
  social_tiktok?: string | null;
};

export function rowToSettings(row: Row | null | undefined): Settings {
  const d = DEFAULT_SETTINGS;
  if (!row) return d;
  return {
    orders_open: row.orders_open ?? d.orders_open,
    prices: {
      trio: Number(row.price_trio ?? d.prices.trio),
      box6: Number(row.price_box6 ?? d.prices.box6),
    },
    daily_capacity: row.daily_capacity ?? null,
    min_notice_days: row.min_notice_days ?? d.min_notice_days,
    cutoff_hour: row.cutoff_hour ?? null,
    pickup_slots: row.pickup_slots && row.pickup_slots.length ? row.pickup_slots : d.pickup_slots,
    deposit_percent: row.deposit_percent ?? d.deposit_percent,
    contact: contactFromRow(row),
  };
}

/** Reads shop settings; falls back to defaults if the table has not been created yet. */
export async function getSettings(): Promise<Settings> {
  try {
    const { data, error } = await publicDb().from("shop_settings").select("*").eq("id", 1).maybeSingle();
    if (error) return DEFAULT_SETTINGS;
    return rowToSettings(data);
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function getBlackoutDates(): Promise<{ date: string; reason: string | null }[]> {
  try {
    const { data, error } = await publicDb().from("blackout_dates").select("date, reason").order("date");
    if (error || !data) return [];
    return data as { date: string; reason: string | null }[];
  } catch {
    return [];
  }
}
