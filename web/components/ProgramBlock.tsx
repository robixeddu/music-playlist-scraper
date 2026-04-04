"use client";

import type { Source, EpisodeAggregated } from "@/lib/types";
import { getGenres, getEpisodesSortedDesc, episodeDateToSlug } from "@/lib/data";
import { useT } from "./LangProvider";
import Accordion from "./Accordion";
import GlobalSection from "./GlobalSection";
import GenreSection from "./GenreSection";
import EpisodeSection from "./EpisodeSection";
import ImportAllButton from "./ImportAllButton";
import { ImportLockContext, useImportLockState } from "@/lib/useImportLock";
import { PlaylistStatusProvider } from "@/lib/usePlaylistStatus";

interface ProgramBlockProps {
  source: Source;
  episodes: EpisodeAggregated[];
}

export default function ProgramBlock({ source, episodes }: ProgramBlockProps) {
  const tr = useT();
  const importLock = useImportLockState();
  const genres = getGenres(episodes);
  const sortedEpisodes = getEpisodesSortedDesc(episodes);

  const genreItems = genres.map((row) => ({
    type: "genre" as const,
    slug: row.genre.toLowerCase().replace(/\s+/g, "-"),
    playlistName: `${source.playlistPrefix}-${row.genre}`,
    tidalIds: Array.from(
      episodes.reduce((ids, ep) => {
        for (const t of ep.tracks) {
          if (t.tidalId && t.genres?.includes(row.genre)) ids.add(t.tidalId);
        }
        return ids;
      }, new Set<string>())
    ),
  }));

  const episodeItems = sortedEpisodes.map((ep) => {
    const slug = episodeDateToSlug(ep.date);
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
      <div className="items-baseline gap-3 mb-8 px-5">
        <h2 className="text-xl font-semibold mb-3">{source.name}</h2>
        <p className="text-sm text-[var(--muted)]">{source.description}</p>
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
