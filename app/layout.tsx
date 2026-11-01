import type { Metadata, Viewport } from "next";
import { Montserrat, Playfair_Display } from "next/font/google";
import "./globals.css";

const montserrat = Montserrat({ subsets: ["latin"], variable: "--font-montserrat" });
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-playfair" });

const description = "Creamy vanilla mousse with fruit compote, encased in a chocolate dip. Made to order in Cape Town.";

// Link previews need a full address. Use the one you set, else the production address Vercel provides, else localhost.
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "Pulp | Illusion Collection", template: "%s | Pulp" },
  description,
  openGraph: {
    title: "Pulp | Illusion Collection",
    description,
    type: "website",
    locale: "en_ZA",
  },
  twitter: { card: "summary_large_image", title: "Pulp | Illusion Collection", description },
};

export const viewport: Viewport = { themeColor: "#FDF6E9" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-ZA">
      <body className={`${montserrat.variable} ${playfair.variable} min-h-screen bg-pulp-bg font-sans text-pulp-text antialiased`}>
        {children}
      </body>
    </html>
  );
}
