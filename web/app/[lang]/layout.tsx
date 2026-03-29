import { LangProvider } from "@/components/LangProvider";
import { LANGS, DEFAULT_LANG, type Lang } from "@/lib/i18n";

export function generateStaticParams() {
  return LANGS.map((lang) => ({ lang }));
}

export default async function LangLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang: langParam } = await params;
  const lang = (LANGS.includes(langParam as Lang) ? langParam : DEFAULT_LANG) as Lang;
  return <LangProvider lang={lang}>{children}</LangProvider>;
}
