import { computeMatchScore, CONFIDENT_THRESHOLD, MIN_ARTIST_VERIFY } from "./similarity.js";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const SEARCH_DELAY_MS = 800;

const BASE_URL = "https://openapi.tidal.com/v2";
const COUNTRY_CODE = process.env.TIDAL_COUNTRY_CODE ?? "IT";

export interface TidalTrack {
  id: string;
  title: string;
  artistName: string;
  albumName?: string;
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
      `/searchResults/${encoded}?countryCode=${COUNTRY_CODE}&include=tracks%2Cartists%2Calbums`,
      token
    );

    const included: any[] = data?.included ?? [];

    // Build id → name maps for artists and albums
    const localArtistMap = new Map<string, string>();
    for (const a of included.filter((r: any) => r.type === "artists")) {
      if (a.id && a.attributes?.name) {
        localArtistMap.set(a.id, a.attributes.name);
        artistById?.set(a.id, a.attributes.name);
      }
    }
    const localAlbumMap = new Map<string, string>();
    for (const al of included.filter((r: any) => r.type === "albums")) {
      if (al.id && al.attributes?.title) localAlbumMap.set(al.id, al.attributes.title);
    }

    return included
      .filter((r: any) => r.type === "tracks")
      .map((t: any) => {
        const artistIds: string[] = t.relationships?.artists?.data?.map((a: any) => a.id) ?? [];
        const artistName = artistIds.map((id) => localArtistMap.get(id)).find(Boolean)
          ?? expectedArtist;
        const albumIds: string[] = t.relationships?.albums?.data?.map((a: any) => a.id) ?? [];
        const albumName = albumIds.map((id) => localAlbumMap.get(id)).find(Boolean);
        return {
          id: t.id,
          title: t.attributes?.title ?? "",
          artistName,
          albumName,
        };
      })
      .filter((t) => t.title);
  } catch (e: any) {
    console.error(`❌ Error during TIDAL search "${query}": ${e.message}`);
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
      if (verified.artistScore < MIN_ARTIST_VERIFY) return null; // artist too different even if title matches
      return { id: candidate.candidate.id, ...verified };
    } catch {
      return undefined; // network error, skip
    }
  };

  const artistVariants = artistSearchVariants(artist);
  const normArtist = artistVariants[1] ?? artistVariants[0];
  const cleanNorm = normalizeTitleForSearch(scoreTitle);

  // ── 1. Title-only searches (primary — high recall) ───────────────────────
  await sleep(SEARCH_DELAY_MS);
  const byTitle = await searchTracks(scoreTitle, artist, token, artistById);

  const byTitleNorm = cleanNorm !== scoreTitle
    ? (await sleep(SEARCH_DELAY_MS), await searchTracks(cleanNorm, artist, token, artistById))
    : [];

  // ── 2. "title - artist" (TIDAL indexes this format well for many catalogs) ──
  await sleep(SEARCH_DELAY_MS);
  const byTitleDashArtist = await searchTracks(`${scoreTitle} - ${normArtist}`, artist, token, artistById);

  // ── 2b. "artist title" combined (most direct for niche catalog artists) ────
  await sleep(SEARCH_DELAY_MS);
  const byArtistTitle = await searchTracks(`${normArtist} ${cleanNorm}`, artist, token, artistById);

  // ── 3. Artist search (surfaces catalog when title alone is ambiguous) ─────
  await sleep(SEARCH_DELAY_MS);
  const byArtist = await searchTracks(normArtist, artist, token, artistById);

  // Extra artist variants (dots, slash, & parts)
  const byVariants: TidalTrack[] = [];
  for (const variant of artistVariants.slice(2)) {
    await sleep(SEARCH_DELAY_MS);
    byVariants.push(...await searchTracks(variant, artist, token, artistById));
  }

  // ── 3. Album searches (strong signal for niche catalog artists) ───────────
  const byAlbum: TidalTrack[] = [];
  if (album) {
    await sleep(SEARCH_DELAY_MS);
    byAlbum.push(...await searchTracks(album, artist, token, artistById));
    await sleep(SEARCH_DELAY_MS);
    byAlbum.push(...await searchTracks(`${normArtist} ${album}`, artist, token, artistById));
  }

  // ── 4. Merge & deduplicate ────────────────────────────────────────────────
  const nonAlbumIds = new Set(
    [...byTitle, ...byTitleNorm, ...byTitleDashArtist, ...byArtistTitle, ...byArtist, ...byVariants].map((c) => c.id)
  );
  const merged = [
    ...new Map(
      [...byTitle, ...byTitleNorm, ...byTitleDashArtist, ...byArtistTitle, ...byArtist, ...byVariants, ...byAlbum].map((c) => [c.id, c])
    ).values(),
  ];

  // ── 5. Score, filter by title, rank by artist → album → title ────────────
  // Album score: compare our album string against TIDAL album name (if available).
  const albumScore = (c: TidalTrack): number =>
    album && c.albumName
      ? computeMatchScore("", album, "", c.albumName).titleScore
      : 0;

  const TITLE_THRESHOLD = 0.55;
  const ALBUM_ONLY_TITLE_THRESHOLD = 0.7;

  const topCandidates = scoreAll(merged)
    .filter((s) => {
      const minTitle = nonAlbumIds.has(s.candidate.id) ? TITLE_THRESHOLD : ALBUM_ONLY_TITLE_THRESHOLD;
      return s.titleScore >= minTitle;
    })
    .sort((a, b) =>
      b.artistScore - a.artistScore ||
      albumScore(b.candidate) - albumScore(a.candidate) ||
      b.titleScore - a.titleScore
    )
    .slice(0, 20);

  if (process.env.TIDAL_DEBUG) {
    if (topCandidates.length === 0) {
      console.log(`  [debug] no candidates above title threshold`);
    } else {
      console.log(`  [debug] top candidates:`);
      topCandidates.slice(0, 5).forEach((s) =>
        console.log(`    artist=${s.artistScore.toFixed(2)} album=${albumScore(s.candidate).toFixed(2)} title=${s.titleScore.toFixed(2)} — ${s.candidate.artistName} – ${s.candidate.title}`)
      );
    }
  }

  // ── 6. Verify ─────────────────────────────────────────────────────────────
  for (const candidate of topCandidates) {
    const result = await verify(candidate);
    if (result !== null && result !== undefined) return result;
  }

  // ── 7. Fallback: RAI label-as-artist pattern ("Real Artist - Real Title") ─
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
      `/playlists/${playlistId}/relationships/items?countryCode=${COUNTRY_CODE}`;

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
    console.error(`❌ Error during fetching playlist tracks: ${e.message}`);
  }

  return ids;
};

