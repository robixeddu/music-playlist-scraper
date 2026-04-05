import { GENRE_FAMILY } from "./genreFamily";

const FAMILY_COLORS: Record<string, string> = {
  "1-classical":    "#E53935",
  "2-jazz":         "#FB8C00",
  "3-electronic":   "#00ACC1",
  "4-experimental": "#8E24AA",
  "5-rock":         "#F4511E",
  "6-hiphop":       "#FFB300",
  "7-pop":          "#D81B60",
  "8-folk":         "#6D4C41",
  "9-world":        "#00897B",
  "10-soundtrack":  "#5C6BC0",
  "11-untagged":    "#78909C",
  "global":         "#3949AB",
};

export function colorForGenre(genre: string): string {
  const family = GENRE_FAMILY[genre.toLowerCase()] ?? "11-untagged";
  return FAMILY_COLORS[family] ?? FAMILY_COLORS["11-untagged"];
}

export function colorForGlobal(): string {
  return FAMILY_COLORS["global"];
}
