import "dotenv/config";
import { getAccessToken } from "./lib/tidalAuth.js";
import { findTidalMatch } from "./lib/tidalClient.js";

const queries = [
  { artist: "U ROY", title: "Dancehall Memories", album: "Tappa Records Showcase" },
  { artist: "PRINCE JAZZBO", title: "Meet Me In The 6th Street", album: "Black Heart Man - Bushay Collection 1974 – 1978" },
  { artist: "BOB MOULD", title: "You Need To Shine", album: "Here We Go Crazy" },
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
