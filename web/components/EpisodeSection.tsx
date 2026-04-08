"use client";

import { useState } from "react";
import type { EpisodeAggregated } from "@/lib/types";
import { episodeDateToSlug, episodeDateDisplay, slugifyTitle } from "@/lib/data";
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
        const slug = `${episodeDateToSlug(ep.date)}-${slugifyTitle(ep.episodeTitle)}`;
        const playlistName = `${sourceId}-${slug}`;
        const key = `${ep.date}-${ep.episodeTitle}`;
        const isExpanded = expanded === key;

        return (
          <div
            key={key}
            className={i < episodes.length - 1 ? "border-b border-[var(--border)]" : ""}
          >
            <div className={`px-5 py-0 flex items-center justify-between gap-4${isExpanded ? " sticky top-14 z-10 bg-[var(--surface)]/90 backdrop-blur-sm border-b border-[var(--border)]" : ""}`}>
              <button
                onClick={() => setExpanded(isExpanded ? null : key)}
                className="flex items-center py-3 gap-3 min-w-0 text-left flex-1 cursor-pointer"
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
                    <span className="text-sm font-medium truncate" title={ep.episodeTitle}>
                      {ep.episodeTitle}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs text-[var(--muted)]">
                      {tr.tracksOnTidal(tidalIds.length, ep.tracks.length)}
                    </span>
                    <a
                      href={ep.episodeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-xs text-[var(--muted)] hover:text-[var(--accent)] transition-colors ml-2"
                    >
                      RAI Play Sound ↗
                    </a>
                  </div>
                </div>
              </button>
              <ImportButton type="episode" slug={slug} playlistName={playlistName} tidalIds={tidalIds} />
            </div>
            {isExpanded && <TrackList tracks={ep.tracks} className="pl-11 pr-5" />}
          </div>
        );
      })}
    </div>
  );
}
