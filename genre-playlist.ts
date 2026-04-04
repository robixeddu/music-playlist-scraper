import "dotenv/config";
import fsPromises from "fs/promises";
import { getAccessToken, getUserId } from "./lib/tidalAuth.js";
import { createPlaylist, getPlaylistTrackIds, addTrackToPlaylist, deletePlaylist } from "./lib/tidalClient.js";
import { TRACKS_FILE, PLAYLIST_PREFIX, PROGRAM_ID } from "./lib/config.js";
import { EpisodeAggregated } from "./lib/types.js";
import { logError } from "./lib/logger.js";
import { normalizeGenre } from "./lib/genres.js";
import { getPlaylistId, setPlaylistId } from "./lib/redisClient.js";

const MIN_TRACKS = 10;
const ADD_DELAY_MS = 600;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const getOrCreateGlobalPlaylist = async (token: string, userId: string): Promise<string> => {
  const existing = await getPlaylistId(userId, "global", PROGRAM_ID);
  if (existing) return existing;
  const id = await createPlaylist(PLAYLIST_PREFIX, token);
  await setPlaylistId(userId, "global", PROGRAM_ID, id);
  console.log(`📋 Created global playlist "${PLAYLIST_PREFIX}" (${id})\n`);
  return id;
};

const REBUILD = process.argv.includes("--rebuild");

const genrePlaylist = async () => {
  const raw = await fsPromises.readFile(TRACKS_FILE, "utf-8");
  const episodes: EpisodeAggregated[] = JSON.parse(raw);

  // Collect all tidalIds and group by genre
  const allTidalIds = new Set<string>();
  const genreMap = new Map<string, Set<string>>();
  for (const ep of episodes) {
    for (const track of ep.tracks) {
      if (!track.tidalId) continue;
      allTidalIds.add(track.tidalId);
      if (!track.genres?.length) continue;
      for (const rawGenre of track.genres) {
        const genre = normalizeGenre(rawGenre);
        if (!genre) continue;
        if (!genreMap.has(genre)) genreMap.set(genre, new Set());
        genreMap.get(genre)!.add(track.tidalId);
      }
    }
  }

  // Filter genres below threshold
  const eligibleGenres = [...genreMap.entries()]
    .filter(([, ids]) => ids.size >= MIN_TRACKS)
    .sort((a, b) => b[1].size - a[1].size);

  console.log(`\n🌍 Global ${PLAYLIST_PREFIX}: ${allTidalIds.size} tracks`);
  console.log(`🎵 Genre playlists: ${eligibleGenres.length} genres\n`);

  let token = await getAccessToken();
  const userId = await getUserId();

  // ── Global playlist ──────────────────────────────────────────────────────
  const globalId = await getOrCreateGlobalPlaylist(token, userId);
  const globalExisting = await getPlaylistTrackIds(globalId, token);
  const globalToAdd = [...allTidalIds].filter((id) => !globalExisting.has(id));
  console.log(`📋 ${PLAYLIST_PREFIX} (global): ${globalToAdd.length} new tracks to add (${globalExisting.size} already present)`);
  let globalAdded = 0;
  for (let i = 0; i < globalToAdd.length; i++) {
    if (i % 50 === 0) token = await getAccessToken();
    await sleep(ADD_DELAY_MS);
    const ok = await addTrackToPlaylist(globalId, globalToAdd[i], token);
    if (ok) globalAdded++;
  }
  console.log(`   ✅ Added ${globalAdded}/${globalToAdd.length}\n`);

  if (eligibleGenres.length === 0) {
    console.log("⚠️  No genres with enough tracks.");
    return;
  }

  for (const [genre, trackIds] of eligibleGenres) {
    const playlistName = `${PLAYLIST_PREFIX}-${genre}`;
    const genreSlug = genre.toLowerCase().replace(/\s+/g, "-");

    token = await getAccessToken();
    let playlistId = await getPlaylistId(userId, "genre", genreSlug);

    if (REBUILD && playlistId) {
      try {
        await deletePlaylist(playlistId, token);
        console.log(`🗑️  Deleted playlist "${playlistName}" (${playlistId})`);
      } catch {
        console.log(`   ⚠️  Could not delete "${playlistName}", will recreate anyway`);
      }
      playlistId = null;
    }

    // Create playlist if it doesn't exist yet
    if (!playlistId) {
      playlistId = await createPlaylist(playlistName, token);
      await setPlaylistId(userId, "genre", genreSlug, playlistId);
      console.log(`📋 Created playlist "${playlistName}" (${playlistId})`);
    } else {
      console.log(`📋 Reusing playlist "${playlistName}" (${playlistId})`);
    }

    token = await getAccessToken();
    let existing: Set<string>;
    try {
      existing = await getPlaylistTrackIds(playlistId, token);
    } catch (e: any) {
      if (!e.message?.includes("404")) throw e;
      // Playlist was deleted on TIDAL — recreate it
      console.log(`   ⚠️  Playlist 404, recreating "${playlistName}"...`);
      playlistId = await createPlaylist(playlistName, token);
      await setPlaylistId(userId, "genre", genreSlug, playlistId);
      existing = new Set();
    }

    const toAdd = [...trackIds].filter((id) => !existing.has(id));
    console.log(`   → ${toAdd.length} new tracks to add (${existing.size} already present)`);

    let added = 0;
    for (let i = 0; i < toAdd.length; i++) {
      if (i % 50 === 0) token = await getAccessToken();
      await sleep(ADD_DELAY_MS);
      const ok = await addTrackToPlaylist(playlistId, toAdd[i], token);
      if (ok) added++;
    }

    console.log(`   ✅ Added ${added}/${toAdd.length}\n`);
  }

  console.log("✅ All genre playlists updated.");
};

genrePlaylist().catch((e) => logError("genre-playlist", e.message));
