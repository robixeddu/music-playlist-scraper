import { BLACKLIST, ALIASES } from "../../lib/genreConfig";

export const normalizeGenre = (tag: string): string | null => {
  const lower = tag.toLowerCase().trim();
  if (BLACKLIST.has(lower)) return null;
  return ALIASES[lower] ?? lower;
};

export const filterGenres = (tags: string[]): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const tag of tags) {
    const normalized = normalizeGenre(tag);
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized);
      result.push(normalized);
    }
  }
  return result;
};
