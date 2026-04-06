import "dotenv/config";
import fsPromises from "fs/promises";
import { getAccessToken } from "./lib/tidalAuth.js";
import { findTidalMatch } from "./lib/tidalClient.js";
import { TRACKS_FILE, MISSING_TRACKS_FILE } from "./lib/config.js";
import { EpisodeAggregated, BaseTrack } from "./lib/types.js";

const SAVE_EVERY = 50; // persist progress every N tracks

const catalogEnrich = async () => {
  const raw = await fsPromises.readFile(TRACKS_FILE, "utf-8");
  const episodes: EpisodeAggregated[] = JSON.parse(raw);

  // Collect unique tracks that need a tidalId and have genres
  const queue: { track: BaseTrack; ep: number; idx: number }[] = [];
  for (let i = 0; i < episodes.length; i++) {
    for (let j = 0; j < episodes[i].tracks.length; j++) {
      const t = episodes[i].tracks[j];
      if (!t.tidalId && t.genres?.length) {
        queue.push({ track: t, ep: i, idx: j });
      }
    }
  }
  if (process.argv.includes("--reverse")) queue.reverse();

  if (queue.length === 0) {
    console.log("✅ All genre-tagged tracks already have a TIDAL ID.");
    return;
  }

  console.log(`\n🎵 Searching TIDAL for ${queue.length} tracks without ID...\n`);
  let token = await getAccessToken();

  let found = 0;
  let notFound = 0;
  let currentIndex = 0;

  const saveProgress = async () => {
    await fsPromises.writeFile(TRACKS_FILE, JSON.stringify(episodes, null, 2));
    const missingSet = new Set<string>();
    for (const ep of episodes) {
      for (const t of ep.tracks) {
        if (!t.tidalId && t.genres?.length) missingSet.add(`${t.artist} - ${t.title}`);
      }
    }
    await fsPromises.writeFile(MISSING_TRACKS_FILE, [...missingSet].join("\n") + "\n");
  };

  process.on("SIGINT", async () => {
    console.log(`\n\n⚠️  Interrupted at ${currentIndex}/${queue.length} — saving...`);
    await saveProgress();
    console.log(`💾 Saved. Relaunch to resume (queue rebuilds automatically from tracks.json).`);
    process.exit(0);
  });

  for (let i = 0; i < queue.length; i++) {
    currentIndex = i;
    if (i % 50 === 0) token = await getAccessToken();
    const { track, ep, idx } = queue[i];
    process.stdout.write(`[${i + 1}/${queue.length}] ${track.artist} – ${track.title} → `);

    try {
      const albumMatch = track.albumDetails?.match(/["""]([^"""]+)["""]/);
      const album = albumMatch?.[1];
      const match = await findTidalMatch(track.artist, track.title, token, album);
      if (match) {
        episodes[ep].tracks[idx].tidalId = match.id;
        console.log(`✅ ${match.id} (score: ${match.score.toFixed(2)})`);
        found++;
      } else {
        console.log("❌ not found");
        notFound++;
      }
    } catch (e: any) {
      console.error(`❌ Error during searching "${track.artist} ${track.title}": ${e.message}`);
      notFound++;
    }

    if ((i + 1) % SAVE_EVERY === 0) {
      await saveProgress();
      console.log(`  💾 Progress saved (${i + 1}/${queue.length})\n`);
    }
  }

  await saveProgress();
  console.log(`\n✅ Done. Found: ${found}, Not found: ${notFound}`);
  console.log(`💾 Saved to ${TRACKS_FILE}`);
};

catalogEnrich().catch((e) => console.error(`❌ Error during tidal-catalog-enrich: ${e.message}`));
