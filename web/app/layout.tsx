import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { Suspense } from "react";
import LangShell from "@/components/LangShell";
import { DEFAULT_LANG } from "@/lib/i18n";
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang={DEFAULT_LANG} className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-[var(--background)] text-[var(--foreground)]">
        <Suspense fallback={null}>
          <LangShell>{children}</LangShell>
        </Suspense>
        <Analytics />
      </body>
    </html>
  );
}
