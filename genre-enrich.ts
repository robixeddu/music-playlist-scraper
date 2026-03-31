import "dotenv/config";
import fsPromises from "fs/promises";
import { TRACKS_FILE } from "./lib/config.js";
import { getGenresHaiku, getGenresSonnetSearch, type GenreResult } from "./lib/claudeGenres.js";
import { EpisodeAggregated, BaseTrack } from "./lib/types.js";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const RESET = process.argv.includes("--reset");
const HAIKU_ONLY = process.argv.includes("--haiku-only");
const SONNET_PASS = process.argv.includes("--sonnet-pass"); // only run sonnet on empty
const HAIKU_RETRY = process.argv.includes("--haiku-retry"); // retry empty artists with title case

const toTitleCase = (s: string) =>
  s.replace(/\b\w+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());

const applyToTracks = (episodes: EpisodeAggregated[], cache: Map<string, GenreResult>) => {
  for (const ep of episodes) {
    for (const track of ep.tracks as BaseTrack[]) {
      const result = cache.get(track.artist.toLowerCase());
      if (result !== undefined) {
        track.genres = result.normalized;
        track.genresRaw = result.raw;
      }
    }
  }
};

const genreEnrich = async () => {
  const raw = await fsPromises.readFile(TRACKS_FILE, "utf-8");
  const episodes: EpisodeAggregated[] = JSON.parse(raw);

  if (RESET) {
    for (const ep of episodes)
      for (const track of ep.tracks as BaseTrack[])
        track.genres = [];
    console.log("🗑️  All genres cleared.\n");
  }

  // Collect unique artists (case-insensitive dedup)
  const artistMap = new Map<string, string>(); // key → original
  for (const ep of episodes) {
    for (const track of ep.tracks) {
      const key = track.artist.toLowerCase();
      if (!artistMap.has(key)) artistMap.set(key, track.artist);
    }
  }

  const allArtists = [...artistMap.values()];
  const genreCache = new Map<string, GenreResult>();

  // ── Pass 1: Haiku ─────────────────────────────────────────────────────────
  // Skip if --sonnet-pass or --haiku-retry: load existing genres from tracks.json as cache
  if (SONNET_PASS || HAIKU_RETRY) {
    for (const ep of episodes) {
      for (const track of ep.tracks as BaseTrack[]) {
        const key = track.artist.toLowerCase();
        if (!genreCache.has(key)) {
          genreCache.set(key, {
            normalized: track.genres ?? [],
            raw: track.genresRaw ?? [],
          });
        }
      }
    }
    console.log(`📂 Loaded existing genres for ${genreCache.size} artists.\n`);
  } else {
    console.log(`\n🤖 Pass 1 — Haiku (${allArtists.length} artists)...\n`);
    let haikuFound = 0;

    for (let i = 0; i < allArtists.length; i++) {
      const artist = allArtists[i];
      const key = artist.toLowerCase();
      process.stdout.write(`[${i + 1}/${allArtists.length}] ${artist} → `);

      try {
        const result = await getGenresHaiku(`Artist: ${artist}`);
        genreCache.set(key, result);
        if (result.normalized.length > 0) {
          console.log(result.normalized.join(", "));
          haikuFound++;
        } else {
          console.log("(no tags)");
        }
      } catch (e: any) {
        console.log(`ERROR: ${e.message}`);
        genreCache.set(key, { raw: [], normalized: [] });
      }

      if (i < allArtists.length - 1) await sleep(250);
    }

    // Save after Haiku pass
    applyToTracks(episodes, genreCache);
    await fsPromises.writeFile(TRACKS_FILE, JSON.stringify(episodes, null, 2));

    const haikuEmpty = allArtists.length - haikuFound;
    console.log(`\n✅ Haiku: ${haikuFound} tagged, ${haikuEmpty} empty → saved.\n`);

    if (HAIKU_ONLY) return;
  }

  // ── Pass 1b: Haiku retry with title case for empty artists ────────────────
  if (HAIKU_RETRY || (!HAIKU_ONLY && !SONNET_PASS)) {
    const retryArtists = allArtists.filter((a) => {
      const r = genreCache.get(a.toLowerCase());
      return !r || r.normalized.length === 0;
    });

    if (retryArtists.length > 0) {
      console.log(`\n🔄 Haiku retry with title case (${retryArtists.length} artists)...\n`);
      let retryFound = 0;

      for (let i = 0; i < retryArtists.length; i++) {
        const artist = retryArtists[i];
        const key = artist.toLowerCase();
        const titleName = toTitleCase(artist);
        process.stdout.write(`[${i + 1}/${retryArtists.length}] ${titleName} → `);

        try {
          const result = await getGenresHaiku(`Artist: ${titleName}`);
          if (result.normalized.length > 0) {
            genreCache.set(key, result);
            console.log(result.normalized.join(", "));
            retryFound++;
          } else {
            console.log("(no tags)");
          }
        } catch (e: any) {
          console.log(`ERROR: ${e.message}`);
        }

        if (i < retryArtists.length - 1) await sleep(250);
      }

      applyToTracks(episodes, genreCache);
      await fsPromises.writeFile(TRACKS_FILE, JSON.stringify(episodes, null, 2));
      console.log(`\n✅ Haiku retry: ${retryFound}/${retryArtists.length} recovered → saved.\n`);
    }

    if (HAIKU_RETRY) return;
  }

  // ── Pass 2: Sonnet + web_search for empty artists ─────────────────────────
  const emptyArtists = allArtists.filter((a) => {
    const r = genreCache.get(a.toLowerCase());
    return !r || r.normalized.length === 0;
  });

  if (emptyArtists.length === 0) {
    console.log("✅ No empty artists — Sonnet pass skipped.");
    return;
  }

  console.log(`\n🔍 Pass 2 — Sonnet + web search (${emptyArtists.length} artists)...\n`);
  let sonnetFound = 0;

  for (let i = 0; i < emptyArtists.length; i++) {
    const artist = emptyArtists[i];
    const key = artist.toLowerCase();
    process.stdout.write(`[${i + 1}/${emptyArtists.length}] ${artist} → `);

    try {
      const result = await getGenresSonnetSearch(`Artist: ${artist}`);
      genreCache.set(key, result);
      if (result.normalized.length > 0) {
        console.log(result.normalized.join(", "));
        sonnetFound++;
      } else {
        console.log("(no tags)");
      }
    } catch (e: any) {
      console.log(`ERROR: ${e.message}`);
    }

    if (i < emptyArtists.length - 1) await sleep(500);
  }

  applyToTracks(episodes, genreCache);
  await fsPromises.writeFile(TRACKS_FILE, JSON.stringify(episodes, null, 2));

  console.log(`\n✅ Sonnet: ${sonnetFound}/${emptyArtists.length} recovered.`);
  console.log(`💾 Saved to ${TRACKS_FILE}`);
};

genreEnrich().catch(console.error);
