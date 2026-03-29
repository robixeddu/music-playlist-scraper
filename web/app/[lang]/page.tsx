import { fetchSources, fetchEpisodes } from "@/lib/data";
import { LANGS, DEFAULT_LANG, translations, type Lang } from "@/lib/i18n";
import TidalPill from "@/components/TidalPill";
import ProgramBlock from "@/components/ProgramBlock";

export function generateStaticParams() {
  return LANGS.map((lang) => ({ lang }));
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: langParam } = await params;
  const lang = (LANGS.includes(langParam as Lang) ? langParam : DEFAULT_LANG) as Lang;
  const tr = translations[lang];

  const [sources, episodes] = await Promise.all([
    fetchSources(),
    fetchEpisodes(),
  ]);

  const activeSources = sources.filter((s) => s.active);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--background)]/90 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-5 pr-0 h-14 flex items-center justify-between">
          <span className="text-sm font-medium tracking-wide text-[var(--accent)]">
            music playlist scraper
          </span>
          <TidalPill />
        </div>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full py-8 space-y-12">
        {activeSources.length === 0 ? (
          <p className="px-5 text-[var(--muted)] text-sm">{tr.noPrograms}</p>
        ) : (
          activeSources.map((source) => (
            <ProgramBlock key={source.id} source={source} episodes={episodes} />
          ))
        )}
      </main>

      <footer className="border-t border-[var(--border)] py-4 text-center text-xs text-[var(--muted)]">
        {tr.footerData}{" "}
        <a
          href="https://www.raiplaysound.it/programmi/battiti"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-[var(--foreground)] transition-colors underline underline-offset-2"
        >
          RAI Play Sound
        </a>
      </footer>
    </div>
  );
}
