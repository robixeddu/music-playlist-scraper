"use client";

import Link from "next/link";
import { useLang } from "./LangProvider";
import { LANGS } from "@/lib/i18n";

export default function LangSwitcher() {
  const lang = useLang();
  return (
    <div className="flex items-center gap-1.5 text-xs font-medium">
      {LANGS.map((l, i) => (
        <span key={l} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-[var(--muted)]">/</span>}
          <Link
            href={`/${l}`}
            className={
              l === lang
                ? "text-[var(--foreground)]"
                : "text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
            }
          >
            {l.toUpperCase()}
          </Link>
        </span>
      ))}
    </div>
  );
}
