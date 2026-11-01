import { publicDb } from "./lib/supabase";
import { getSettings, getBlackoutDates } from "./lib/settings";
import { earliestOrderDate } from "./lib/dates";
import { SHOP, SOCIALS, waLink } from "./lib/config";
import { OrderProvider, OrderButton } from "./OrderLauncher";
import SocialIcon from "./SocialIcon";
import type { Product } from "./lib/types";
import { packSize, priceLabel } from "./lib/pricing";

// Menu, prices and availability change from the admin, so always render fresh.
export const dynamic = "force-dynamic";

export default async function Home() {
  const [{ data }, settings, blackouts] = await Promise.all([
    publicDb().from("products").select("*").eq("active", true).order("created_at", { ascending: true }),
    getSettings(),
    getBlackoutDates(),
  ]);

  const products = ((data ?? []) as Product[]).filter((p) => p.type === "single");
  const { prices } = settings;
  const earliest = earliestOrderDate(settings.min_notice_days, settings.cutoff_hour);
  const noticeHours = settings.min_notice_days * 24;

  // Savings are measured against the normal "each" price. Packs like "R28 for 2" are left out of the average.
  const eachProducts = products.filter((p) => packSize(p) === 1);
  const refList = eachProducts.length ? eachProducts : products;
  const perPiece = refList.length ? refList.reduce((a, p) => a + Number(p.price_zar) / packSize(p), 0) / refList.length : 0;
  const saving = (n: number, price: number) => Math.max(0, Math.round(perPiece * n - price));
  const cheapest = products.length ? Math.min(...products.map((p) => Number(p.price_zar))) : 0;
  const boxes = [
    { name: "Trio", detail: "Any 3 flavours", price: prices.trio, save: saving(3, prices.trio), from: false, featured: false },
    { name: "Box of 6", detail: "Any 6 flavours", price: prices.box6, save: saving(6, prices.box6), from: false, featured: true },
    { name: "Singles", detail: "Mix it up", price: cheapest, save: 0, from: true, featured: false },
  ];

  const steps = [
    ["Choose", "Pick a box and your flavours."],
    ["Order", "Tell us when you would like to collect."],
    ["Pay a deposit", `Pay ${settings.deposit_percent}% by EFT within 24 hours to confirm.`],
    ["Collect", "We message you on WhatsApp to arrange pick-up."],
  ];

  const faqs = [
    ["How much notice do you need?", `Everything is made fresh to order, so we need at least ${noticeHours} hours.`],
    ["How do I pay?", `Once you order we email you our banking details. Pay a ${settings.deposit_percent}% deposit by EFT within 24 hours using your order reference, and we confirm your order.`],
    ["Where do I collect?", "We confirm the collection details with you on WhatsApp once your deposit is in."],
    ["What about allergies?", SHOP.allergenNote],
    ["Need to change or cancel?", "Message us on WhatsApp as soon as you can and we will sort it out."],
  ];

  return (
    <OrderProvider
      products={products}
      prices={prices}
      slots={settings.pickup_slots}
      depositPercent={settings.deposit_percent}
      earliestDate={earliest}
      blackouts={blackouts}
      ordersOpen={settings.orders_open}
    >
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
        <span className="font-serif text-xl tracking-[0.25em]">PULP</span>
        <div className="hidden sm:block">
          <OrderButton variant="link" />
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-6 pb-28 sm:pb-16">
        {!settings.orders_open && (
          <p className="mb-6 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-center text-sm text-amber-900">
            We are not taking new orders right now. Message us on WhatsApp and we will let you know when we are back.
          </p>
        )}

        <section className="flex flex-col items-center py-10 text-center sm:py-16">
          <div className="relative mb-8 flex h-40 w-40 items-center justify-center rounded-full border border-pulp-text sm:h-48 sm:w-48">
            <span className="font-sans text-4xl font-medium tracking-[0.1em] sm:text-5xl">PULP</span>
            <span className="absolute left-1/2 top-[20%] -translate-x-1/2 text-xl text-pulp-green" aria-hidden>🍃</span>
          </div>
          <p className="mb-3 text-xs uppercase tracking-widest text-gray-500">Made to order in Cape Town</p>
          <h1 className="mb-4 font-serif text-4xl tracking-[0.12em] sm:text-5xl">{SHOP.collection}</h1>
          <div className="mb-5 h-px w-24 bg-pulp-text" />
          <p className="mb-8 max-w-md font-serif text-lg leading-relaxed text-gray-700">{SHOP.tagline}</p>
          <OrderButton variant="hero" />
          <p className="mt-4 text-xs text-gray-500">{noticeHours} hours notice · {settings.deposit_percent}% deposit to confirm</p>
        </section>

        <section aria-labelledby="flavours" className="py-8">
          <h2 id="flavours" className="mb-8 text-center font-serif text-2xl tracking-[0.15em]">The flavours</h2>
          {products.length === 0 ? (
            <p className="text-center font-serif text-gray-500">Our menu is on its way. Check back soon.</p>
          ) : (
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((p) => (
                <article key={p.id} className="flex items-center gap-5 sm:flex-col sm:text-center">
                  <div className="h-28 w-28 shrink-0 overflow-hidden rounded-full border border-pulp-border bg-gray-200 sm:h-44 sm:w-44">
                    {p.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.image_url} alt={p.name} loading="lazy" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-gray-500">No image</div>
                    )}
                  </div>
                  <div>
                    <h3 className="mb-1 font-serif text-xl">{p.name}</h3>
                    <p className="font-serif text-sm leading-snug text-gray-600">{p.description}</p>
                    <p className="mt-2 text-sm font-semibold">{priceLabel(p)}</p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section aria-labelledby="boxes" className="py-10">
          <h2 id="boxes" className="mb-8 text-center font-serif text-2xl tracking-[0.15em]">Choose your box</h2>
          <div className="mx-auto grid max-w-3xl gap-4 sm:grid-cols-3">
            {boxes.map((b) => (
              <div key={b.name} className={`rounded-2xl border p-6 text-center ${b.featured ? "border-pulp-text bg-white shadow-sm" : "border-pulp-border bg-white/60"}`}>
                {b.featured && <p className="mb-2 text-[10px] uppercase tracking-widest text-pulp-green">Best value</p>}
                <h3 className="font-serif text-xl">{b.name}</h3>
                <p className="mb-3 text-sm text-gray-500">{b.detail}</p>
                <p className="font-serif text-3xl">{b.from && <span className="mr-1 text-sm text-gray-500">from</span>}R{b.price}</p>
                {b.save > 0 && <p className="mt-1 text-xs text-pulp-green">Save R{b.save}</p>}
              </div>
            ))}
          </div>
          <div className="mt-8 flex justify-center"><OrderButton variant="hero" /></div>
        </section>

        <section aria-labelledby="how" className="py-10">
          <h2 id="how" className="mb-8 text-center font-serif text-2xl tracking-[0.15em]">How it works</h2>
          <ol className="mx-auto grid max-w-3xl gap-6 sm:grid-cols-4">
            {steps.map(([title, text], i) => (
              <li key={title} className="text-center">
                <span className="mx-auto mb-3 flex h-9 w-9 items-center justify-center rounded-full border border-pulp-text font-serif">{i + 1}</span>
                <h3 className="mb-1 text-sm font-semibold">{title}</h3>
                <p className="text-sm text-gray-600">{text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="faq" className="mx-auto max-w-2xl py-10">
          <h2 id="faq" className="mb-6 text-center font-serif text-2xl tracking-[0.15em]">Good to know</h2>
          <div className="divide-y divide-pulp-border border-y border-pulp-border">
            {faqs.map(([q, a]) => (
              <details key={q} className="group py-4">
                <summary className="flex items-center justify-between font-medium marker:content-none">
                  {q}
                  <span className="ml-4 text-xl transition group-open:rotate-45" aria-hidden>+</span>
                </summary>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">{a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-pulp-border px-6 py-10 text-center font-serif text-sm">
        <p className="mb-1"><a href={`mailto:${SHOP.email}`} className="hover:underline">{SHOP.email}</a></p>
        <p className="mb-4">WhatsApp: <a href={waLink("Hi Pulp!")} target="_blank" rel="noopener noreferrer" className="hover:underline">{SHOP.whatsappDisplay}</a></p>
        {SOCIALS.length > 0 && (
          <div className="mb-5 flex justify-center gap-3">
            {SOCIALS.map((s) => (
              <a
                key={s.label}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Pulp on ${s.label}`}
                title={s.label}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-pulp-border bg-white/60 transition hover:border-pulp-text hover:bg-pulp-text hover:text-pulp-bg"
              >
                <SocialIcon name={s.label} />
              </a>
            ))}
          </div>
        )}
        <p className="text-xs text-gray-500">
          <a href="/privacy" className="underline">Privacy &amp; Terms</a> · © {new Date().getFullYear()} {SHOP.name}
        </p>
      </footer>

      <div className="fixed inset-x-0 bottom-0 z-40 bg-gradient-to-t from-pulp-bg via-pulp-bg/95 to-transparent px-6 pb-5 pt-6 sm:hidden">
        <OrderButton variant="bar" />
      </div>
    </OrderProvider>
  );
}
