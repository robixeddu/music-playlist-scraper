import fsPromises from "fs/promises";
import { getAccessToken } from "./lib/tidalAuth.js";
import { searchTracks, addTrackToPlaylist, getPlaylistTrackIds, TidalTrack } from "./lib/tidalClient.js";
import { computeMatchScore, CONFIDENT_THRESHOLD, UNCERTAIN_THRESHOLD } from "./lib/similarity.js";
import { logError, logCompletion } from "./lib/logger.js";
import { EXPORT_FILE } from "./lib/config.js";

const PLAYLIST_ID = process.env.TIDAL_PLAYLIST_ID!;
const SYNC_REPORT_FILE = "./data/tidal_sync_report.json";
const MISSING_CSV_FILE = "./missing_tracks/My FromFile Playlist Missing_251112.csv";
const SEARCH_DELAY_MS = 500;
const PLAYLIST_DELAY_MS = 1000;

interface SyncResult {
  added: { track: string; tidalId: string; score: number }[];
  uncertain: { track: string; bestMatch: TidalTrack; artistScore: number; titleScore: number }[];
  notFound: string[];
}

const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

const loadNewTracks = async (): Promise<{ artist: string; title: string }[]> => {
  try {
    const content = await fsPromises.readFile(EXPORT_FILE, "utf-8");
    return content
      .split("\n")
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => {
        const dashIdx = line.indexOf(" - ");
        if (dashIdx === -1) return null;
        return {
          artist: line.substring(0, dashIdx).trim(),
          title: line.substring(dashIdx + 3).trim(),
        };
      })
      .filter((t): t is { artist: string; title: string } => t !== null);
  } catch (e: any) {
    if (e.code === "ENOENT") {
      logError("tidal-sync", "No export file found. Run npm start first.");
    } else {
      logError("reading export file", e.message);
    }
    return [];
  }
};

async function main(): Promise<void> {
  if (!process.env.TIDAL_CLIENT_ID) {
    logError("tidal-sync", "TIDAL_CLIENT_ID not set in .env");
    process.exit(1);
  }
  if (!PLAYLIST_ID) {
    logError("tidal-sync", "TIDAL_PLAYLIST_ID not set in .env");
    process.exit(1);
  }

  const tracks = await loadNewTracks();
  if (tracks.length === 0) {
    logCompletion("No tracks to sync.");
    return;
  }

  console.log(`🎵 Syncing ${tracks.length} tracks to TIDAL...\n`);

  const token = await getAccessToken();
  const existingIds = await getPlaylistTrackIds(PLAYLIST_ID, token);
  console.log(`📋 Playlist already has ${existingIds.size} tracks.\n`);

  const results: SyncResult = { added: [], uncertain: [], notFound: [] };

  for (const track of tracks) {
    const query = `${track.artist} ${track.title}`;
    await sleep(SEARCH_DELAY_MS);
    const candidates = await searchTracks(query, track.artist, token);

    const scored = (list: typeof candidates) =>
      list.map(candidate => ({ candidate, ...computeMatchScore(track.artist, track.title, candidate.artistName, candidate.title) }));

    const primaryScored = scored(candidates);
    const primaryBest = primaryScored.length > 0
      ? primaryScored.reduce((a, b) => a.score > b.score ? a : b)
      : null;

    let best = primaryBest;

    if (!primaryBest || primaryBest.score < CONFIDENT_THRESHOLD) {
      await sleep(SEARCH_DELAY_MS);
      const fallbackTitle = await searchTracks(track.title, track.artist, token);
      await sleep(SEARCH_DELAY_MS);
      const fallbackArtist = await searchTracks(track.artist, track.artist, token);
      await sleep(SEARCH_DELAY_MS);
      const fallbackDot = await searchTracks(`${track.artist} ${track.title}.`, track.artist, token);
      const merged = [...new Map(
        [...candidates, ...fallbackTitle, ...fallbackArtist, ...fallbackDot].map(c => [c.id, c])
      ).values()];
      if (merged.length > 0) {
        best = scored(merged).reduce((a, b) => a.score > b.score ? a : b);
      }
    }

    if (!best) {
      results.notFound.push(query);
      console.log(`❌ Not found: ${query}`);
      continue;
    }

    if (best.score >= CONFIDENT_THRESHOLD) {
      if (existingIds.has(best.candidate.id)) {
        console.log(`⏭️  Duplicate: ${query}\n`);
        continue;
      }
      await sleep(PLAYLIST_DELAY_MS);
      const added = await addTrackToPlaylist(PLAYLIST_ID, best.candidate.id, token);
      if (added) {
        existingIds.add(best.candidate.id);
        results.added.push({ track: query, tidalId: best.candidate.id, score: best.score });
        console.log(`✅ Added:     ${query}`);
        console.log(`   → matched: ${best.candidate.artistName} - ${best.candidate.title} (score: ${best.score.toFixed(2)})\n`);
      }
    } else if (best.score >= UNCERTAIN_THRESHOLD) {
      results.uncertain.push({
        track: query,
        bestMatch: best.candidate,
        artistScore: best.artistScore,
        titleScore: best.titleScore,
      });
      console.log(`⚠️  Uncertain: ${query}`);
      console.log(`   → best:     ${best.candidate.artistName} - ${best.candidate.title} (artist: ${best.artistScore.toFixed(2)}, title: ${best.titleScore.toFixed(2)})\n`);
    } else {
      results.notFound.push(query);
      console.log(`❌ No match:  ${query}\n`);
    }
  }

  await fsPromises.writeFile(SYNC_REPORT_FILE, JSON.stringify(results, null, 2));

  const missingTracks = [
    ...results.notFound,
    ...results.uncertain.map(u => u.track),
  ];
  if (missingTracks.length > 0) {
    const existingCsv = await fsPromises.readFile(MISSING_CSV_FILE, "utf-8").catch(() => "");
    const existingCsvEntries = new Set(
      existingCsv.split("\n").slice(1).filter(Boolean).map(l => l.split(",")[0].toLowerCase())
    );
    const newEntries = missingTracks.filter(t => !existingCsvEntries.has(t.toLowerCase()));
    if (newEntries.length > 0) {
      const csvRows = newEntries.map(t => `${t},,,My Playlist,playlist`).join("\n") + "\n";
      await fsPromises.appendFile(MISSING_CSV_FILE, csvRows);
      console.log(`📄 ${newEntries.length} missing tracks appended to ${MISSING_CSV_FILE}`);
    } else {
      console.log(`📄 No new missing tracks to append (all already in CSV).`);
    }
  }

  console.log(`---`);
  console.log(`✅ Added:    ${results.added.length}`);
  console.log(`⚠️  Uncertain: ${results.uncertain.length} (see ${SYNC_REPORT_FILE})`);
  console.log(`❌ Not found: ${results.notFound.length}`);
}

main().catch(err => logError("tidal-sync", err.message));
