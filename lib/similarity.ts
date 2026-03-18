const normalize = (str: string): string =>
  str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const jaccard = (a: string, b: string): number => {
  const ta = new Set(a.split(" ").filter(Boolean));
  const tb = new Set(b.split(" ").filter(Boolean));

  if (ta.size === 0 && tb.size === 0) return 1;
  if (ta.size === 0 || tb.size === 0) return 0;

  const intersection = [...ta].filter(t => tb.has(t)).length;
  return intersection / new Set([...ta, ...tb]).size;
};

export interface MatchScore {
  score: number;
  artistScore: number;
  titleScore: number;
}

// Confronto compact: rimuove spazi prima del match.
// Gestisce casi come "Shadowboxing" vs "Shadow Boxing" → entrambi "shadowboxing" → 1.0
// Applicato solo al titolo: per l'artista il Jaccard standard è sufficiente.
const compactJaccard = (a: string, b: string): number =>
  jaccard(a.replace(/\s/g, ""), b.replace(/\s/g, ""));

// score = min(artistScore, titleScore): entrambi devono matchare.
// Evita falsi positivi dove solo titolo o solo artista coincide.
export const computeMatchScore = (
  ourArtist: string,
  ourTitle: string,
  tidalArtist: string,
  tidalTitle: string
): MatchScore => {
  const na = normalize(ourArtist);
  const nt = normalize(ourTitle);
  const ta = normalize(tidalArtist);
  const tt = normalize(tidalTitle);

  const artistScore = jaccard(na, ta);
  const titleScore = Math.max(jaccard(nt, tt), compactJaccard(nt, tt));

  // When the title matches very well but the artist only partially matches
  // (e.g. "NOT NORMAL" vs "The Normal"), a weighted score avoids false negatives
  // while still requiring some artist signal.
  const score = titleScore >= 0.8 && artistScore >= 0.2
    ? titleScore * 0.6 + artistScore * 0.4
    : Math.min(artistScore, titleScore);

  return { score, artistScore, titleScore };
};

export const CONFIDENT_THRESHOLD = 0.5;
export const UNCERTAIN_THRESHOLD = 0.15;
