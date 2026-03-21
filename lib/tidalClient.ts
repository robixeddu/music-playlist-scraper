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

    const includedArtists = included.filter((r: any) => r.type === "artists");

    // Populate caller-provided map with id → name
    if (artistById) {
      for (const a of includedArtists) {
        if (a.id && a.attributes?.name) artistById.set(a.id, a.attributes.name);
      }
    }

    const artistNames = includedArtists
      .map((a: any) => a.attributes?.name ?? "")
      .filter(Boolean);

    // Pick the included artist that best matches our expected artist.
    // TIDAL does not link artists to tracks inline — we pick from the pool.
    const bestArtist = artistNames.length > 0
      ? artistNames.reduce((best: string, candidate: string) => {
          const score = computeMatchScore(expectedArtist, "", candidate, "").artistScore;
          const bestScore = computeMatchScore(expectedArtist, "", best, "").artistScore;
          return score > bestScore ? candidate : best;
        }, artistNames[0])
      : expectedArtist;

    return included
      .filter((r: any) => r.type === "tracks")
      .map((t: any) => ({
        id: t.id,
        title: t.attributes?.title ?? "",
        artistName: bestArtist,
      }))
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

// Strip (feat. ...), [remix], ", da "Album"" etc. for cleaner TIDAL search queries
const cleanTitle = (title: string): string =>
  title
    .replace(/,\s*da\s+"[^"]*"/gi, "")  // RAI: ", da "Album name""
    .replace(/\s*[\(\[].*?[\)\]]/g, "")
    .trim();

export const findTidalMatch = async (
  artist: string,
  title: string,
  token: string
): Promise<TidalMatch | null> => {
  const clean = cleanTitle(title);
  const artistById = new Map<string, string>();

  const scoreAll = (candidates: TidalTrack[]) =>
    candidates.map((c) => ({
      candidate: c,
      ...computeMatchScore(artist, title, c.artistName, c.title),
    }));

  await sleep(SEARCH_DELAY_MS);
  const primary = await searchTracks(`${artist} ${title}`, artist, token, artistById);
  const primaryScored = scoreAll(primary);
  let best = primaryScored.length > 0
    ? primaryScored.reduce((a, b) => (a.score > b.score ? a : b))
    : null;

  if (!best || best.score < CONFIDENT_THRESHOLD) {
    await sleep(SEARCH_DELAY_MS);
    const fbTitle = await searchTracks(title, artist, token, artistById);
    await sleep(SEARCH_DELAY_MS);
    const fbArtist = await searchTracks(artist, artist, token, artistById);
    await sleep(SEARCH_DELAY_MS);
    const fbDot = await searchTracks(`${artist} ${title}.`, artist, token, artistById);
    const fbClean = clean !== title
      ? (await sleep(SEARCH_DELAY_MS), await searchTracks(`${artist} ${clean}`, artist, token, artistById))
      : [];

    const merged = [
      ...new Map(
        [...primary, ...fbTitle, ...fbArtist, ...fbDot, ...fbClean].map((c) => [c.id, c])
      ).values(),
    ];
    if (merged.length > 0) {
      best = scoreAll(merged).reduce((a, b) => (a.score > b.score ? a : b));
    }
  }

  if (!best || best.score < CONFIDENT_THRESHOLD) return null;

  // Verify the actual TIDAL artist to prevent cover-song mismatches
  // (the pooled bestArtist can be erroneously assigned to unrelated tracks)
  try {
    await sleep(400);
    const rel = await tidalFetch(
      `/tracks/${best.candidate.id}/relationships/artists?countryCode=${COUNTRY_CODE}`,
      token
    );
    const artistIds: string[] = (rel?.data ?? []).map((a: any) => a.id);

    // Try map first; if not found, fetch from API
    let actualArtist = artistIds.map((id) => artistById.get(id)).find(Boolean);
    if (!actualArtist && artistIds.length > 0) {
      await sleep(400);
      const artistData = await tidalFetch(
        `/artists/${artistIds[0]}?countryCode=${COUNTRY_CODE}`,
        token
      );
      actualArtist = artistData?.data?.attributes?.name ?? undefined;
    }

    if (actualArtist) {
      const verified = computeMatchScore(artist, title, actualArtist, best.candidate.title);
      if (verified.score < CONFIDENT_THRESHOLD) return null;
      return {
        id: best.candidate.id,
        score: verified.score,
        artistScore: verified.artistScore,
        titleScore: verified.titleScore,
      };
    }
  } catch {
    // Verification failed — fall through to return unverified best
  }

  return {
    id: best.candidate.id,
    score: best.score,
    artistScore: best.artistScore,
    titleScore: best.titleScore,
  };
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
    logError(`fetching playlist tracks`, e.message);
  }

  return ids;
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
