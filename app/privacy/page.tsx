import type { Metadata } from "next";
import { SHOP, waLink } from "../lib/config";
import { getSettings } from "../lib/settings";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Privacy & Terms",
  description: "How Pulp looks after your information, and how ordering works.",
};

const makeSections = (whatsappIntl: string): { title: string; body: React.ReactNode }[] => [
  {
    title: "Your information is safe",
    body: "We take care of the details you give us. They are stored securely, only the people who run Pulp can see them, and we only keep them for as long as we need them to look after your orders.",
  },
  {
    title: "What we collect, and why",
    body: "When you order we ask for your name, email address, WhatsApp number and collection date. We use these only to make your order, confirm payment, and get in touch with you about it. We do not use any advertising or tracking cookies.",
  },
  {
    title: "We do not sell or share your information",
    body: "We never sell your information or hand it to anyone else to use for their own purposes. We use trusted services to run the website, store orders and send email, and they may only handle your information to do that job for us.",
  },
  {
    title: "No marketing without your say-so",
    body: "We only send you news and offers if you tick the optional box when you order. Every message tells you how to stop, and you can ask us to stop at any time.",
  },
  {
    title: "Your choices",
    body: (
      <>
        You can ask us what we hold about you, ask us to correct it, or ask us to delete it. Email{" "}
        <a href={`mailto:${SHOP.email}`} className="underline">{SHOP.email}</a> or message us on{" "}
        <a href={waLink("Hi Pulp!", whatsappIntl)} className="underline" target="_blank" rel="noopener noreferrer">WhatsApp</a>.
      </>
    ),
  },
  {
    title: "Ordering",
    body: "Everything is made fresh to order, so we need a couple of days' notice. Your order is confirmed once we receive your deposit, which is due within 24 hours of ordering. If you need to change or cancel, message us as soon as you can and we will sort it out.",
  },
  {
    title: "Allergies",
    body: SHOP.allergenNote,
  },
];

export default async function PrivacyPage() {
  const { contact } = await getSettings();
  const sections = makeSections(contact.whatsappIntl);
  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-12">
      <a href="/" className="text-xs uppercase tracking-widest text-gray-500 hover:text-pulp-text">← Back to Pulp</a>
      <h1 className="mb-2 mt-6 font-serif text-4xl">Privacy &amp; Terms</h1>
      <p className="mb-10 text-sm text-gray-500">Last updated October 2026</p>
      <div className="space-y-8">
        {sections.map((s) => (
          <section key={s.title}>
            <h2 className="mb-2 font-serif text-xl">{s.title}</h2>
            <p className="leading-relaxed text-gray-700">{s.body}</p>
          </section>
        ))}
      </div>
    </main>
  );
}
