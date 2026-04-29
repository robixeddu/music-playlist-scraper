import { headers } from "next/headers";
import { DEFAULT_LANG, type Lang } from "@/lib/i18n";
import { LangProvider } from "./LangProvider";

export default async function LangShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const h = await headers();
  const lang = (h.get("x-lang") ?? DEFAULT_LANG) as Lang;
  return <LangProvider lang={lang}>{children}</LangProvider>;
}
