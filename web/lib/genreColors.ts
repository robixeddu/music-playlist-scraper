import { GENRE_FAMILY } from "./genreFamily";

const FAMILY_COLORS: Record<string, string> = {
  "1-classical":    "#7C3AED",
  "2-jazz":         "#F59E0B",
  "3-electronic":   "#06B6D4",
  "4-experimental": "#A855F7",
  "5-rock":         "#F97316",
  "6-hiphop":       "#EAB308",
  "7-pop":          "#EC4899",
  "8-folk":         "#84CC16",
  "9-world":        "#10B981",
  "10-soundtrack":  "#6366F1",
  "11-untagged":    "#94A3B8",
  "global":         "#0EA5E9",
};

export function colorForGenre(genre: string): string {
  const family = GENRE_FAMILY[genre.toLowerCase()] ?? "11-untagged";
  return FAMILY_COLORS[family] ?? FAMILY_COLORS["11-untagged"];
}

export function colorForGlobal(): string {
  return FAMILY_COLORS["global"];
}
