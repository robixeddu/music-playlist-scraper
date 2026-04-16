import Anthropic from "@anthropic-ai/sdk";
import { filterGenres } from "./genres.js";
import { GENRE_FAMILY } from "./genreConfig.js";

const client = new Anthropic();

// Derived from GENRE_FAMILY canonical keys — no manual list to maintain.
const APPROVED_GENRES = Object.keys(GENRE_FAMILY)
  .filter((g) => g !== "no-genre")
  .sort();

const SYSTEM_PROMPT = `You are a music genre expert. Given an artist name and track title, respond with a JSON array of 1–3 genres that best describe THIS SPECIFIC TRACK.

Choose ONLY from this approved list:
${APPROVED_GENRES.join(", ")}

Rules:
- Return ONLY a valid JSON array of strings, no explanation
- Use at most 3 genres, from most to least specific
- Base your answer on the track itself, not the artist's general catalog
- If this track is in a different style from the artist's usual work, reflect the track's actual genre
- Artist names may be in ALL CAPS
- Return [] if you are not certain — wrong is worse than empty
- Example output: ["jazz", "experimental"]`;

const SEARCH_SYSTEM_PROMPT = `You are a music genre classifier. You will receive an artist name, a track title, and web search snippets about the artist/track.

Based ONLY on the search snippets, identify the genre of this specific track.

Choose ONLY from this approved list:
${APPROVED_GENRES.join(", ")}

Rules:
- Return ONLY a valid JSON array of 1–3 strings, no explanation
- Use at most 3 genres, from most to least specific
- Return [] if the snippets contain no useful genre information
- Example output: ["electronic", "experimental"]`;

export interface GenreResult {
  raw: string[];        // as returned by model
  normalized: string[]; // after ALIASES normalization
  source: "haiku" | "brave" | "none";
}

const APPROVED_GENRES_SET = new Set(APPROVED_GENRES);

const parseGenreResponse = (text: string, source: GenreResult["source"]): GenreResult => {
  try {
    const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    const match = cleaned.match(/\[[\s\S]*?\]/);
    const parsed: unknown = JSON.parse(match ? match[0] : cleaned);
    if (!Array.isArray(parsed)) return { raw: [], normalized: [], source: "none" };
    const raw = (parsed as string[]).map((g) => String(g).toLowerCase().trim()).filter(Boolean);
    const normalized = filterGenres(raw).filter((g) => APPROVED_GENRES_SET.has(g)).slice(0, 3);
    return { raw, normalized, source: normalized.length > 0 ? source : "none" };
  } catch {
    return { raw: [], normalized: [], source: "none" };
  }
};

// Haiku: fast, cheap — used first
export const getGenresHaiku = async (content: string): Promise<GenreResult> => {
  const response = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 64,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content }],
  });
  const text = response.content[0].type === "text" ? response.content[0].text.trim() : "[]";
  return parseGenreResponse(text, "haiku");
};

// Brave Search: fetch snippets for "artist title genre"
const searchBrave = async (artist: string, title: string): Promise<string> => {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  if (!apiKey) throw new Error("BRAVE_SEARCH_API_KEY not set");

  const q = encodeURIComponent(`${artist} ${title} genre`);
  const res = await fetch(
    `https://api.search.brave.com/res/v1/web/search?q=${q}&count=5&text_decorations=false`,
    {
      headers: {
        "Accept": "application/json",
        "X-Subscription-Token": apiKey,
      },
    }
  );

  if (!res.ok) throw new Error(`Brave Search API ${res.status}`);
  const data = (await res.json()) as {
    web?: { results?: Array<{ title?: string; description?: string }> };
  };

  const snippets = (data.web?.results ?? [])
    .slice(0, 5)
    .map((r) => [r.title, r.description].filter(Boolean).join(" — "))
    .filter(Boolean)
    .join("\n");

  return snippets;
};

// Brave Search + Haiku: fallback for unknown artists
export const getGenresBraveHaiku = async (
  artist: string,
  title: string
): Promise<GenreResult> => {
  const snippets = await searchBrave(artist, title);
  if (!snippets) return { raw: [], normalized: [], source: "none" };

  const content = `Artist: ${artist}\nTrack: ${title}\n\nSearch results:\n${snippets}`;
  const response = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 64,
    system: SEARCH_SYSTEM_PROMPT,
    messages: [{ role: "user", content }],
  });
  const text = response.content[0].type === "text" ? response.content[0].text.trim() : "[]";
  return parseGenreResponse(text, "brave");
};

export const getArtistGenres = async (
  artist: string,
  title?: string
): Promise<GenreResult> => {
  const content = title
    ? `Artist: ${artist}\nTrack: ${title}`
    : `Artist: ${artist}`;

  try {
    const haiku = await getGenresHaiku(content);
    if (haiku.normalized.length > 0) return haiku;

    // Haiku unsure — fallback to Brave Search + Haiku
    if (title) return await getGenresBraveHaiku(artist, title);
    return { raw: [], normalized: [], source: "none" };
  } catch {
    return { raw: [], normalized: [], source: "none" };
  }
};
