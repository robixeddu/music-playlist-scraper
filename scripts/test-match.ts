import "dotenv/config";
import { getAccessToken } from "../lib/tidalAuth.js";
import { searchTracks } from "../lib/tidalClient.js";
import { computeMatchScore } from "../lib/similarity.js";

const [, , artist, ...titleParts] = process.argv;
const title = titleParts.join(" ");

if (!artist || !title) {
  console.error("Usage: npx tsx test-match.ts <artist> <title>");
  process.exit(1);
}

const token = await getAccessToken();
const queries = [
  `${artist} ${title}`,
  title,
  artist,
  `${artist} Inventor VOL 2`,  // album hint test
];

for (const q of queries) {
  console.log(`\n🔍 Query: "${q}"`);
  const results = await searchTracks(q, artist, token);
  if (results.length === 0) {
    console.log("  → no results");
    continue;
  }
  results.slice(0, 5).forEach(r => {
    const s = computeMatchScore(artist, title, r.artistName, r.title);
    console.log(`  score=${s.score.toFixed(2)} a=${s.artistScore.toFixed(2)} t=${s.titleScore.toFixed(2)} | "${r.artistName}" – "${r.title}" [${r.id}]`);
  });
}
