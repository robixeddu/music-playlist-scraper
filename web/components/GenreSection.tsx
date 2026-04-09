"use client";

import { useState } from "react";
import type { EpisodeAggregated, GenreRow } from "@/lib/types";
import { useT } from "./LangProvider";
import ImportButton from "./ImportButton";
import PlaylistCover from "./PlaylistCover";
import TrackList from "./TrackList";
import { colorForGenre } from "@/lib/genreColors";

interface GenreSectionProps {
  playlistPrefix: string;
  episodes: EpisodeAggregated[];
  genres: GenreRow[];
}

export default function GenreSection({ playlistPrefix, episodes, genres }: GenreSectionProps) {
  const tr = useT();
  const [expanded, setExpanded] = useState<string | null>(null);

  function getTracksForGenre(genre: string) {
    const seen = new Set<string>();
    const result: { artist: string; title: string; tidalId?: string | null }[] = [];
    for (const ep of episodes) {
      for (const track of ep.tracks) {
        if (!track.genres?.includes(genre)) continue;
        const key = `${track.artist}|${track.title}`;
        if (!seen.has(key)) {
          seen.add(key);
          result.push({ artist: track.artist, title: track.title, tidalId: track.tidalId });
        }
      }
    }
    return result;
  }

  function getTidalIdsForGenre(genre: string): string[] {
    const ids = new Set<string>();
    for (const ep of episodes) {
      for (const track of ep.tracks) {
        if (track.tidalId && track.genres?.includes(genre)) ids.add(track.tidalId);
      }
    }
    return Array.from(ids);
  }

  if (genres.length === 0) {
    return (
      <div className="px-5 py-4 text-sm text-[var(--muted)]">
        {tr.noGenres}
      </div>
    );
  }

  return (
    <div>
      {genres.map((row, i) => {
        const tidalIds = getTidalIdsForGenre(row.genre);
        const playlistName = `${playlistPrefix}-${row.genre}`;
        const slug = row.genre.toLowerCase().replace(/\s+/g, "-");
        const isExpanded = expanded === row.genre;
        const tracks = isExpanded ? getTracksForGenre(row.genre) : [];

        return (
          <div
            key={row.genre}
            className={i < genres.length - 1 ? "border-b border-[var(--border)]" : ""}
          >
            <div className={`px-5 py-0 flex items-center justify-between gap-4${isExpanded ? " sticky top-28 z-10 bg-[var(--surface)]/90 backdrop-blur-sm border-b border-[var(--border)]" : ""}`}>
              <button
                onClick={() => setExpanded(isExpanded ? null : row.genre)}
                className="flex items-center py-3 gap-3 min-w-0 text-left flex-1 cursor-pointer"
                aria-expanded={isExpanded}
              >
                <PlaylistCover color={colorForGenre(row.genre)} size={40} />
                <svg
                  className={`w-3 h-3 text-[var(--muted)] shrink-0 transition-transform duration-150 ${isExpanded ? "rotate-90" : ""}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
                <span className="text-sm font-medium capitalize truncate">{row.genre}</span>
                <span className="text-sm text-[var(--muted)] shrink-0">{row.count} {tr.tracks}</span>
              </button>
              <ImportButton type="genre" slug={slug} playlistName={playlistName} tidalIds={tidalIds} />
            </div>
            {isExpanded && (
              <div className="flex">
                <div
                  style={{ backgroundColor: colorForGenre(row.genre) }}
                  className="shrink-0 ml-5 mt-3 w-10 opacity-70 rounded-sm"
                />
                <TrackList tracks={tracks} className="flex-1 min-w-0 px-5" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
