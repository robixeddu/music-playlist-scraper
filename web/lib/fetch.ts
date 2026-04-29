"use cache";

import type { Source, EpisodeAggregated } from "./types";
import { cacheLife } from "next/cache";

const SOURCES_URL =
  "https://raw.githubusercontent.com/robixeddu/music-playlist-scraper/main/data/sources.json";

const TRACKS_URL =
  "https://raw.githubusercontent.com/robixeddu/music-playlist-scraper/main/data/battiti/tracks.json";

export async function fetchSources(): Promise<Source[]> {
  cacheLife("days");
  const res = await fetch(SOURCES_URL);
  if (!res.ok) throw new Error("Failed to fetch sources");
  return res.json();
}

export async function fetchEpisodes(): Promise<EpisodeAggregated[]> {
  cacheLife("hours");
  const res = await fetch(TRACKS_URL);
  if (!res.ok) throw new Error("Failed to fetch tracks");
  return res.json();
}
