"use client";

const TIDAL_BASE_URL = "https://openapi.tidal.com/v2";
const BASE = "/tidal-api";
const COUNTRY_CODE = process.env.NEXT_PUBLIC_TIDAL_COUNTRY_CODE ?? "IT";

function headers(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/vnd.api+json",
  };
}

// ── Get playlist info (count without fetching all items) ─────────────────────

export async function getPlaylistCount(token: string, playlistId: string): Promise<number | null> {
  const res = await fetchWithRetry(
    `${BASE}/playlists/${playlistId}?countryCode=${COUNTRY_CODE}`,
    { headers: headers(token) }
  );
  if (!res.ok) {
    if (res.status === 404) throw new TidalNotFoundError();
    return null;
  }
  const json = (await res.json()) as {
    data?: { attributes?: { numberOfItems?: number } };
  };
  return json.data?.attributes?.numberOfItems ?? null;
}

// ── Create playlist ───────────────────────────────────────────────────────────

export async function createPlaylist(
  token: string,
  name: string,
  description: string
): Promise<string> {
  const res = await fetchWithRetry(`${BASE}/playlists`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify({
      data: {
        type: "playlists",
        attributes: { name, description },
      },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Create playlist failed: ${text}`);
  }
  const data = (await res.json()) as { data: { id: string } };
  return data.data.id;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Get existing playlist items (paginated) ───────────────────────────────────

const PAGE_DELAY_MS = 400;
const MAX_RETRIES = 3;

async function fetchWithRetry(url: string, opts: RequestInit): Promise<Response> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(url, opts);
    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get("Retry-After") ?? "2", 10);
      const waitMs = (isNaN(retryAfter) ? 2 : retryAfter) * 1000 + attempt * 1000;
      await delay(waitMs);
      continue;
    }
    return res;
  }
  throw new Error("Too many retries (429)");
}

export class TidalNotFoundError extends Error {
  constructor() { super("TIDAL_PLAYLIST_NOT_FOUND"); }
}

export async function getPlaylistItemIds(
  token: string,
  playlistId: string
): Promise<Set<string>> {
  const ids = new Set<string>();
  let url: string | null =
    `${BASE}/playlists/${playlistId}/relationships/items?countryCode=${COUNTRY_CODE}&limit=100`;
  let firstPage = true;

  while (url) {
    if (!firstPage) await delay(PAGE_DELAY_MS);
    firstPage = false;

    const res = await fetchWithRetry(url, { headers: headers(token) });
    if (!res.ok) {
      if (res.status === 404) throw new TidalNotFoundError();
      const text = await res.text();
      throw new Error(`Get playlist items failed: ${text}`);
    }
    const json = (await res.json()) as {
      data: Array<{ id: string }>;
      links?: { next?: string | null };
    };
    for (const item of json.data) {
      ids.add(item.id);
    }
    // Normalize next page URL to proxy path
    const next = json.links?.next ?? null;
    if (!next) {
      url = null;
    } else {
      const path = next.replace(TIDAL_BASE_URL, "");
      url = path.startsWith(BASE) ? path : `${BASE}${path}`;
    }
  }

  return ids;
}

// ── Get playlist items with meta.itemId (for deletion) ───────────────────────

export interface PlaylistItemMeta {
  id: string;     // track ID
  itemId: string; // meta.itemId — required for DELETE
}

export async function getPlaylistItemsWithMeta(
  token: string,
  playlistId: string
): Promise<PlaylistItemMeta[]> {
  const items: PlaylistItemMeta[] = [];
  let url: string | null =
    `${BASE}/playlists/${playlistId}/relationships/items?countryCode=${COUNTRY_CODE}&limit=100`;
  let firstPage = true;

  while (url) {
    if (!firstPage) await delay(PAGE_DELAY_MS);
    firstPage = false;

    const res = await fetchWithRetry(url, { headers: headers(token) });
    if (!res.ok) {
      if (res.status === 404) throw new TidalNotFoundError();
      const text = await res.text();
      throw new Error(`Get playlist items failed: ${text}`);
    }
    const json = (await res.json()) as {
      data: Array<{ id: string; meta?: { itemId?: string } }>;
      links?: { next?: string | null };
    };
    for (const item of json.data) {
      if (item.meta?.itemId) {
        items.push({ id: item.id, itemId: item.meta.itemId });
      }
    }
    const next = json.links?.next ?? null;
    if (!next) {
      url = null;
    } else {
      const path = next.replace(TIDAL_BASE_URL, "");
      url = path.startsWith(BASE) ? path : `${BASE}${path}`;
    }
  }

  return items;
}

// ── Remove items by meta.itemId ───────────────────────────────────────────────

const DELETE_BATCH_SIZE = 20;

export async function removeItemsFromPlaylist(
  token: string,
  playlistId: string,
  items: PlaylistItemMeta[]
): Promise<void> {
  for (let i = 0; i < items.length; i += DELETE_BATCH_SIZE) {
    const batch = items.slice(i, i + DELETE_BATCH_SIZE);
    const res = await fetchWithRetry(`${BASE}/playlists/${playlistId}/relationships/items`, {
      method: "DELETE",
      headers: headers(token),
      body: JSON.stringify({
        data: batch.map((item) => ({
          id: item.id,
          type: "tracks",
          meta: { itemId: item.itemId },
        })),
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Remove items failed: ${text}`);
    }
    if (i + DELETE_BATCH_SIZE < items.length) {
      await delay(BATCH_DELAY_MS);
    }
  }
}

// ── Add tracks in batches ─────────────────────────────────────────────────────

const BATCH_SIZE = 20;
const BATCH_DELAY_MS = 600;

export async function addTracksToPlaylist(
  token: string,
  playlistId: string,
  tidalIds: string[]
): Promise<void> {
  for (let i = 0; i < tidalIds.length; i += BATCH_SIZE) {
    const batch = tidalIds.slice(i, i + BATCH_SIZE);
    const res = await fetchWithRetry(`${BASE}/playlists/${playlistId}/relationships/items`, {
      method: "POST",
      headers: headers(token),
      body: JSON.stringify({
        data: batch.map((id) => ({ id, type: "tracks" })),
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Add tracks failed: ${text}`);
    }
    if (i + BATCH_SIZE < tidalIds.length) {
      await delay(BATCH_DELAY_MS);
    }
  }
}
