import "dotenv/config";
import fsPromises from "fs/promises";
import { getAccessToken } from "./lib/tidalAuth.js";
import { createPlaylist, getPlaylistTrackIds, addTrackToPlaylist } from "./lib/tidalClient.js";
import { TRACKS_FILE } from "./lib/config.js";
import { EpisodeAggregated } from "./lib/types.js";
import { logError } from "./lib/logger.js";
import { normalizeGenre } from "./lib/genres.js";

const GENRE_PLAYLISTS_FILE = "./data/genre_playlists.json";
const GLOBAL_PLAYLIST_FILE = "./data/global_playlist.json";
const MIN_TRACKS = 10;
const ADD_DELAY_MS = 600;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const loadGenrePlaylists = async (): Promise<Record<string, string>> => {
  try {
    return JSON.parse(await fsPromises.readFile(GENRE_PLAYLISTS_FILE, "utf-8"));
  } catch {
    return {};
  }
};

const getOrCreateGlobalPlaylist = async (token: string): Promise<string> => {
  try {
    const data = JSON.parse(await fsPromises.readFile(GLOBAL_PLAYLIST_FILE, "utf-8"));
    return data.id;
  } catch {
    const id = await createPlaylist("BATTITI", token);
    await fsPromises.writeFile(GLOBAL_PLAYLIST_FILE, JSON.stringify({ id }, null, 2));
    console.log(`📋 Created global playlist "BATTITI" (${id})\n`);
    return id;
  }
};

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

  console.log(`\n🌍 Global BATTITI: ${allTidalIds.size} tracks`);
  console.log(`🎵 Genre playlists: ${eligibleGenres.length} genres\n`);

  let token = await getAccessToken();

  // ── Global playlist ──────────────────────────────────────────────────────
  const globalId = await getOrCreateGlobalPlaylist(token);
  const globalExisting = await getPlaylistTrackIds(globalId, token);
  const globalToAdd = [...allTidalIds].filter((id) => !globalExisting.has(id));
  console.log(`📋 BATTITI (global): ${globalToAdd.length} new tracks to add (${globalExisting.size} already present)`);
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

  const genrePlaylists = await loadGenrePlaylists();

  for (const [genre, trackIds] of eligibleGenres) {
    const playlistName = `BATTITI-${genre}`;

    // Create playlist if it doesn't exist yet
    if (!genrePlaylists[genre]) {
      genrePlaylists[genre] = await createPlaylist(playlistName, token);
      await fsPromises.writeFile(GENRE_PLAYLISTS_FILE, JSON.stringify(genrePlaylists, null, 2));
      console.log(`📋 Created playlist "${playlistName}" (${genrePlaylists[genre]})`);
    } else {
      console.log(`📋 Reusing playlist "${playlistName}" (${genrePlaylists[genre]})`);
    }

    token = await getAccessToken();
    let playlistId = genrePlaylists[genre];
    let existing: Set<string>;
    try {
      existing = await getPlaylistTrackIds(playlistId, token);
    } catch (e: any) {
      if (!e.message?.includes("404")) throw e;
      // Playlist was deleted on TIDAL — recreate it
      console.log(`   ⚠️  Playlist 404, recreating "${playlistName}"...`);
      playlistId = await createPlaylist(playlistName, token);
      genrePlaylists[genre] = playlistId;
      await fsPromises.writeFile(GENRE_PLAYLISTS_FILE, JSON.stringify(genrePlaylists, null, 2));
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
