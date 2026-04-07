import "dotenv/config";
import fsPromises from "fs/promises";
import { getUserId } from "../lib/tidalAuth.js";
import {
  setPlaylistId, setImportedIds, deletePlaylistKeys,
  getSeededGenreSlugs, setSeededGenreSlugs,
} from "../lib/redisClient.js";
import { GLOBAL_PLAYLIST_FILE, GENRE_PLAYLISTS_FILE, TRACKS_FILE, PROGRAM_ID } from "../lib/config.js";

const slugify = (s: string) => s.toLowerCase().replace(/\s+/g, "-");

interface Track { tidalId?: string; genres?: string[]; }
interface Episode { tracks: Track[]; }

const seed = async () => {
  const argUserId = process.argv[2];
  const userId = argUserId ?? await getUserId();
  console.log(`\n👤 userId: ${userId}\n`);
  if (userId === "unknown") {
    console.error("❌ Could not resolve userId. Pass it explicitly: npm run seed-redis -- <userId>");
    process.exit(1);
  }

  // Load tracks
  let episodes: Episode[] = [];
  try {
    episodes = JSON.parse(await fsPromises.readFile(TRACKS_FILE, "utf-8"));
  } catch {
    console.log("⚠️  tracks.json not found, skipping importedIds seeding");
  }
  const allTracks = episodes.flatMap((e) => e.tracks);

  // Global
  try {
    const { id } = JSON.parse(await fsPromises.readFile(GLOBAL_PLAYLIST_FILE, "utf-8"));
    await setPlaylistId(userId, "global", PROGRAM_ID, id);
    const globalIds = allTracks.flatMap((t) => t.tidalId ? [t.tidalId] : []);
    await setImportedIds(userId, "global", PROGRAM_ID, globalIds);
    console.log(`✅ global → ${id} (${globalIds.length} imported IDs)`);
  } catch {
    console.log("⚠️  global_playlist.json not found, skipping");
  }

  // Genre
  let currentGenres: Record<string, string> = {};
  try {
    currentGenres = JSON.parse(await fsPromises.readFile(GENRE_PLAYLISTS_FILE, "utf-8"));
  } catch {
    console.log("⚠️  genre_playlists.json not found, skipping");
  }

  const currentSlugs = new Set(Object.keys(currentGenres).map(slugify));

  // Remove genres no longer in genre_playlists.json
  const previousSlugs = await getSeededGenreSlugs(userId);
  for (const slug of previousSlugs) {
    if (!currentSlugs.has(slug)) {
      await deletePlaylistKeys(userId, "genre", slug);
      console.log(`🗑️  removed stale genre: ${slug}`);
    }
  }

  // Build genre → tidalIds map
  const genreIds: Record<string, string[]> = {};
  for (const track of allTracks) {
    if (!track.tidalId || !track.genres) continue;
    for (const genre of track.genres) {
      const slug = slugify(genre);
      (genreIds[slug] ??= []).push(track.tidalId);
    }
  }

  for (const [genre, id] of Object.entries(currentGenres)) {
    const slug = slugify(genre);
    await setPlaylistId(userId, "genre", slug, id);
    const ids = genreIds[slug] ?? [];
    await setImportedIds(userId, "genre", slug, ids);
    console.log(`✅ genre:${slug} → ${id} (${ids.length} imported IDs)`);
  }

  // Update index
  await setSeededGenreSlugs(userId, [...currentSlugs]);
  console.log("\n✅ Redis seeded.");
};

seed().catch(console.error);
