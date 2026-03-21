import "dotenv/config";
import fsPromises from "fs/promises";
import { TRACKS_FILE } from "./lib/config.js";
import { getArtistGenres } from "./lib/lastfm.js";
import { EpisodeAggregated, BaseTrack } from "./lib/types.js";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const genreEnrich = async () => {
  const raw = await fsPromises.readFile(TRACKS_FILE, "utf-8");
  const episodes: EpisodeAggregated[] = JSON.parse(raw);

  // Collect unique artists (case-insensitive dedup)
  const artistMap = new Map<string, string>(); // normalized → original
  for (const ep of episodes) {
    for (const track of ep.tracks) {
      const key = track.artist.toLowerCase();
      if (!artistMap.has(key)) artistMap.set(key, track.artist);
    }
  }

  const artists = [...artistMap.values()];
  console.log(`\n🎵 Enriching genres for ${artists.length} unique artists...\n`);

  const genreCache = new Map<string, string[]>();
  let found = 0;
  let empty = 0;

  for (let i = 0; i < artists.length; i++) {
    const artist = artists[i];
    const key = artist.toLowerCase();
    process.stdout.write(`[${i + 1}/${artists.length}] ${artist} → `);

    try {
      const genres = await getArtistGenres(artist);
      genreCache.set(key, genres);
      if (genres.length > 0) {
        console.log(genres.join(", "));
        found++;
      } else {
        console.log("(no tags)");
        empty++;
      }
    } catch (e: any) {
      console.log(`ERROR: ${e.message}`);
      genreCache.set(key, []);
    }

    // Last.fm allows 5 req/s — 250ms is safe
    if (i < artists.length - 1) await sleep(250);
  }

  // Apply genres to tracks
  for (const ep of episodes) {
    for (const track of ep.tracks as BaseTrack[]) {
      const genres = genreCache.get(track.artist.toLowerCase()) ?? [];
      if (genres.length > 0) {
        track.genres = genres;
      }
    }
  }

  await fsPromises.writeFile(TRACKS_FILE, JSON.stringify(episodes, null, 2));

  console.log(`\n✅ Done. ${found}/${artists.length} artists tagged, ${empty} with no data.`);
  console.log(`💾 Saved to ${TRACKS_FILE}`);
};

genreEnrich().catch(console.error);
