import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { headers } from "next/headers";
import { LangProvider } from "@/components/LangProvider";
import { DEFAULT_LANG, type Lang } from "@/lib/i18n";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "music playlist scraper",
  description: "Browse and import curated music playlists to TIDAL",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const h = await headers();
  const lang = (h.get("x-lang") ?? DEFAULT_LANG) as Lang;

  return (
    <html lang={lang} className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-[var(--background)] text-[var(--foreground)]">
        <LangProvider lang={lang}>{children}</LangProvider>
        <Analytics />
      </body>
    </html>
  );
}
