import "dotenv/config";
import { getAccessToken } from "./lib/tidalAuth.js";
import { findTidalMatch } from "./lib/tidalClient.js";

const queries = [
  { artist: "DJ SPOOKY THAT SUBLIMINAL KID", title: "Not In Our Name Remix (featuring Saul Williams)", album: "Celestial Mechanix" },
];

const token = await getAccessToken();

for (const q of queries) {
  process.stdout.write(`\n${q.artist} – ${q.title} → `);
  const match = await findTidalMatch(q.artist, q.title, token, q.album);
  if (match) {
    console.log(`✅ ID: ${match.id} (score: ${match.score.toFixed(2)})`);
  } else {
    console.log("❌ not found");
  }
}
