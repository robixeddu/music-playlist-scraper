import { filterGenres } from "./genres.js";

const API_KEY = process.env.LASTFM_API_KEY;
const BASE_URL = "https://ws.audioscrobbler.com/2.0/";

export const getArtistGenres = async (artist: string): Promise<string[]> => {
  if (!API_KEY) throw new Error("LASTFM_API_KEY not set");

  const url = `${BASE_URL}?method=artist.getTopTags&artist=${encodeURIComponent(artist)}&api_key=${API_KEY}&format=json`;
  const res = await fetch(url, {
    headers: { "User-Agent": "music-playlist-scraper/1.0" },
  });

  if (!res.ok) return [];

  const data: any = await res.json();
  const tags: { name: string; count: number }[] = data?.toptags?.tag ?? [];

  const rawGenres = tags
    .filter((t) => t.count >= 5)
    .slice(0, 6) // fetch more, filtering will reduce
    .map((t) => t.name);

  return filterGenres(rawGenres).slice(0, 3);
};