export const deletePlaylist = async (
  playlistId: string,
  token: string
): Promise<void> => {
  await tidalFetch(`/playlists/${playlistId}`, token, { method: "DELETE" });
};

export const getTrackInfo = async (
  id: string,
  token: string
): Promise<{ title: string; artist: string } | null> => {
  try {
    const data = await tidalFetch(`/tracks/${id}?countryCode=${COUNTRY_CODE}&include=artists`, token);
    const title: string = data?.data?.attributes?.title ?? "";
    const artists: string[] = (data?.included ?? [])
      .filter((x: any) => x.type === "artists")
      .map((a: any) => a.attributes?.name ?? "")
      .filter(Boolean);
    return { title, artist: artists.join(", ") || "?" };
  } catch {
    return null;
  }
};

export const getUserFavoriteTrackIds = async (
  userId: string,
  token: string,
  /** ISO date string — stop fetching pages once all items on a page are older than this */
  sinceDate?: string
): Promise<{ ids: Set<string>; latestDate: string | null }> => {
  const ids = new Set<string>();
  let latestDate: string | null = null;
  const since = sinceDate ? new Date(sinceDate).getTime() : null;

  // Items arrive newest-first; stop as soon as we hit the checkpoint date
  let nextPath: string | null =
    `/userCollections/${userId}/relationships/tracks?countryCode=${COUNTRY_CODE}`;

  do {
    const data = await tidalFetch(nextPath, token);
    let hitCheckpoint = false;

    for (const entry of (data?.data ?? []) as Array<{ id: string; meta: { addedAt: string } }>) {
      const addedAt = entry.meta?.addedAt ?? null;
      if (addedAt && (!latestDate || addedAt > latestDate)) latestDate = addedAt;
      if (since && addedAt && new Date(addedAt).getTime() <= since) {
        hitCheckpoint = true;
        break;
      }
      ids.add(entry.id);
    }

    if (hitCheckpoint) break;
    nextPath = data?.links?.next ?? null;
    if (nextPath) await sleep(600);
  } while (nextPath);

  return { ids, latestDate };
};

export const addTrackToPlaylist = async (
  playlistId: string,
  trackId: string,
  token: string
): Promise<boolean> => {
  try {
    const res = await tidalFetch(`/playlists/${playlistId}/relationships/items`, token, {
      method: "POST",
      body: JSON.stringify({
        data: [{ id: trackId, type: "tracks" }],
      }),
    });
    // data: [] means TIDAL rejected the add (geo-restricted or unavailable)
    if (res && Array.isArray(res.data) && res.data.length === 0) {
      console.log(`   ↳ track ${trackId}: skipped (unavailable in region)`);
      return false;
    }
    return true;
  } catch (e: any) {
    console.error(`❌ Error during adding track ${trackId} to playlist: ${e.message}`);
    return false;
  }
};
