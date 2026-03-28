import "dotenv/config";
import fsPromises from "fs/promises";
import {
  loadPreviousTracks,
  saveTracks,
  ensureDataDirectory,
} from "./lib/fileHandler.js";
import { getEpisodeLinks, getTracksFromEpisode } from "./lib/scraper.js";
import {
  aggregateTracksByEpisode,
  updateAllTracks,
  getKnownEpisodeUrls,
} from "./lib/aggregation.js";
import { BATTITI_URL, SKIPPED_COUNT_LIMIT, MISSING_TRACKS_FILE } from "./lib/config.js";
import { getArtistGenres } from "./lib/claudeGenres.js";
import { normalizeGenre } from "./lib/genres.js";
import { getAccessToken } from "./lib/tidalAuth.js";
import {
  findTidalMatch,
  createPlaylist,
  getPlaylistTrackIds,
  addTrackToPlaylist,
} from "./lib/tidalClient.js";
import { logError } from "./lib/logger.js";
import { Track } from "./lib/types.js";

const GLOBAL_PLAYLIST_FILE = "./data/global_playlist.json";
const GENRE_PLAYLISTS_FILE = "./data/genre_playlists.json";
const GENRE_DELAY_MS = 250;
const ADD_DELAY_MS = 600;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const today = (() => {
  const d = new Date();
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
})();

const getOrCreateGlobalPlaylist = async (token: string): Promise<string> => {
  try {
    const data = JSON.parse(
      await fsPromises.readFile(GLOBAL_PLAYLIST_FILE, "utf-8")
    );
    console.log(`📋 Global playlist "BATTITI" (${data.id})`);
    return data.id;
  } catch {
    const id = await createPlaylist("BATTITI", token);
    await fsPromises.writeFile(
      GLOBAL_PLAYLIST_FILE,
      JSON.stringify({ id }, null, 2)
    );
    console.log(`📋 Created global playlist "BATTITI" (${id})`);
    return id;
  }
};

const loadGenrePlaylists = async (): Promise<Record<string, string>> => {
  try {
    return JSON.parse(await fsPromises.readFile(GENRE_PLAYLISTS_FILE, "utf-8"));
  } catch {
    return {};
  }
};

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
      logError(`scraping ${link}`, e.message);
    }
  }

  if (newTracks.length === 0) {
    console.log("✅ No new tracks found.");
    return;
  }

  console.log(`\n🆕 ${newTracks.length} new tracks found.\n`);

  // ─── Step 2: TIDAL auth + playlist setup ───────────────────────────────────
  let token = await getAccessToken();

  const todayId = await createPlaylist(`battiti-${today}`, token);
  console.log(`📋 Created today's playlist "battiti-${today}" (${todayId})\n`);

  const globalId = await getOrCreateGlobalPlaylist(token);
  const globalExisting = await getPlaylistTrackIds(globalId, token);

  const genrePlaylists = await loadGenrePlaylists();
  const genreExisting = new Map<string, Set<string>>();

  // ─── Step 3: Tag + match + distribute ─────────────────────────────────────
  console.log("\n🎵 Step 2: Genre tagging + TIDAL sync...\n");

  const artistGenreCache = new Map<string, string[]>();
  const todayExisting = new Set<string>();
  let todayAdded = 0;
  let globalAdded = 0;
  const genreAdded: Record<string, number> = {};
  let notFound = 0;
  const newMissing: string[] = [];

  for (let trackIdx = 0; trackIdx < newTracks.length; trackIdx++) {
    token = await getAccessToken();
    const track = newTracks[trackIdx];
    console.log(`→ ${track.artist} – ${track.title}`);

    // Genre (cached per artist)
    const artistKey = track.artist.toLowerCase();
    if (!artistGenreCache.has(artistKey)) {
      const genres = await getArtistGenres(track.artist, track.title);
      artistGenreCache.set(artistKey, genres);
      await sleep(GENRE_DELAY_MS);
    }
    const genres = artistGenreCache.get(artistKey)!;
    if (genres.length) {
      track.genres = genres;
      console.log(`  🏷️  ${genres.join(", ")}`);
    }

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

    // Today's playlist (dedup)
    if (!todayExisting.has(match.id)) {
      await sleep(ADD_DELAY_MS);
      await addTrackToPlaylist(todayId, match.id, token);
      todayExisting.add(match.id);
      todayAdded++;
    }

    // Global playlist (dedup)
    if (!globalExisting.has(match.id)) {
      await sleep(ADD_DELAY_MS);
      await addTrackToPlaylist(globalId, match.id, token);
      globalExisting.add(match.id);
      globalAdded++;
    }

    // Genre playlists (dedup)
    for (const rawGenre of genres) {
      const genre = normalizeGenre(rawGenre);
      if (!genre) continue;

      // Create playlist if new genre
      if (!genrePlaylists[genre]) {
        genrePlaylists[genre] = await createPlaylist(`BATTITI-${genre}`, token);
        await fsPromises.writeFile(
          GENRE_PLAYLISTS_FILE,
          JSON.stringify(genrePlaylists, null, 2)
        );
        genreExisting.set(genre, new Set());
        console.log(`  📋 Created new genre playlist "BATTITI-${genre}"`);
      }

      // Load existing IDs if not cached yet (with 404 auto-recreate)
      if (!genreExisting.has(genre)) {
        try {
          genreExisting.set(genre, await getPlaylistTrackIds(genrePlaylists[genre], token));
        } catch (e: any) {
          if (!e.message?.includes("404")) throw e;
          console.log(`  ⚠️  BATTITI-${genre} 404, recreating...`);
          genrePlaylists[genre] = await createPlaylist(`BATTITI-${genre}`, token);
          await fsPromises.writeFile(GENRE_PLAYLISTS_FILE, JSON.stringify(genrePlaylists, null, 2));
          genreExisting.set(genre, new Set());
        }
      }

      const existing = genreExisting.get(genre)!;
      if (!existing.has(match.id)) {
        await sleep(ADD_DELAY_MS);
        await addTrackToPlaylist(genrePlaylists[genre], match.id, token);
        existing.add(match.id);
        genreAdded[genre] = (genreAdded[genre] ?? 0) + 1;
      }
    }

    console.log();
  }

  // ─── Step 4: Save tracks.json + missing tracks ────────────────────────────
  await saveTracks(aggregateTracksByEpisode(allTracks));
  if (newMissing.length > 0) {
    await fsPromises.appendFile(MISSING_TRACKS_FILE, newMissing.join("\n") + "\n");
    console.log(`📄 ${newMissing.length} missing tracks appended to ${MISSING_TRACKS_FILE}`);
  }

  // ─── Summary ───────────────────────────────────────────────────────────────
  console.log("─".repeat(50));
  console.log(`📅 battiti-${today}:     ${todayAdded} tracks added`);
  console.log(`🌍 BATTITI (global):    +${globalAdded} new tracks`);
  for (const [genre, count] of Object.entries(genreAdded).sort((a, b) => b[1] - a[1])) {
    console.log(`🎵 BATTITI-${genre}: +${count}`);
  }
  console.log(`❌ Not found on TIDAL:  ${notFound}`);
};

fullSync().catch((e) => logError("battiti-full-sync", e.message));
