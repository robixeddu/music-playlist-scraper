import "dotenv/config";
import fsPromises from "fs/promises";
import { getAccessToken } from "./lib/tidalAuth.js";
import { createPlaylist, addTrackToPlaylist } from "./lib/tidalClient.js";
import { logError } from "./lib/logger.js";

const BASE_URL = "https://openapi.tidal.com/v2";
const COUNTRY_CODE = process.env.TIDAL_COUNTRY_CODE ?? "IT";
import { GENRE_PLAYLISTS_FILE, PLAYLIST_PREFIX } from "./lib/config.js";

const ADD_DELAY_MS = 600;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
  let nextPath: string | null =
    `/playlists/${playlistId}/relationships/items?countryCode=${COUNTRY_CODE}`;
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

const deletePlaylist = async (id: string, token: string): Promise<void> => {
  const res = await fetch(`${BASE_URL}/playlists/${id}?countryCode=${COUNTRY_CODE}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/vnd.api+json" },
  });
  if (!res.ok && res.status !== 404) {
    console.log(`  ⚠️  Could not delete ${id} (${res.status})`);
  }
};

const main = async () => {
  const genrePlaylists: Record<string, string> = JSON.parse(
    await fsPromises.readFile(GENRE_PLAYLISTS_FILE, "utf-8")
  );

  const genres = Object.keys(genrePlaylists);
  console.log(`\n🎵 Deduplicating ${genres.length} genre playlists...\n`);

  let token = await getAccessToken();
  let totalDups = 0;
  let processed = 0;

  for (let i = 0; i < genres.length; i++) {
    if (i % 10 === 0) token = await getAccessToken();

    const genre = genres[i];
    const oldId = genrePlaylists[genre];
    process.stdout.write(`[${i + 1}/${genres.length}] ${PLAYLIST_PREFIX}-${genre} `);

    let allIds: string[];
    try {
      allIds = await fetchAllTrackIds(oldId, token);
    } catch (e: any) {
      if (e.message?.includes("404")) {
        console.log(`→ 404, skipping`);
        continue;
      }
      throw e;
    }

    const unique = [...new Set(allIds)];
    const dups = allIds.length - unique.length;

    if (dups === 0) {
      console.log(`→ ${allIds.length} tracks, no dups ✅`);
      processed++;
      continue;
    }

    console.log(`→ ${allIds.length} tracks, ${dups} dups — recreating...`);
    totalDups += dups;

    const newId = await createPlaylist(`${PLAYLIST_PREFIX}-${genre}`, token);
    let added = 0;
    let failed = 0;

    for (let j = 0; j < unique.length; j++) {
      if (j % 50 === 0) token = await getAccessToken();
      await sleep(ADD_DELAY_MS);
      const ok = await addTrackToPlaylist(newId, unique[j], token);
      if (ok) added++;
      else failed++;
    }

    token = await getAccessToken();
    await deletePlaylist(oldId, token);

    genrePlaylists[genre] = newId;
    await fsPromises.writeFile(GENRE_PLAYLISTS_FILE, JSON.stringify(genrePlaylists, null, 2));

    console.log(`  ✅ ${added}/${unique.length} added (${failed} failed), old playlist deleted`);
    processed++;
  }

  console.log(`\n✅ Done. ${processed}/${genres.length} playlists processed, ${totalDups} total duplicates removed.`);
};

main().catch((e) => logError("dedup-genre-playlists", e.message));
