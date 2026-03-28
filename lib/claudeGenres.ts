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
  "jazz", "lo-fi", "minimal", "mpb",
  "new age", "new wave", "noise",
  "pop", "post-industrial", "post-punk", "post-rock",
  "psychedelic", "punk", "r&b", "reggae", "rock",
  "samba", "shoegaze", "singer-songwriter", "ska", "soul",
  "soundtrack", "spoken word", "techno", "trance",
  "trip-hop", "world",
].sort();

const SYSTEM_PROMPT = `You are a music genre expert. Given an artist name and track title, respond with a JSON array of 1–3 genres that best describe their musical style.

Choose ONLY from this approved list:
${APPROVED_GENRES.join(", ")}

Rules:
- Return ONLY a valid JSON array of strings, no explanation
- Use at most 3 genres, from most to least specific
- If unsure, prefer broader genres over narrow ones
- Example output: ["jazz", "experimental"]`;

export const getArtistGenres = async (
  artist: string,
  title?: string
): Promise<string[]> => {
  const content = title
    ? `Artist: ${artist}\nTrack: ${title}`
    : `Artist: ${artist}`;

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 64,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content }],
    });

    const text =
      response.content[0].type === "text"
        ? response.content[0].text.trim()
        : "[]";

    const genres: unknown = JSON.parse(text);
    if (!Array.isArray(genres)) return [];

    return filterGenres(genres as string[]).slice(0, 3);
  } catch {
    return [];
  }
};
