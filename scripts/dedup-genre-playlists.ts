import "dotenv/config";
import fsPromises from "fs/promises";
import { getAccessToken } from "../lib/tidalAuth.js";
import { createPlaylist, addTrackToPlaylist, getPlaylistTrackIds, deletePlaylist } from "../lib/tidalClient.js";
import { GENRE_PLAYLISTS_FILE, PLAYLIST_PREFIX } from "../lib/config.js";

const ADD_DELAY_MS = 600;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
      allIds = [...await getPlaylistTrackIds(oldId, token)];
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
    await deletePlaylist(oldId, token).catch((e: any) => {
      if (!e.message?.includes("404")) console.log(`  ⚠️  Could not delete ${oldId} (${e.message})`);
    });

    genrePlaylists[genre] = newId;
    await fsPromises.writeFile(GENRE_PLAYLISTS_FILE, JSON.stringify(genrePlaylists, null, 2));

    console.log(`  ✅ ${added}/${unique.length} added (${failed} failed), old playlist deleted`);
    processed++;
  }

  console.log(`\n✅ Done. ${processed}/${genres.length} playlists processed, ${totalDups} total duplicates removed.`);
};

main().catch((e) => console.error(`❌ Error during dedup-genre-playlists: ${e.message}`));
