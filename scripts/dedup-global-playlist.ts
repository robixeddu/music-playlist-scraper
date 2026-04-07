import "dotenv/config";
import fsPromises from "fs/promises";
import { getAccessToken } from "../lib/tidalAuth.js";
import { createPlaylist, addTrackToPlaylist, getPlaylistTrackIds, deletePlaylist } from "../lib/tidalClient.js";
import { GLOBAL_PLAYLIST_FILE, PLAYLIST_PREFIX } from "../lib/config.js";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const SAVE_EVERY = 100;

const dedupGlobalPlaylist = async () => {
  const { id: oldId } = JSON.parse(await fsPromises.readFile(GLOBAL_PLAYLIST_FILE, "utf-8"));

  console.log(`🔍 Fetching all tracks from ${PLAYLIST_PREFIX} (${oldId})...`);
  const token = await getAccessToken();
  const allIds = [...await getPlaylistTrackIds(oldId, token)];
  console.log(`   Total items fetched: ${allIds.length}`);

  const unique = [...new Set(allIds)];
  const dupCount = allIds.length - unique.length;

  if (dupCount === 0) {
    console.log("✅ No duplicates found.");
    return;
  }

  console.log(`⚠️  ${dupCount} duplicates found. Unique tracks: ${unique.length}`);
  console.log(`📋 Creating new ${PLAYLIST_PREFIX} playlist...`);

  const newId = await createPlaylist(PLAYLIST_PREFIX, token);
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
  currentToken = await getAccessToken();
  try {
    await deletePlaylist(oldId, currentToken);
    console.log(`🗑️  Old playlist ${oldId} deleted.`);
  } catch (e: any) {
    if (e.message?.includes("404")) {
      console.log(`🗑️  Old playlist ${oldId} deleted.`);
    } else {
      console.log(`⚠️  Could not delete old playlist ${oldId} (${e.message}) — cancellala manualmente.`);
    }
  }
};

dedupGlobalPlaylist().catch((e) => console.error(`❌ Error during dedup-playlist: ${e.message}`));
