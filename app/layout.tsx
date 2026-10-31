import type { Metadata } from "next";
import { Montserrat, Playfair_Display } from "next/font/google";
import "./globals.css";

const montserrat = Montserrat({ 
  subsets: ["latin"], 
  variable: "--font-montserrat" 
});

const playfair = Playfair_Display({ 
  subsets: ["latin"], 
  variable: "--font-playfair" 
});

export const metadata: Metadata = {
  title: "Pulp | Illusion Collection",
  description: "Creamy vanilla mousse with fruit compote encased in chocolate dip.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" style={{ fontSize: '16px' }}>
      <body 
        className={`${montserrat.variable} ${playfair.variable}`} 
        style={{ 
          backgroundColor: '#FDF6E9', 
          color: '#111111', 
          margin: 0, 
          padding: 0,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        }}
      >
        {children}
      </body>
    </html>
  );
}