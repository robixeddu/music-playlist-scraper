import "dotenv/config";
import fsPromises from "fs/promises";
import {
  loadPreviousTracks,
  saveTracks,
  ensureDataDirectory,
} from "../lib/fileHandler.js";
import { getEpisodeLinks, getTracksFromEpisode } from "../lib/scraper.js";
import {
  aggregateTracksByEpisode,
  updateAllTracks,
  getKnownEpisodeUrls,
} from "../lib/aggregation.js";
import { BATTITI_URL, SKIPPED_COUNT_LIMIT, MISSING_TRACKS_FILE, PROGRAM_ID } from "../lib/config.js";
import { getArtistGenres } from "../lib/claudeGenres.js";
import { getAccessToken } from "../lib/tidalAuth.js";
import {
  findTidalMatch,
  createPlaylist,
  addTrackToPlaylist,
} from "../lib/tidalClient.js";
import { loved } from "./loved.js";
import { Track } from "../lib/types.js";

const GENRE_DELAY_MS = 250;
const ADD_DELAY_MS = 600;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const today = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
})();

const fullSync = async () => {
  await ensureDataDirectory();

  // ─── Step 1: Scrape ────────────────────────────────────────────────────────
  console.log("\n🎧 Step 1: Scraping Battiti...\n");

  const previousTracks = await loadPreviousTracks();
  const episodeLinks = await getEpisodeLinks(BATTITI_URL);

  let allTracks: Track[] = [...previousTracks];
  const newTracks: Track[] = [];
  const knownEpisodeUrls = getKnownEpisodeUrls(previousTracks);
  let skippedCount = 0;
  let isNewEpisodeFound = false;

  for (const link of episodeLinks) {
    if (knownEpisodeUrls.has(link)) {
      skippedCount++;
      if (isNewEpisodeFound || skippedCount > SKIPPED_COUNT_LIMIT) break;
      continue;
    }
    isNewEpisodeFound = true;
    try {
      const episodeTracks = await getTracksFromEpisode(link);
      allTracks = updateAllTracks(allTracks, episodeTracks, newTracks);
    } catch (e: any) {
      console.error(`❌ Error during scraping ${link}: ${e.message}`);
    }
  }

  if (newTracks.length === 0) {
    console.log("✅ No new tracks found.\n");
  } else {
  console.log(`\n🆕 ${newTracks.length} new tracks found.\n`);

  // ─── Step 2: TIDAL auth + daily staging playlist ─────────────────────────
  let token = await getAccessToken();

  const todayId = await createPlaylist(`${PROGRAM_ID}-${today}`, token);
  console.log(`📋 Created staging playlist "${PROGRAM_ID}-${today}" (${todayId})\n`);

  // ─── Step 3: Tag + match + stage ──────────────────────────────────────────
  console.log("\n🎵 Step 2: Genre tagging + TIDAL match...\n");

  const todayExisting = new Set<string>();
  let todayAdded = 0;
  let notFound = 0;
  const newMissing: string[] = [];

  for (let trackIdx = 0; trackIdx < newTracks.length; trackIdx++) {
    if (trackIdx % 50 === 0) token = await getAccessToken();
    const track = newTracks[trackIdx];
    console.log(`→ ${track.artist} – ${track.title}`);

    // Genre (per track — no cache, title matters)
    try {
      const genreResult = await getArtistGenres(track.artist, track.title);
      track.genresRaw = genreResult.raw;
      if (genreResult.raw.length) {
        const src = genreResult.source === "brave" ? " [brave]" : "";
        console.log(`  🏷️  ${genreResult.normalized.join(", ")}${src}`);
      }
    } catch (e: any) {
      track.genresRaw = [];
      console.error(`❌ Error during genre tagging for "${track.artist}": ${e.message}`);
    }
    await sleep(GENRE_DELAY_MS);

    // TIDAL match
    const match = await findTidalMatch(track.artist, track.title, token);
    if (!match) {
      console.log(`  ❌ Not found on TIDAL\n`);
      notFound++;
      newMissing.push(`${track.artist} - ${track.title}`);
      continue;
    }

    track.tidalId = match.id;
    console.log(`  ✅ ${match.id} (score: ${match.score.toFixed(2)})`);

    // Staging playlist (dedup)
    if (!todayExisting.has(match.id)) {
      await sleep(ADD_DELAY_MS);
      await addTrackToPlaylist(todayId, match.id, token);
      todayExisting.add(match.id);
      todayAdded++;
    }

    console.log();
  }

  // ─── Step 4: Save tracks.json + missing tracks ────────────────────────────
  const newEpisodeCount = new Set(newTracks.map(t => t.episodeUrl)).size;
  await saveTracks(aggregateTracksByEpisode(allTracks), newEpisodeCount);
  if (newMissing.length > 0) {
    await fsPromises.appendFile(MISSING_TRACKS_FILE, newMissing.join("\n") + "\n");
    console.log(`📄 ${newMissing.length} missing tracks appended to ${MISSING_TRACKS_FILE}`);
  }

  // ─── Summary ───────────────────────────────────────────────────────────────
  console.log("─".repeat(50));
  console.log(`📅 ${PROGRAM_ID}-${today}: ${todayAdded} tracks staged`);
  console.log(`❌ Not found on TIDAL:   ${notFound}`);
  console.log(`\n👉 Review ${PROGRAM_ID}-${today} on TIDAL, edit tracks.json if needed, then run: npm run propagate`);
  } // end if (newTracks.length > 0)

  // ─── Step 5: Loved playlist (always, checkpoint-based) ───────────────────
  console.log("\n❤️  Step 5: Syncing loved playlist...\n");
  try {
    await loved();
  } catch (e: any) {
    console.error(`❌ Loved sync error: ${e.message}`);
  }
};

fullSync().catch((e) => console.error(`❌ Error during battiti-full-sync: ${e.message}`));
