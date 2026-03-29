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

// Family grouping for genre proximity sort.
// Genres in the same family cluster together; within a family, alphabetical.
// Unknown genres fall to the end ("zzz").
const GENRE_FAMILY: Record<string, string> = {
  // Classical
  classica: "1-classical", classical: "1-classical",
  // Jazz & blues
  bebop: "2-jazz", blues: "2-jazz", "bossa nova": "2-jazz", jazz: "2-jazz",
  "hard bop": "2-jazz", mpb: "2-jazz", samba: "2-jazz", soul: "2-jazz",
  swing: "2-jazz",
  // Electronic
  ambient: "3-electronic", downtempo: "3-electronic", drone: "3-electronic",
  dub: "3-electronic", electroacoustic: "3-electronic", electronic: "3-electronic",
  house: "3-electronic", idm: "3-electronic", "lo-fi": "3-electronic",
  "new age": "3-electronic", noise: "3-electronic", "post-industrial": "3-electronic",
  techno: "3-electronic",
  // Experimental
  "avant-garde": "4-experimental", experimental: "4-experimental",
  "free improvisation": "4-experimental", "free jazz": "4-experimental",
  // Rock
  "alternative rock": "5-rock", "art rock": "5-rock", "classic rock": "5-rock",
  hardcore: "5-rock", indie: "5-rock", "new wave": "5-rock",
  "post-punk": "5-rock", "post-rock": "5-rock", psychedelic: "5-rock",
  punk: "5-rock", rock: "5-rock",
  // Hip-hop & R&B
  funk: "6-hiphop", "hip-hop": "6-hiphop", "hip hop": "6-hiphop",
  "r&b": "6-hiphop",
  // Pop
  pop: "7-pop", "singer-songwriter": "7-pop",
  // Folk
  acoustic: "8-folk", country: "8-folk", folk: "8-folk", "freak folk": "8-folk",
  // World
  afrobeat: "9-world", calypso: "9-world", cumbia: "9-world",
  flamenco: "9-world", latin: "9-world", reggae: "9-world", world: "9-world",
};

function genreSortKey(genre: string): string {
  const family = GENRE_FAMILY[genre.toLowerCase()] ?? "zzz";
  return `${family}|${genre.toLowerCase()}`;
}

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
    .sort((a, b) => genreSortKey(a.genre).localeCompare(genreSortKey(b.genre)));
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
