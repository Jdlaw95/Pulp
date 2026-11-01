// Single place for shop details used across the site, emails and admin.
export const SHOP = {
  name: "Pulp",
  collection: "Illusion Collection",
  tagline: "Creamy vanilla mousse with fruit compote, encased in a chocolate dip.",
  email: "pulpfruitscpt@gmail.com",
  whatsappDisplay: "069 515 5899",
  whatsappIntl: "27695155899",
  // TODO(Jason): confirm this against your actual recipes before launch.
  allergenNote:
    "Our desserts are made with dairy and chocolate, and are prepared in a kitchen that may also handle nuts, soy, eggs and gluten. If you have an allergy, message us before you order.",
};

// Add full links here (for example "https://instagram.com/yourhandle"). Anything left empty is hidden on the site.
export const SOCIALS: { label: string; url: string }[] = [
  { label: "Instagram", url: "" },
  { label: "Facebook", url: "https://www.facebook.com/share/1F1ZvqFpaa/?mibextid=wwXIfr" },
  { label: "TikTok", url: "https://www.tiktok.com/@pulpfruitscpt" },
].filter((s) => s.url.startsWith("https://"));

export function waLink(text?: string, phoneIntl: string = SHOP.whatsappIntl) {
  return `https://wa.me/${phoneIntl}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

/** Turn a South African number like 072 030 1273 into 27720301273 for wa.me links. */
export function toIntlPhone(raw: string): string {
  const digits = (raw || "").replace(/\D/g, "");
  if (digits.startsWith("27")) return digits;
  if (digits.startsWith("0")) return "27" + digits.slice(1);
  return digits;
}
