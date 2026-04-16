"use client";

import type { Source, EpisodeAggregated } from "@/lib/types";
import { getGenres, getEpisodesSortedDesc, episodeDateToSlug, slugifyTitle } from "@/lib/data";
import { filterGenres } from "@/lib/genres";
import { useT } from "./LangProvider";
import Accordion from "./Accordion";
import GlobalSection from "./GlobalSection";
import GenreSection from "./GenreSection";
import EpisodeSection from "./EpisodeSection";
import ImportAllButton from "./ImportAllButton";
import { useState } from "react";
import { ImportLockContext, useImportLockState } from "@/hooks/useImportLock";
import { PlaylistStatusProvider } from "@/hooks/usePlaylistStatus";

interface ProgramBlockProps {
  source: Source;
  episodes: EpisodeAggregated[];
}

export default function ProgramBlock({ source, episodes }: ProgramBlockProps) {
  const tr = useT();
  const importLock = useImportLockState();
  const [descExpanded, setDescExpanded] = useState(false);
  const genres = getGenres(episodes);
  const sortedEpisodes = getEpisodesSortedDesc(episodes);

  const genreItems = genres.map((row) => ({
    type: "genre" as const,
    slug: row.genre.toLowerCase().replace(/\s+/g, "-"),
    playlistName: `${source.playlistPrefix}-${row.genre}`,
    tidalIds: Array.from(
      episodes.reduce((ids, ep) => {
        for (const t of ep.tracks) {
          if (t.tidalId && filterGenres(t.genresRaw ?? []).includes(row.genre)) ids.add(t.tidalId);
        }
        return ids;
      }, new Set<string>())
    ),
  }));

  const episodeItems = sortedEpisodes.map((ep) => {
    const slug = `${episodeDateToSlug(ep.date)}-${slugifyTitle(ep.episodeTitle)}`;
    return {
      type: "episode" as const,
      slug,
      playlistName: `${source.id}-${slug}`,
      tidalIds: ep.tracks.filter((t) => t.tidalId).map((t) => t.tidalId as string),
    };
  });

  return (
    <ImportLockContext.Provider value={importLock}>
    <PlaylistStatusProvider>
    <section className="space-y-3">
      <div className="mb-8 px-5">
        <h2 className="text-xl font-semibold mb-3">{source.name}</h2>
        <p className="hidden md:block text-sm text-[var(--muted)]">
          {source.description}
        </p>
        <button
          type="button"
          aria-expanded={descExpanded}
          aria-label={descExpanded ? tr.collapseDesc : tr.expandDesc}
          onClick={() => setDescExpanded((v) => !v)}
          className="md:hidden w-full text-left min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border)] rounded"
        >
          <span className={`block text-sm text-[var(--muted)] ${descExpanded ? "" : "line-clamp-4"}`}>
            {source.description}
          </span>
          <span aria-hidden="true" className={`block text-[var(--muted)] mt-1 transition-transform duration-200 ${descExpanded ? "rotate-180" : ""}`}>▾</span>
        </button>
      </div>

      <div className="border border-[var(--border)] rounded-lg overflow-hidden">
        <GlobalSection
          playlistPrefix={source.playlistPrefix}
          episodes={episodes}
        />
      </div>

      <Accordion title={tr.sectionGenre} action={<ImportAllButton items={genreItems} />}>
        <GenreSection
          playlistPrefix={source.playlistPrefix}
          episodes={episodes}
          genres={genres}
        />
      </Accordion>

      <Accordion title={tr.sectionEpisode} action={<ImportAllButton items={episodeItems} />}>
        <EpisodeSection episodes={sortedEpisodes} sourceId={source.id} />
      </Accordion>
    </section>
    </PlaylistStatusProvider>
    </ImportLockContext.Provider>
  );
}
