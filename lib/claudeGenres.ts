import Anthropic from "@anthropic-ai/sdk";
import { filterGenres } from "./genres.js";

const client = new Anthropic();

// Canonical genre list — must stay in sync with ALIASES canonical values in genres.ts
const APPROVED_GENRES = [
  "acoustic", "afrobeat", "ambient", "avant-garde",
  "blues", "bossa nova", "chillout", "classica",
  "country", "cumbia", "downtempo", "drone", "dub",
  "electroacoustic", "electronic", "experimental",
  "folk", "free improvisation", "funk",
  "hip-hop", "house", "indie", "instrumental",
  "industrial", "jazz", "lo-fi", "metal", "minimal", "mpb",
  "new age", "new wave", "noise",
  "pop", "post-punk", "post-rock",
  "psychedelic", "punk", "r&b", "reggae", "rock",
  "samba", "shoegaze", "singer-songwriter", "ska", "soul",
  "soundtrack", "spoken word", "techno", "trance",
  "trip-hop", "world",
].sort();

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

const SEARCH_SYSTEM_PROMPT = `You are a music genre expert with web search access. Search for the artist and identify their musical genre based on real information.

Choose ONLY from this approved list:
${APPROVED_GENRES.join(", ")}

Rules:
- Search for the artist to find accurate genre information
- Return ONLY a valid JSON array of 1–3 strings, no explanation
- Use at most 3 genres, from most to least specific
- Return [] only if search yields no useful genre information
- Example output: ["dub", "electronic"]`;

export interface GenreResult {
  raw: string[];        // as returned by model
  normalized: string[]; // after ALIASES normalization
}

const APPROVED_GENRES_SET = new Set(APPROVED_GENRES);

const parseGenreResponse = (text: string): GenreResult => {
  try {
    const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    // Extract first JSON array if there's trailing text
    const match = cleaned.match(/\[[\s\S]*?\]/);
    const parsed: unknown = JSON.parse(match ? match[0] : cleaned);
    if (!Array.isArray(parsed)) return { raw: [], normalized: [] };
    const raw = (parsed as string[]).map((g) => String(g).toLowerCase().trim()).filter(Boolean);
    // filterGenres applies ALIASES + BLACKLIST, then restrict to canonical APPROVED_GENRES
    const normalized = filterGenres(raw).filter((g) => APPROVED_GENRES_SET.has(g)).slice(0, 3);
    return { raw, normalized };
  } catch {
    return { raw: [], normalized: [] };
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
  return parseGenreResponse(text);
};

// Sonnet + web_search: fallback for unknown artists
// server_tool_use (web_search) is handled server-side — single call, no agentic loop needed
export const getGenresSonnetSearch = async (content: string): Promise<GenreResult> => {
  const response = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 1024,
    system: SEARCH_SYSTEM_PROMPT,
    tools: [{ type: "web_search_20250305" as any, name: "web_search" }],
    messages: [{ role: "user", content }],
  });

  // Find the last text block containing a JSON array
  const textBlocks = response.content.filter((c) => c.type === "text");
  for (let i = textBlocks.length - 1; i >= 0; i--) {
    const text = (textBlocks[i] as Anthropic.TextBlock).text.trim();
    const jsonMatch = text.match(/\[[\s\S]*?\]/);
    if (jsonMatch) {
      try {
        return parseGenreResponse(jsonMatch[0]);
      } catch {
        continue;
      }
    }
  }
  return { raw: [], normalized: [] };
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

    // Haiku unsure — fallback to Sonnet + web search
    return await getGenresSonnetSearch(content);
  } catch {
    return { raw: [], normalized: [] };
  }
};
