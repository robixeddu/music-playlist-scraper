import "dotenv/config";
import fsPromises from "fs/promises";
import { getAccessToken } from "./lib/tidalAuth.js";
import { createPlaylist, addTrackToPlaylist } from "./lib/tidalClient.js";
import { TRACKS_FILE, GLOBAL_PLAYLIST_FILE, PLAYLIST_PREFIX } from "./lib/config.js";
import { EpisodeAggregated } from "./lib/types.js";

const BASE_URL = "https://openapi.tidal.com/v2";
const COUNTRY_CODE = process.env.TIDAL_COUNTRY_CODE ?? "IT";
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

const reconcile = async () => {
  // Load valid IDs from tracks.json
  const episodes: EpisodeAggregated[] = JSON.parse(await fsPromises.readFile(TRACKS_FILE, "utf-8"));
  const validIds = new Set<string>();
  for (const ep of episodes) {
    for (const track of ep.tracks) {
      if (track.tidalId) validIds.add(track.tidalId);
    }
  }
  console.log(`📂 tracks.json: ${validIds.size} valid TIDAL IDs`);

  const { id: oldId } = JSON.parse(await fsPromises.readFile(GLOBAL_PLAYLIST_FILE, "utf-8"));
  let token = await getAccessToken();

  console.log(`🔍 Fetching all tracks from ${PLAYLIST_PREFIX} (${oldId})...`);
  const playlistIds = await fetchAllTrackIds(oldId, token);
  console.log(`   Playlist items: ${playlistIds.length}`);

  const toKeep = [...new Set(playlistIds)].filter((id) => validIds.has(id));
  const stale = playlistIds.length - toKeep.length;
  console.log(`   Stale/removed: ${stale} | Unique valid: ${toKeep.length}\n`);

  if (stale === 0) {
    console.log("✅ Playlist already in sync with tracks.json.");
    return;
  }

  token = await getAccessToken();
  console.log(`📋 Creating new ${PLAYLIST_PREFIX} playlist...`);
  const newId = await createPlaylist(PLAYLIST_PREFIX, token);
  console.log(`   New ID: ${newId}`);
  await fsPromises.writeFile(GLOBAL_PLAYLIST_FILE, JSON.stringify({ id: newId }, null, 2));

  console.log(`➕ Adding ${toKeep.length} tracks...`);
  let added = 0;
  let failed = 0;
  for (let i = 0; i < toKeep.length; i++) {
    if (i % 50 === 0) token = await getAccessToken();
    await sleep(600);
    const ok = await addTrackToPlaylist(newId, toKeep[i], token);
    if (ok) {
      added++;
      if (added % 100 === 0) process.stdout.write(`\r   ${added}/${toKeep.length}`);
    } else {
      failed++;
    }
  }
  console.log(`\n✅ Added ${added}/${toKeep.length} (${failed} failed).`);

  // Delete old playlist
  try {
    token = await getAccessToken();
    const res = await fetch(`${BASE_URL}/playlists/${oldId}?countryCode=${COUNTRY_CODE}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/vnd.api+json" },
    });
    if (res.ok || res.status === 404) {
      console.log(`🗑️  Old playlist ${oldId} deleted.`);
    } else {
      console.log(`⚠️  Could not delete old playlist (${res.status}) — cancellala manualmente.`);
    }
  } catch {
    console.log(`⚠️  Could not delete old playlist — cancellala manualmente.`);
  }
};

reconcile().catch((e) => console.error(`❌ Error during reconcile-global-playlist: ${e.message}`));
