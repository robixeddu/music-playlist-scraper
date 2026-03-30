import "dotenv/config";
import fsPromises from "fs/promises";
import { TRACKS_FILE } from "./lib/config.js";
import { EpisodeAggregated } from "./lib/types.js";

const [, , tidalId, ...rest] = process.argv;
const query = rest.join(" ").toLowerCase();

if (!tidalId || !query) {
  console.error("Usage: node dist/set-tidal-id.js <tidalId> <artist or title fragment>");
  process.exit(1);
}

const raw = await fsPromises.readFile(TRACKS_FILE, "utf-8");
const episodes: EpisodeAggregated[] = JSON.parse(raw);

let matched = 0;
for (const ep of episodes) {
  for (const track of ep.tracks) {
    const haystack = `${track.artist} ${track.title}`.toLowerCase();
    if (haystack.includes(query)) {
      console.log(`  Match: "${track.artist}" – "${track.title}" (was: ${track.tidalId ?? "none"})`);
      track.tidalId = tidalId;
      matched++;
    }
  }
}

if (matched === 0) {
  console.log("No tracks matched.");
  process.exit(1);
}

await fsPromises.writeFile(TRACKS_FILE, JSON.stringify(episodes, null, 2));
console.log(`✅ Set tidalId=${tidalId} on ${matched} track(s).`);
