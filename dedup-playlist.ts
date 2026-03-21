import "dotenv/config";
import fsPromises from "fs/promises";
import { getAccessToken } from "./lib/tidalAuth.js";
import { createPlaylist, addTrackToPlaylist } from "./lib/tidalClient.js";
import { logError } from "./lib/logger.js";

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

const GLOBAL_PLAYLIST_FILE = "./data/global_playlist.json";
const SAVE_EVERY = 100;

const dedupPlaylist = async () => {
  const { id: oldId } = JSON.parse(await fsPromises.readFile(GLOBAL_PLAYLIST_FILE, "utf-8"));

  console.log(`🔍 Fetching all tracks from BATTITI (${oldId})...`);
  const token = await getAccessToken();
  const allIds = await fetchAllTrackIds(oldId, token);
  console.log(`   Total items fetched: ${allIds.length}`);

  const unique = [...new Set(allIds)];
  const dupCount = allIds.length - unique.length;

  if (dupCount === 0) {
    console.log("✅ No duplicates found.");
    return;
  }

  console.log(`⚠️  ${dupCount} duplicates found. Unique tracks: ${unique.length}`);
  console.log(`📋 Creating new BATTITI playlist...`);

  const newId = await createPlaylist("BATTITI", token);
  console.log(`   New playlist ID: ${newId}`);
  await fsPromises.writeFile(GLOBAL_PLAYLIST_FILE, JSON.stringify({ id: newId }, null, 2));
  console.log(`   Updated global_playlist.json`);

  console.log(`➕ Adding ${unique.length} tracks...`);
  let added = 0;
  let failed = 0;
  let currentToken = token;
  for (let i = 0; i < unique.length; i++) {
    if (i % 50 === 0) currentToken = await getAccessToken();
    await sleep(600);
    const ok = await addTrackToPlaylist(newId, unique[i], currentToken);
    if (ok) {
      added++;
      if (added % SAVE_EVERY === 0) process.stdout.write(`\r   ${added}/${unique.length}`);
    } else {
      failed++;
    }
  }

  console.log(`\n✅ Done. Added ${added}/${unique.length} tracks (${failed} failed).`);

  // Delete the old playlist
  try {
    currentToken = await getAccessToken();
    const res = await fetch(`${BASE_URL}/playlists/${oldId}?countryCode=${COUNTRY_CODE}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${currentToken}`, "Content-Type": "application/vnd.api+json" },
    });
    if (res.ok || res.status === 404) {
      console.log(`🗑️  Old playlist ${oldId} deleted.`);
    } else {
      console.log(`⚠️  Could not delete old playlist ${oldId} (${res.status}) — cancellala manualmente.`);
    }
  } catch (e: any) {
    console.log(`⚠️  Could not delete old playlist ${oldId} — cancellala manualmente.`);
  }
};

dedupPlaylist().catch((e) => logError("dedup-playlist", e.message));
