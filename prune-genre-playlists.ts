/**
 * prune-genre-playlists.ts
 *
 * Removes from each genre playlist any track that is no longer associated
 * with that genre in tracks.json (e.g. after a manual tidalId correction).
 *
 * Strategy: rebuild (create new + delete old) to avoid needing meta.itemId.
 */

import "dotenv/config";
import fsPromises from "fs/promises";
import { getAccessToken } from "./lib/tidalAuth.js";
import { createPlaylist, addTrackToPlaylist, deletePlaylist } from "./lib/tidalClient.js";
import { TRACKS_FILE, GENRE_PLAYLISTS_FILE, PLAYLIST_PREFIX } from "./lib/config.js";
import { EpisodeAggregated } from "./lib/types.js";
import { normalizeGenre } from "./lib/genres.js";
import { logError } from "./lib/logger.js";

const ADD_DELAY_MS = 600;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const BASE_URL = "https://openapi.tidal.com/v2";

const tidalFetch = async (path: string, token: string): Promise<any> => {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/vnd.api+json",
    },
  });
  if (!res.ok) throw new Error(`TIDAL API ${res.status} on ${path}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
};

const fetchAllTrackIds = async (playlistId: string, token: string): Promise<string[]> => {
  const ids: string[] = [];
  let nextPath: string | null = `/playlists/${playlistId}/relationships/items`;
  do {
    const data = await tidalFetch(nextPath, token);
    for (const item of data?.data ?? []) {
      if (item.id) ids.push(item.id);
    }
    nextPath = data?.links?.next ?? null;
    if (nextPath) await sleep(1000);
  } while (nextPath);
  return ids;
};

const main = async () => {
  const episodes: EpisodeAggregated[] = JSON.parse(
    await fsPromises.readFile(TRACKS_FILE, "utf-8")
  );

  // Build valid tidalIds per genre from tracks.json
  const validIds = new Map<string, Set<string>>();
  for (const ep of episodes) {
    for (const track of ep.tracks) {
      if (!track.tidalId) continue;
      for (const rawGenre of track.genres ?? []) {
        const genre = normalizeGenre(rawGenre);
        if (!genre) continue;
        if (!validIds.has(genre)) validIds.set(genre, new Set());
        validIds.get(genre)!.add(track.tidalId);
      }
    }
  }

  const genrePlaylists: Record<string, string> = JSON.parse(
    await fsPromises.readFile(GENRE_PLAYLISTS_FILE, "utf-8")
  );

  const genres = Object.keys(genrePlaylists);
  console.log(`\n✂️  Pruning ${genres.length} genre playlists...\n`);

  let token = await getAccessToken();
  let totalPruned = 0;
  let rebuilt = 0;

  for (let i = 0; i < genres.length; i++) {
    if (i % 10 === 0) token = await getAccessToken();

    const genre = genres[i];
    const playlistId = genrePlaylists[genre];
    const valid = validIds.get(genre) ?? new Set<string>();

    process.stdout.write(`[${i + 1}/${genres.length}] ${PLAYLIST_PREFIX}-${genre} `);

    let currentIds: string[];
    try {
      currentIds = await fetchAllTrackIds(playlistId, token);
    } catch (e: any) {
      if (e.message?.includes("404")) {
        console.log(`→ 404, skipping`);
        continue;
      }
      throw e;
    }

    const toKeep = [...new Set(currentIds)].filter((id) => valid.has(id));
    const stale = currentIds.length - toKeep.length;

    if (stale === 0) {
      console.log(`→ ${currentIds.length} tracks, all valid ✅`);
      continue;
    }

    console.log(`→ ${currentIds.length} tracks, ${stale} stale — rebuilding...`);
    totalPruned += stale;

    token = await getAccessToken();
    const newId = await createPlaylist(`${PLAYLIST_PREFIX}-${genre}`, token);
    let added = 0;

    for (let j = 0; j < toKeep.length; j++) {
      if (j % 50 === 0) token = await getAccessToken();
      await sleep(ADD_DELAY_MS);
      const ok = await addTrackToPlaylist(newId, toKeep[j], token);
      if (ok) added++;
    }

    token = await getAccessToken();
    await deletePlaylist(playlistId, token);

    genrePlaylists[genre] = newId;
    await fsPromises.writeFile(GENRE_PLAYLISTS_FILE, JSON.stringify(genrePlaylists, null, 2));

    console.log(`  ✅ ${added}/${toKeep.length} kept, ${stale} removed, old playlist deleted`);
    rebuilt++;
  }

  console.log(`\n✅ Done. ${rebuilt} playlists rebuilt, ${totalPruned} stale tracks removed.`);
};

main().catch((e) => logError("prune-genre-playlists", e.message));
