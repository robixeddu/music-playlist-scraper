import "dotenv/config";
import fsPromises from "fs/promises";
import { TRACKS_FILE } from "../lib/config.js";
import { getArtistGenres, type GenreResult } from "../lib/claudeGenres.js";
import { filterGenres } from "../lib/genres.js";
import { EpisodeAggregated, BaseTrack } from "../lib/types.js";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const RESET = process.argv.includes("--reset");

const toTitleCase = (s: string) =>
  s.replace(/\b\w+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());

const trackKey = (artist: string, title: string) =>
  `${artist.toLowerCase()}|${title.toLowerCase()}`;

const genreEnrich = async () => {
  const raw = await fsPromises.readFile(TRACKS_FILE, "utf-8");
  const episodes: EpisodeAggregated[] = JSON.parse(raw);

  if (RESET) {
    for (const ep of episodes)
      for (const track of ep.tracks as BaseTrack[]) {
        track.genresRaw = [];
      }
    console.log("🗑️  All genres cleared.\n");
  }

  // Collect unique tracks that need tagging (artist+title as key)
  const toTag: { artist: string; title: string }[] = [];
  const seen = new Set<string>();

  for (const ep of episodes) {
    for (const track of ep.tracks as BaseTrack[]) {
      if (track.genresRaw && track.genresRaw.length > 0) continue; // already tagged
      const key = trackKey(track.artist, track.title);
      if (seen.has(key)) continue;
      seen.add(key);
      toTag.push({ artist: track.artist, title: track.title });
    }
  }

  if (toTag.length === 0) {
    console.log("✅ All tracks already tagged.");
    await fsPromises.writeFile(TRACKS_FILE, JSON.stringify(episodes, null, 2));
    return;
  }

  console.log(`\n🤖 tagging ${toTag.length} tracks (Haiku → Brave fallback)...\n`);

  const cache = new Map<string, GenreResult>();
  let found = 0;

  for (let i = 0; i < toTag.length; i++) {
    const { artist, title } = toTag[i];
    const key = trackKey(artist, title);
    const displayName = toTitleCase(artist);
    process.stdout.write(`[${i + 1}/${toTag.length}] ${displayName} — ${title} → `);

    try {
      const result = await getArtistGenres(displayName, title);
      cache.set(key, result);
      if (result.normalized.length > 0) {
        const src = result.source === "brave" ? " [brave]" : "";
        console.log(`${result.normalized.join(", ")}${src}`);
        found++;
      } else {
        console.log("(no tags)");
      }
    } catch (e: any) {
      console.log(`ERROR: ${e.message}`);
      cache.set(key, { raw: [], normalized: [], source: "none" });
    }

    if (i < toTag.length - 1) await sleep(250);
  }

  // Apply results to tracks
  for (const ep of episodes) {
    for (const track of ep.tracks as BaseTrack[]) {
      const key = trackKey(track.artist, track.title);
      const result = cache.get(key);
      if (result) {
        track.genresRaw = result.raw;
      }
    }
  }

  await fsPromises.writeFile(TRACKS_FILE, JSON.stringify(episodes, null, 2));
  console.log(`\n✅ Tagged ${found}/${toTag.length} tracks → saved.`);
};

genreEnrich().catch(console.error);
