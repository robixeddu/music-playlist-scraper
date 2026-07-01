import "dotenv/config";
import { fileURLToPath } from "url";
import fsPromises from "fs/promises";
import { getAccessToken, getUserId } from "../lib/tidalAuth.js";
import { createPlaylist, getPlaylistTrackIds, addTrackToPlaylist, getUserFavoriteTrackIds } from "../lib/tidalClient.js";
import { TRACKS_FILE, PLAYLIST_PREFIX, LOVED_CHECKPOINT_FILE } from "../lib/config.js";
import { EpisodeAggregated } from "../lib/types.js";
import { getPlaylistId, setPlaylistId } from "../lib/redisClient.js";

const ADD_DELAY_MS = 600;
const PLAYLIST_NAME = `${PLAYLIST_PREFIX}-loved`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const loadCheckpoint = async (): Promise<string | null> => {
  try {
    const raw = await fsPromises.readFile(LOVED_CHECKPOINT_FILE, "utf-8");
    return (JSON.parse(raw) as { lastLovedAt: string }).lastLovedAt ?? null;
  } catch {
    return null;
  }
};

const saveCheckpoint = async (lastLovedAt: string): Promise<void> => {
  await fsPromises.writeFile(LOVED_CHECKPOINT_FILE, JSON.stringify({ lastLovedAt }, null, 2));
};

export const loved = async () => {
  let token = await getAccessToken();
  const userId = await getUserId();

  // 1. Collect battiti tidalIds into a lookup set
  const raw = await fsPromises.readFile(TRACKS_FILE, "utf-8");
  const episodes: EpisodeAggregated[] = JSON.parse(raw);

  const battitiIds = new Set<string>();
  for (const ep of episodes) {
    for (const track of ep.tracks) {
      if (track.tidalId) battitiIds.add(track.tidalId);
    }
  }
  console.log(`\n🎵 Battiti tracks with TIDAL ID: ${battitiIds.size}`);

  // 2. Fetch loved tracks from TIDAL, stopping at last checkpoint
  const sinceDate = await loadCheckpoint();
  if (sinceDate) {
    console.log(`❤️  Fetching loved tracks since ${sinceDate}...`);
  } else {
    console.log("❤️  Fetching all loved tracks from TIDAL (first run)...");
  }

  const { ids: lovedIds, latestDate } = await getUserFavoriteTrackIds(userId, token, sinceDate ?? undefined);
  console.log(`   Found ${lovedIds.size} loved track(s) to process`);

  // 3. Intersection: new loved tracks that come from Battiti
  const lovedBattiti = [...lovedIds].filter((id) => battitiIds.has(id));
  console.log(`   ✨ ${lovedBattiti.length} of them come from Battiti\n`);

  if (lovedBattiti.length === 0) {
    if (latestDate) await saveCheckpoint(latestDate);
    console.log("✅ Nothing new to add.");
    return;
  }

  // 4. Get or create playlist
  token = await getAccessToken();
  let playlistId = await getPlaylistId(userId, "loved", "loved");

  if (!playlistId) {
    playlistId = await createPlaylist(PLAYLIST_NAME, token);
    await setPlaylistId(userId, "loved", "loved", playlistId);
    console.log(`📋 Created playlist "${PLAYLIST_NAME}" (${playlistId})`);
  } else {
    console.log(`📋 Reusing playlist "${PLAYLIST_NAME}" (${playlistId})`);
  }

  // 5. Fetch already-present tracks (idempotent)
  token = await getAccessToken();
  let existing: Set<string>;
  try {
    existing = await getPlaylistTrackIds(playlistId, token);
  } catch (e: any) {
    if (!e.message?.includes("404")) throw e;
    console.log(`   ⚠️  Playlist 404, recreating "${PLAYLIST_NAME}"...`);
    token = await getAccessToken();
    playlistId = await createPlaylist(PLAYLIST_NAME, token);
    await setPlaylistId(userId, "loved", "loved", playlistId);
    existing = new Set();
  }

  const toAdd = lovedBattiti.filter((id) => !existing.has(id));
  console.log(`   → ${toAdd.length} new tracks to add (${existing.size} already present)\n`);

  // 6. Add new tracks
  let added = 0;
  for (let i = 0; i < toAdd.length; i++) {
    if (i % 50 === 0) token = await getAccessToken();
    await sleep(ADD_DELAY_MS);
    const ok = await addTrackToPlaylist(playlistId, toAdd[i], token);
    if (ok) added++;
  }

  // 7. Persist checkpoint — only after successful adds
  if (latestDate) await saveCheckpoint(latestDate);

  console.log(`✅ Done. Added ${added}/${toAdd.length} tracks to "${PLAYLIST_NAME}".`);
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  loved().catch((e) => console.error(`❌ Error: ${e.message}`));
}
