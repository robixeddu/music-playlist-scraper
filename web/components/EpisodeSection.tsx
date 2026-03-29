"use client";

import { useState } from "react";
import type { EpisodeAggregated } from "@/lib/types";
import { episodeDateToSlug, episodeDateDisplay } from "@/lib/data";
import { useT } from "./LangProvider";
import ImportButton from "./ImportButton";
import TrackList from "./TrackList";

interface EpisodeSectionProps {
  episodes: EpisodeAggregated[];
  sourceId: string;
}

export default function EpisodeSection({ episodes, sourceId }: EpisodeSectionProps) {
  const tr = useT();
  const [expanded, setExpanded] = useState<string | null>(null);

  if (episodes.length === 0) {
    return (
      <div className="px-5 py-4 text-sm text-[var(--muted)]">
        {tr.noEpisodes}
      </div>
    );
  }

  return (
    <div>
      {episodes.map((ep, i) => {
        const tidalIds = ep.tracks.filter((t) => t.tidalId).map((t) => t.tidalId as string);
        const slug = episodeDateToSlug(ep.date);
        const playlistName = `${sourceId}-${slug}`;
        const key = `${ep.date}-${ep.episodeTitle}`;
        const isExpanded = expanded === key;

        return (
          <div
            key={key}
            className={i < episodes.length - 1 ? "border-b border-[var(--border)]" : ""}
          >
            <div className="px-5 py-3 flex items-center justify-between gap-4">
              <button
                onClick={() => setExpanded(isExpanded ? null : key)}
                className="flex items-center gap-3 min-w-0 text-left flex-1"
                aria-expanded={isExpanded}
              >
                <svg
                  className={`w-3 h-3 text-[var(--muted)] shrink-0 transition-transform duration-150 ${isExpanded ? "rotate-90" : ""}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs text-[var(--muted)] shrink-0 font-mono">
                      {episodeDateDisplay(ep.date)}
                    </span>
                    <a
                      href={ep.episodeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-sm font-medium truncate hover:text-[var(--accent)] transition-colors"
                      title={ep.episodeTitle}
                    >
                      {ep.episodeTitle}
                    </a>
                  </div>
                  <span className="text-xs text-[var(--muted)] mt-0.5">
                    {tr.tracksOnTidal(tidalIds.length, ep.tracks.length)}
                  </span>
                </div>
              </button>
              <ImportButton type="episode" slug={slug} playlistName={playlistName} tidalIds={tidalIds} />
            </div>
            {isExpanded && <TrackList tracks={ep.tracks} />}
          </div>
        );
      })}
    </div>
  );
}
