import { GENRE_FAMILY } from "./genreFamily";

// gradient [from, to] per famiglia di genere
const FAMILY_GRADIENTS: Record<string, [string, string]> = {
  "1-classical":    ["#C2185B", "#7B1FA2"],
  "2-jazz":         ["#E65100", "#BF360C"],
  "3-electronic":   ["#0288D1", "#006064"],
  "4-experimental": ["#6A1B9A", "#1A237E"],
  "5-rock":         ["#D32F2F", "#E64A19"],
  "6-hiphop":       ["#212121", "#F9A825"],
  "7-pop":          ["#E91E63", "#9C27B0"],
  "8-folk":         ["#795548", "#33691E"],
  "9-world":        ["#00897B", "#F9A825"],
  "10-soundtrack":  ["#37474F", "#78909C"],
  "11-untagged":    ["#546E7A", "#455A64"],
  "global":         ["#1565C0", "#6A1B9A"],
};

export function gradientForGenre(genre: string): [string, string] {
  const family = GENRE_FAMILY[genre.toLowerCase()] ?? "11-untagged";
  return FAMILY_GRADIENTS[family] ?? FAMILY_GRADIENTS["11-untagged"];
}

export function gradientForGlobal(): [string, string] {
  return FAMILY_GRADIENTS["global"];
}
