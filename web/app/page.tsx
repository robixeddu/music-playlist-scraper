import { fetchSources, fetchEpisodes } from "@/lib/data";
import TidalPill from "@/components/TidalPill";
import ProgramBlock from "@/components/ProgramBlock";

export default async function HomePage() {
  const [sources, episodes] = await Promise.all([
    fetchSources(),
    fetchEpisodes(),
  ]);

  const activeSources = sources.filter((s) => s.active);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--background)]/90 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <span className="text-lg font-bold tracking-tight text-[var(--accent)]">
            Battiti
          </span>
          <TidalPill />
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-8 space-y-12">
        {activeSources.length === 0 ? (
          <p className="text-[var(--muted)] text-sm">
            Nessun programma attivo.
          </p>
        ) : (
          activeSources.map((source) => (
            <ProgramBlock
              key={source.id}
              source={source}
              episodes={episodes}
            />
          ))
        )}
      </main>

      <footer className="border-t border-[var(--border)] py-4 text-center text-xs text-[var(--muted)]">
        Dati da{" "}
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
