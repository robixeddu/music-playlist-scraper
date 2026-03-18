import { logError } from "./logger.js";
import { computeMatchScore } from "./similarity.js";

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
  options: RequestInit = {}
): Promise<any> => {
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

export const searchTracks = async (
  query: string,
  expectedArtist: string,
  token: string
): Promise<TidalTrack[]> => {
  try {
    const encoded = encodeURIComponent(query);
    const data = await tidalFetch(
      `/searchResults/${encoded}?countryCode=${COUNTRY_CODE}&include=tracks%2Cartists`,
      token
    );

    const included: any[] = data?.included ?? [];

    const includedArtists = included
      .filter((r: any) => r.type === "artists")
      .map((a: any) => a.attributes?.name ?? "")
      .filter(Boolean);

    // Pick the included artist that best matches our expected artist.
    // TIDAL does not link artists to tracks inline — we pick from the pool.
    const bestArtist = includedArtists.length > 0
      ? includedArtists.reduce((best, candidate) => {
          const score = computeMatchScore(expectedArtist, "", candidate, "").artistScore;
          const bestScore = computeMatchScore(expectedArtist, "", best, "").artistScore;
          return score > bestScore ? candidate : best;
        }, includedArtists[0])
      : expectedArtist;

    return included
      .filter((r: any) => r.type === "tracks")
      .map((t: any) => ({
        id: t.id,
        title: t.attributes?.title ?? "",
        artistName: bestArtist,
      }))
      .filter(t => t.title);
  } catch (e: any) {
    logError(`TIDAL search "${query}"`, e.message);
    return [];
  }
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
    do {
      const qs = `countryCode=${COUNTRY_CODE}&pageCursor=${cursor ?? ""}`;
      const data = await tidalFetch(
        `/playlists/${playlistId}/relationships/items?${qs}`,
        token
      );
      for (const item of data?.data ?? []) {
        if (item.id) ids.add(item.id);
      }
      cursor = data?.links?.next
        ? new URL(data.links.next, BASE_URL).searchParams.get("pageCursor")
        : null;
    } while (cursor);
  } catch (e: any) {
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
