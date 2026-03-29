"use client";

import type { Source, EpisodeAggregated } from "@/lib/types";
import { getGenres, getEpisodesSortedDesc } from "@/lib/data";
import Accordion from "./Accordion";
import GlobalSection from "./GlobalSection";
import GenreSection from "./GenreSection";
import EpisodeSection from "./EpisodeSection";

interface ProgramBlockProps {
  source: Source;
  episodes: EpisodeAggregated[];
}

export default function ProgramBlock({ source, episodes }: ProgramBlockProps) {
  const genres = getGenres(episodes);
  const sortedEpisodes = getEpisodesSortedDesc(episodes);

  return (
    <section className="space-y-3">
      <div className="flex items-baseline gap-3 mb-4">
        <h2 className="text-xl font-semibold">{source.name}</h2>
        <p className="text-sm text-[var(--muted)]">{source.description}</p>
      </div>

      <Accordion title="Globale" defaultOpen={true}>
        <GlobalSection
          playlistPrefix={source.playlistPrefix}
          episodes={episodes}
        />
      </Accordion>

      <Accordion title="Per genere">
        <GenreSection
          playlistPrefix={source.playlistPrefix}
          episodes={episodes}
          genres={genres}
        />
      </Accordion>

      <Accordion title="Per episodio">
        <EpisodeSection episodes={sortedEpisodes} sourceId={source.id} />
      </Accordion>
    </section>
  );
}
