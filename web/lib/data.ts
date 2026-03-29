import type { Source, EpisodeAggregated, GenreRow } from "./types";

const SOURCES_URL =
  "https://raw.githubusercontent.com/robixeddu/music-playlist-scraper/main/data/sources.json";

const TRACKS_URL =
  "https://raw.githubusercontent.com/robixeddu/music-playlist-scraper/main/data/battiti/tracks.json";

export async function fetchSources(): Promise<Source[]> {
  const res = await fetch(SOURCES_URL, { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error("Failed to fetch sources");
  return res.json();
}

export async function fetchEpisodes(): Promise<EpisodeAggregated[]> {
  const res = await fetch(TRACKS_URL, { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error("Failed to fetch tracks");
  return res.json();
}

const MIN_GENRE_TRACKS = 10;

export function getGenres(episodes: EpisodeAggregated[]): GenreRow[] {
  const counts: Record<string, number> = {};
  for (const ep of episodes) {
    for (const track of ep.tracks) {
      if (!track.tidalId) continue;
      for (const genre of track.genres ?? []) {
        counts[genre] = (counts[genre] ?? 0) + 1;
      }
    }
  }
  return Object.entries(counts)
    .filter(([, count]) => count >= MIN_GENRE_TRACKS)
    .map(([genre, count]) => ({ genre, count }))
    .sort((a, b) => b.count - a.count);
}

export function getEpisodesSortedDesc(
  episodes: EpisodeAggregated[]
): EpisodeAggregated[] {
  return [...episodes].sort((a, b) => {
    const da = parseEpisodeDate(a.date);
    const db = parseEpisodeDate(b.date);
    return db - da;
  });
}

const MONTH_MAP: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
  // Italian abbreviations
  gen: 0,
  mag: 4,
  giu: 5,
  lug: 6,
  ago: 7,
  set: 8,
  ott: 9,
  dic: 11,
};

export function parseEpisodeDate(dateStr: string): number {
  // Handles "DD Mon YYYY" e.g. "09 Nov 2025"
  const parts = dateStr.trim().split(/\s+/);
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = MONTH_MAP[parts[1].toLowerCase().slice(0, 3)] ?? 0;
    const year = parseInt(parts[2], 10);
    return new Date(year, month, day).getTime();
  }
  // Fallback: try to parse directly
  return new Date(dateStr).getTime();
}

export function episodeDateToSlug(dateStr: string): string {
  // Convert "DD Mon YYYY" → "YYYY-MM-DD"
  const parts = dateStr.trim().split(/\s+/);
  if (parts.length === 3) {
    const day = parts[0].padStart(2, "0");
    const month = (
      (MONTH_MAP[parts[1].toLowerCase().slice(0, 3)] ?? 0) + 1
    )
      .toString()
      .padStart(2, "0");
    const year = parts[2];
    return `${year}-${month}-${day}`;
  }
  return dateStr.replace(/\//g, "-");
}

export function episodeDateDisplay(dateStr: string): string {
  const ts = parseEpisodeDate(dateStr);
  if (isNaN(ts)) return dateStr;
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(ts));
}
