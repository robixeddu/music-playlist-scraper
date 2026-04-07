import "dotenv/config";
import { getAccessToken } from "../lib/tidalAuth.js";
import { findTidalMatch } from "../lib/tidalClient.js";

const tests: { artist: string; title: string; album?: string; expectId?: string; expectNull?: boolean; label?: string }[] = [
  // ── Precedentemente sbagliati → devono essere not found o trovare il corretto ──
  { artist: "PRINCE JAZZBO", title: "Meet Me In The 6th Street", album: "Black Heart Man - Bushay Collection 1974 – 1978", expectNull: true, label: "false positive fix" },
  { artist: "U ROY", title: "Dancehall Memories", album: "Tappa Records Showcase", expectNull: true, label: "false positive fix" },
  { artist: "MASS OF MARY", title: "Gloria", album: "Mass Of Mary", expectNull: true, label: "false positive fix" },
  { artist: "DJ SPOOKY THAT SUBLIMINAL KID", title: "Not In Our Name Remix (featuring Saul Williams)", album: "Celestial Mechanix", label: "niche/electronic" },

  // ── Bob Mould: precedentemente sbagliato, ora corretto ──
  { artist: "BOB MOULD", title: "You Need To Shine", album: "Here We Go Crazy", expectId: "492308331", label: "previously fixed" },

  // ── Artisti noti, devono ancora funzionare ──
  { artist: "DAVID BOWIE", title: "Heroes", label: "classic" },
  { artist: "MILES DAVIS", title: "So What", album: "Kind of Blue", label: "jazz classic" },
  { artist: "THE CLASH", title: "London Calling", label: "punk classic" },
  { artist: "NINA SIMONE", title: "Feeling Good", label: "soul classic" },

  // ── Artisti con formato complesso ──
  { artist: "DR.LONNIE SMITH", title: "Spinning Wheel", label: "dot in artist" },
  { artist: "HHY & THE MACUMBAS", title: "Gysin Version", label: "slash/& artist" },
  { artist: "THELONIOUS MONK", title: "Round Midnight", label: "jazz" },

  // ── Album disambiguation ──
  { artist: "JOHN COLTRANE", title: "A Love Supreme", album: "A Love Supreme", label: "album hint" },
];

const token = await getAccessToken();

let passed = 0;
let failed = 0;
let unexpected = 0;

for (const t of tests) {
  const label = t.label ? ` [${t.label}]` : "";
  process.stdout.write(`\n${t.artist} – ${t.title}${label} → `);

  const match = await findTidalMatch(t.artist, t.title, token, t.album);

  if (t.expectNull) {
    if (!match) {
      console.log(`✅ correctly not found`);
      passed++;
    } else {
      console.log(`❌ UNEXPECTED MATCH: ${match.id} (score ${match.score.toFixed(2)})`);
      failed++;
    }
  } else if (t.expectId) {
    if (match?.id === t.expectId) {
      console.log(`✅ ${match.id} (score ${match.score.toFixed(2)})`);
      passed++;
    } else {
      console.log(`❌ expected ${t.expectId}, got ${match?.id ?? "not found"}`);
      failed++;
    }
  } else {
    if (match) {
      console.log(`✅ ${match.id} (score ${match.score.toFixed(2)} artist=${match.artistScore.toFixed(2)})`);
      passed++;
    } else {
      console.log(`❓ not found`);
      unexpected++;
    }
  }
}

console.log(`\n── Results ──────────────────────────`);
console.log(`✅ passed:    ${passed}/${tests.length}`);
console.log(`❌ failed:    ${failed}`);
console.log(`❓ not found: ${unexpected}`);
