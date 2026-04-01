import { logError } from "./logger.js";
import { computeMatchScore, CONFIDENT_THRESHOLD } from "./similarity.js";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const SEARCH_DELAY_MS = 800;

const BASE_URL = "https://openapi.tidal.com/v2";
const COUNTRY_CODE = process.env.TIDAL_COUNTRY_CODE ?? "IT";

export interface TidalTrack {
  id: string;
  title: string;
  artistName: string;
}

const tidalFetch = async (
  path: string,
  token: string,
  options: RequestInit = {},
  retries = 3
): Promise<any> => {
  const doFetch = async () => {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/vnd.api+json",
        ...options.headers,
      },
    });
    if (!res.ok) throw new Error(`TIDAL API ${res.status} on ${path}`);
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  };

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await doFetch();
    } catch (e: any) {
      const isRetryable = /TIDAL API (429|5\d\d)/.test(e.message);
      if (!isRetryable || attempt === retries - 1) throw e;
      const delay = e.message.includes("429") ? 5000 * (attempt + 1) : 2000 * (attempt + 1);
      await sleep(delay);
    }
  }
};

export const searchTracks = async (
  query: string,
  expectedArtist: string,
  token: string,
  artistById?: Map<string, string>  // optionally populated with id→name from response
): Promise<TidalTrack[]> => {
  try {
    const encoded = encodeURIComponent(query);
    const data = await tidalFetch(
      `/searchResults/${encoded}?countryCode=${COUNTRY_CODE}&include=tracks%2Cartists`,
      token
    );

    const included: any[] = data?.included ?? [];

    // Build id → name map for all included artists
    const localArtistMap = new Map<string, string>();
    for (const a of included.filter((r: any) => r.type === "artists")) {
      if (a.id && a.attributes?.name) {
        localArtistMap.set(a.id, a.attributes.name);
        artistById?.set(a.id, a.attributes.name);
      }
    }

    return included
      .filter((r: any) => r.type === "tracks")
      .map((t: any) => {
        // Use each track's own linked artists, not a pooled guess
        const artistIds: string[] = t.relationships?.artists?.data?.map((a: any) => a.id) ?? [];
        const artistName = artistIds.map((id) => localArtistMap.get(id)).find(Boolean)
          ?? expectedArtist;
        return {
          id: t.id,
          title: t.attributes?.title ?? "",
          artistName,
        };
      })
      .filter((t) => t.title);
  } catch (e: any) {
    logError(`TIDAL search "${query}"`, e.message);
    return [];
  }
};

export interface TidalMatch {
  id: string;
  score: number;
  artistScore: number;
  titleScore: number;
}

// Strip (feat. ...), [remix], ", da "Album"", "– Label" etc. for cleaner queries
const cleanTitle = (title: string): string =>
  title
    .replace(/\s*,?\s*\bda\b\s+"[^"]*"/gi, "")      // RAI: da "Album name" (with or without comma)
    .replace(/\s*,?\s*\bde\b\s+"[^"]*"/gi, "")      // French: de "Album" (with or without comma)
    .replace(/,\s*"[^"]*"/g, "")                    // RAI: , "Album Name" (quoted album after comma)
    .replace(/\s*[-–]\s*live\s*@.*/gi, "")          // "Title – live @ Venue 2025"
    .replace(/\s*–\s*.+$/, "")                      // em-dash: label/format annotation (– 12" Rough Trade, – Les Disques Bongo Joe…)
    .replace(/\s+-\s+\w+$/, "")                     // hyphen: single-word label suffix (- Tzadik, - ECM)
    .replace(/\s*[\(\[].*?[\)\]]/g, "")             // "(singolo)", "[remix]", "(1971)", etc.
    .replace(/\s*[-–]\s*(?:feat\.?|ft\.?)\s+.*/gi, "") // "Title - feat. Artist"
    .replace(/\s+(?:feat\.?|ft\.?)\s+.*/gi, "")        // "Title feat. Artist"
    .replace(/\s*[-–]\s*$/, "")                     // trailing " -" or " –"
    .trim();

