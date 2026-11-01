import type { Metadata, Viewport } from "next";
import { Montserrat, Playfair_Display } from "next/font/google";
import "./globals.css";

const montserrat = Montserrat({ subsets: ["latin"], variable: "--font-montserrat" });
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-playfair" });

const description = "Creamy vanilla mousse with fruit compote, encased in a chocolate dip. Made to order in Cape Town.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: { default: "Pulp | Illusion Collection", template: "%s | Pulp" },
  description,
  openGraph: {
    title: "Pulp | Illusion Collection",
    description,
    type: "website",
    locale: "en_ZA",
    images: [{ url: "/strawberry.jpg" }],
  },
  twitter: { card: "summary_large_image", title: "Pulp | Illusion Collection", description, images: ["/strawberry.jpg"] },
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
