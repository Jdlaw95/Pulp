import { SHOP, SOCIALS, toIntlPhone } from "./config";

export type Social = { label: string; url: string };
export type Contact = { whatsappIntl: string; whatsappDisplay: string; socials: Social[] };

type Platform = { key: "instagram" | "facebook" | "tiktok"; label: string; hosts: string[]; build: (handle: string) => string };

export const PLATFORMS: Platform[] = [
  { key: "instagram", label: "Instagram", hosts: ["instagram.com"], build: (h) => `https://www.instagram.com/${h}` },
  { key: "facebook", label: "Facebook", hosts: ["facebook.com", "fb.com", "fb.me"], build: (h) => `https://www.facebook.com/${h}` },
  { key: "tiktok", label: "TikTok", hosts: ["tiktok.com"], build: (h) => `https://www.tiktok.com/@${h}` },
];

/** 27695155899 -> "069 515 5899"; other countries show as +digits. */
export function formatPhone(intl: string): string {
  if (/^27\d{9}$/.test(intl)) return `0${intl.slice(2, 4)} ${intl.slice(4, 7)} ${intl.slice(7)}`;
  return "+" + intl;
}

export function parsePhone(input: string): { ok: true; intl: string } | { ok: false; message: string } {
  const intl = toIntlPhone(input.trim().replace(/^\+/, ""));
  if (!/^\d{9,15}$/.test(intl)) return { ok: false, message: "That WhatsApp number does not look right. Use the full number, for example 069 515 5899." };
  return { ok: true, intl };
}

/** Accepts a handle (@name or name) or a full link on the platform's own site. Empty means hide it. */
export function parseSocial(key: Platform["key"], input: string): { ok: true; url: string } | { ok: false; message: string } {
  const p = PLATFORMS.find((x) => x.key === key)!;
  const v = input.trim();
  if (!v) return { ok: true, url: "" };
  if (/^https?:\/\//i.test(v)) {
    try {
      const u = new URL(v);
      const okHost = p.hosts.some((h) => u.hostname === h || u.hostname.endsWith("." + h));
      if (u.protocol !== "https:" || !okHost) return { ok: false, message: `${p.label} link must be an https link on ${p.hosts[0]}.` };
      return { ok: true, url: u.toString() };
    } catch {
      return { ok: false, message: `${p.label} link does not look right.` };
    }
  }
  const handle = v.replace(/^@/, "");
  if (!/^[A-Za-z0-9._-]{1,60}$/.test(handle)) return { ok: false, message: `${p.label} handle can only use letters, numbers, dots, dashes and underscores.` };
  return { ok: true, url: p.build(handle) };
}

type Row = { whatsapp?: string | null; social_instagram?: string | null; social_facebook?: string | null; social_tiktok?: string | null };

export function defaultContact(): Contact {
  return { whatsappIntl: SHOP.whatsappIntl, whatsappDisplay: SHOP.whatsappDisplay, socials: SOCIALS };
}

/** Values from the dashboard win. A social that was never set uses the default; one that was cleared stays hidden. */
export function contactFromRow(row: Row | null | undefined): Contact {
  const d = defaultContact();
  const intl = row?.whatsapp && /^\d{9,15}$/.test(row.whatsapp) ? row.whatsapp : d.whatsappIntl;
  const socials = PLATFORMS.map((p) => {
    const stored = row?.[`social_${p.key}` as keyof Row];
    const url = stored === null || stored === undefined ? (d.socials.find((s) => s.label === p.label)?.url ?? "") : stored;
    return { label: p.label, url };
  }).filter((s) => s.url.startsWith("https://"));
  return { whatsappIntl: intl, whatsappDisplay: row?.whatsapp ? formatPhone(intl) : d.whatsappDisplay, socials };
}
