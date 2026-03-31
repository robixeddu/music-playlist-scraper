"use client";

const BASE = "/tidal-api";

function headers(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/vnd.api+json",
  };
}

// ── Create playlist ───────────────────────────────────────────────────────────

export async function createPlaylist(
  token: string,
  name: string,
  description: string
): Promise<string> {
  const res = await fetch(`${BASE}/playlists`, {
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

// ── Get existing playlist items (paginated) ───────────────────────────────────

export async function getPlaylistItemIds(
  token: string,
  playlistId: string
): Promise<Set<string>> {
  const ids = new Set<string>();
  let url: string | null =
    `${BASE}/playlists/${playlistId}/relationships/items?countryCode=IT&limit=100`;

  while (url) {
    const res = await fetch(url, { headers: headers(token) });
    if (!res.ok) {
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
    url = json.links?.next ?? null;
  }

  return ids;
}

// ── Add tracks in batches ─────────────────────────────────────────────────────

const BATCH_SIZE = 20;
const BATCH_DELAY_MS = 600;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function addTracksToPlaylist(
  token: string,
  playlistId: string,
  tidalIds: string[]
): Promise<void> {
  for (let i = 0; i < tidalIds.length; i += BATCH_SIZE) {
    const batch = tidalIds.slice(i, i + BATCH_SIZE);
    const res = await fetch(`${BASE}/playlists/${playlistId}/relationships/items`, {
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
