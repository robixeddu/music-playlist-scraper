"use client";

import type { EpisodeAggregated } from "@/lib/types";
import ImportButton from "./ImportButton";

interface GlobalSectionProps {
  playlistPrefix: string;
  episodes: EpisodeAggregated[];
}

export default function GlobalSection({
  playlistPrefix,
  episodes,
}: GlobalSectionProps) {
  const allTidalIds = Array.from(
    new Set(
      episodes.flatMap((ep) =>
        ep.tracks.flatMap((t) => (t.tidalId ? [t.tidalId] : []))
      )
    )
  );

  const totalTracks = episodes.reduce((s, ep) => s + ep.tracks.length, 0);

  return (
    <div className="px-5 py-4 flex items-center justify-between gap-4 border-b border-[var(--border)] last:border-b-0">
      <div className="flex items-center gap-4 min-w-0">
        <span className="font-mono text-sm font-medium text-[var(--foreground)]">
          {playlistPrefix}
        </span>
        <span className="text-sm text-[var(--muted)]">
          {allTidalIds.length} / {totalTracks} tracce su TIDAL
        </span>
      </div>
      <ImportButton
        type="global"
        slug={playlistPrefix.toLowerCase()}
        playlistName={playlistPrefix}
        tidalIds={allTidalIds}
      />
    </div>
  );
}