// Normalize artist for search: expand dots (DR.DRE → DR DRE), strip feat./ft. suffixes
const normalizeArtistForSearch = (artist: string): string =>
  artist
    .replace(/\./g, " ")                          // DR.DRE → DR DRE, M.I.A. → M I A
    .replace(/[''']/g, " ")                        // D'ANDREA → D ANDREA, BOCCO MA'IN → BOCCO MA IN
    .replace(/[!?*+#@]/g, "")                     // PRAED ORCHESTRA! → PRAED ORCHESTRA
    .replace(/\s*(?:feat\.?|ft\.?)\s+.*/i, "")   // strip "feat. ..." suffix
    .replace(/\s+/g, " ")
    .trim();

// Normalize title for search: strip apostrophes that can confuse TIDAL search API
const normalizeTitleForSearch = (title: string): string =>
  title.replace(/[''']/g, "").replace(/[!?*+#@]/g, "").replace(/\s+/g, " ").trim();

// Return unique artist variants to try: full, normalized, each slash/& part
const artistSearchVariants = (artist: string): string[] => {
  const norm = normalizeArtistForSearch(artist);
  const parts = artist
    .split(/\s*[\/&–]\s*|\s+(?:feat\.?|ft\.?)\s+/i)  // also split on em-dash (JOHN ZORN – JESSE HARRIS)
    .map((s) => s.trim())
    .filter(Boolean);
  return [...new Set([artist, norm, ...parts])].filter(Boolean);
};

export const findTidalMatch = async (
  artist: string,
  title: string,
  token: string,
  album?: string
): Promise<TidalMatch | null> => {
  const clean = cleanTitle(title);
  const artistById = new Map<string, string>();

  // Score against clean title to avoid false negatives from "(singolo) -" etc.
  const scoreTitle = clean || title;
  const scoreAll = (candidates: TidalTrack[]) =>
    candidates.map((c) => ({
      candidate: c,
      ...computeMatchScore(artist, scoreTitle, c.artistName, cleanTitle(c.title)),
    }));

  // Verify a single candidate: fetches the real artist and re-scores.
  // Returns a TidalMatch if verified, null if rejected, undefined if artist lookup failed.
  // overrideArtist/overrideTitle: use alternative scoring when RAI has label-as-artist.
  const verify = async (
    candidate: { candidate: TidalTrack },
    overrideArtist?: string,
    overrideTitle?: string
  ): Promise<TidalMatch | null | undefined> => {
    const verifyArtist = overrideArtist ?? artist;
    const verifyTitle = overrideTitle ?? scoreTitle;
    try {
      await sleep(400);
      const rel = await tidalFetch(
        `/tracks/${candidate.candidate.id}/relationships/artists?countryCode=${COUNTRY_CODE}`,
        token
      );
      const artistIds: string[] = (rel?.data ?? []).map((a: any) => a.id);

      // Collect all known artists for this track from cache
      const cachedArtists = artistIds
        .map((id) => artistById.get(id))
        .filter((n): n is string => !!n);

      // Fetch first uncached artist if cache is empty
      if (cachedArtists.length === 0 && artistIds.length > 0) {
        await sleep(400);
        const artistData = await tidalFetch(
          `/artists/${artistIds[0]}?countryCode=${COUNTRY_CODE}`,
          token
        );
        const name = artistData?.data?.attributes?.name;
        if (name) cachedArtists.push(name);
      }

      // Pick the artist that best matches verifyArtist (handles feat. / multi-artist tracks)
      const actualArtist = cachedArtists.length > 0
        ? cachedArtists.reduce((best, a) =>
            computeMatchScore(verifyArtist, "", a, "").artistScore >
            computeMatchScore(verifyArtist, "", best, "").artistScore ? a : best
          )
        : undefined;

      if (!actualArtist) return undefined; // lookup failed, skip
      const verified = computeMatchScore(verifyArtist, verifyTitle, actualArtist, cleanTitle(candidate.candidate.title));
      if (verified.score < CONFIDENT_THRESHOLD) return null; // wrong artist confirmed
      return { id: candidate.candidate.id, ...verified };
    } catch {
      return undefined; // network error, skip
    }
  };

  const artistVariants = artistSearchVariants(artist);
  const primaryArtist = artistVariants[0]; // original
  const normArtist = artistVariants[1];    // dot-normalized

  await sleep(SEARCH_DELAY_MS);
  const primary = await searchTracks(`${primaryArtist} ${title}`, artist, token, artistById);

  // Build full candidate pool — run fallbacks immediately so reversed queries
  // can surface tracks that primary search buries (e.g. niche catalog artists)
  await sleep(SEARCH_DELAY_MS);
  const fbTitle = await searchTracks(title, artist, token, artistById);
  await sleep(SEARCH_DELAY_MS);
  const fbArtist = await searchTracks(primaryArtist, artist, token, artistById);
  await sleep(SEARCH_DELAY_MS);
  const fbDot = await searchTracks(`${primaryArtist} ${title}.`, artist, token, artistById);
  await sleep(SEARCH_DELAY_MS);
  const fbReversed = await searchTracks(`${title} ${primaryArtist}`, artist, token, artistById);
  const fbClean = clean !== title
    ? (await sleep(SEARCH_DELAY_MS), await searchTracks(`${primaryArtist} ${clean}`, artist, token, artistById))
    : [];

  // Extra: apostrophe-stripped title variant (helps TIDAL search for e.g. "Jes' Grew")
  const cleanNorm = normalizeTitleForSearch(clean || title);
  const fbNorm = cleanNorm !== (clean || title) || normArtist !== primaryArtist
    ? (await sleep(SEARCH_DELAY_MS), await searchTracks(`${normArtist} ${cleanNorm}`, artist, token, artistById))
    : [];

  // Extra: normalized artist (dots expanded) + each slash/& part
  const extraSearches: TidalTrack[] = [];
  for (const variant of artistVariants.slice(1)) { // skip [0] = original already done
    if (variant === primaryArtist) continue;
    await sleep(SEARCH_DELAY_MS);
    const res = await searchTracks(`${variant} ${clean || title}`, artist, token, artistById);
    extraSearches.push(...res);
  }

  // Album hint: some tracks are not indexed by title but appear when searching by album
  if (album) {
    await sleep(SEARCH_DELAY_MS);
    const fbAlbum = await searchTracks(`${primaryArtist} ${album}`, artist, token, artistById);
    extraSearches.push(...fbAlbum);
  }

  const merged = [
    ...new Map(
      [...primary, ...fbTitle, ...fbArtist, ...fbDot, ...fbReversed, ...fbClean, ...fbNorm, ...extraSearches].map((c) => [c.id, c])
    ).values(),
  ];

  // Sort candidates by score descending, verify until one passes
  const scored = scoreAll(merged).sort((a, b) => b.score - a.score);
  if (process.env.TIDAL_DEBUG) {
    const top5 = scored.slice(0, 5);
    if (top5.length === 0) {
      console.log(`  [debug] no candidates returned by search`);
    } else {
      console.log(`  [debug] top candidates:`);
      top5.forEach(s => console.log(`    score=${s.score.toFixed(2)} artist=${s.candidate.artistName} title=${s.candidate.title}`));
    }
  }
  const topCandidates = scored.filter((s) => s.score >= CONFIDENT_THRESHOLD).slice(0, 20);

  for (const candidate of topCandidates) {
    const result = await verify(candidate);
    if (result !== null && result !== undefined) return result; // verified ✓
    // null = wrong artist confirmed, undefined = lookup failed — try next in both cases
  }

  // Fallback: RAI sometimes stores label/show as artist and "Real Artist - Real Title" in title.
  // If title contains " - ", extract potential altArtist + altTitle and try a separate search.
  const dashIdx = title.indexOf(" - ");
  if (dashIdx > 0) {
    const altArtist = title.slice(0, dashIdx).trim();
    const altTitle = cleanTitle(title.slice(dashIdx + 3).trim());
    const altArtistWords = altArtist.trim().split(/\s+/);
    const altTitleWords = altTitle.trim().split(/\s+/);
    const isLikelyLabel = /records?|music|productions?|autoproduzione|distribution|\b\d{4}\b/i.test(altTitle);

    if (altArtistWords.length >= 2 && altTitleWords.length >= 2 && !isLikelyLabel) {
      const altArtistNorm = normalizeArtistForSearch(altArtist);
      await sleep(SEARCH_DELAY_MS);
      const altRes = await searchTracks(`${altArtistNorm} ${altTitle}`, altArtist, token, artistById);

      const altTopCandidates = altRes
        .map((c) => ({ candidate: c, ...computeMatchScore(altArtist, altTitle, c.artistName, cleanTitle(c.title)) }))
        .filter((s) => s.score >= CONFIDENT_THRESHOLD)
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);

      for (const candidate of altTopCandidates) {
        const result = await verify(candidate, altArtist, altTitle);
        if (result !== null && result !== undefined) return result;
      }
    }
  }

  return null;
};

export const createPlaylist = async (
  name: string,
  token: string
): Promise<string> => {
  const data = await tidalFetch(`/playlists?countryCode=${COUNTRY_CODE}`, token, {
    method: "POST",
    body: JSON.stringify({
      data: {
        type: "playlists",
        attributes: { name, privacy: "PUBLIC" },
      },
    }),
  });
  return data.data.id;
};

export const getPlaylistTrackIds = async (
  playlistId: string,
  token: string
): Promise<Set<string>> => {
  const ids = new Set<string>();
  let cursor: string | null = null;

  try {
    let nextPath: string | null =
      `/playlists/${playlistId}/relationships/items`;

    do {
      const data = await tidalFetch(nextPath, token);
      for (const item of data?.data ?? []) {
        if (item.id) ids.add(item.id);
      }
      // TIDAL uses page[cursor] param — use links.next path directly
      nextPath = data?.links?.next ?? null;
      if (nextPath) await sleep(1000);
    } while (nextPath);
  } catch (e: any) {
    if (e.message?.includes("404")) throw e;
    logError(`fetching playlist tracks`, e.message);
  }

  return ids;
};

export const deletePlaylist = async (
  playlistId: string,
  token: string
): Promise<void> => {
  await tidalFetch(`/playlists/${playlistId}`, token, { method: "DELETE" });
};

export const addTrackToPlaylist = async (
  playlistId: string,
  trackId: string,
  token: string
): Promise<boolean> => {
  try {
    await tidalFetch(`/playlists/${playlistId}/relationships/items`, token, {
      method: "POST",
      body: JSON.stringify({
        data: [{ id: trackId, type: "tracks" }],
      }),
    });
    return true;
  } catch (e: any) {
    logError(`adding track ${trackId} to playlist`, e.message);
    return false;
  }
};
