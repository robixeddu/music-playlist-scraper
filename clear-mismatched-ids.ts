import "dotenv/config";
import fsPromises from "fs/promises";
import { TRACKS_FILE } from "./lib/config.js";
import { EpisodeAggregated } from "./lib/types.js";

const REPORT_FILE = "./data/battiti/tidal_id_mismatches.txt";

const report = await fsPromises.readFile(REPORT_FILE, "utf-8");

// Extract tidalIds from [MISMATCH] and [NOT FOUND] lines
const idsToRemove = new Set<string>();
for (const line of report.split("\n")) {
  const m = line.match(/^\[(MISMATCH|NOT FOUND)\]\s+(\d+)/);
  if (m) idsToRemove.add(m[2]);
}

console.log(`\n🗑  IDs to clear: ${idsToRemove.size}`);

const raw = await fsPromises.readFile(TRACKS_FILE, "utf-8");
const episodes: EpisodeAggregated[] = JSON.parse(raw);

let cleared = 0;
for (const ep of episodes) {
  for (const track of ep.tracks) {
    if (track.tidalId && idsToRemove.has(track.tidalId)) {
      delete track.tidalId;
      cleared++;
    }
  }
}

await fsPromises.writeFile(TRACKS_FILE, JSON.stringify(episodes, null, 2));
console.log(`✅ Cleared ${cleared} track entries from tracks.json`);
console.log(`💾 Saved to ${TRACKS_FILE}`);
console.log(`\nRun "npm run catalog-enrich" to re-search these tracks.\n`);
