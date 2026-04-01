import "dotenv/config";
import fsPromises from "fs/promises";
import { getAccessToken } from "./lib/tidalAuth.js";
import { TRACKS_FILE } from "./lib/config.js";
import { EpisodeAggregated, BaseTrack } from "./lib/types.js";
import { computeMatchScore, MIN_ARTIST_VERIFY } from "./lib/similarity.js";

const COUNTRY_CODE = process.env.TIDAL_COUNTRY_CODE ?? "IT";
const BASE_URL = "https://openapi.tidal.com/v2";
const FETCH_DELAY_MS = 500;
// Tracks with score below this are flagged as mismatches
const MISMATCH_THRESHOLD = 0.5;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const fetchTrack = async (id: string, token: string): Promise<{ title: string; artist: string } | null> => {
  try {
    const res = await fetch(`${BASE_URL}/tracks/${id}?countryCode=${COUNTRY_CODE}&include=artists`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/vnd.api+json",
      },
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const d = await res.json() as any;
    const title: string = d.data?.attributes?.title ?? "";
    const artists: string[] = (d.included ?? [])
      .filter((x: any) => x.type === "artists")
      .map((a: any) => a.attributes?.name ?? "")
      .filter(Boolean);
    return { title, artist: artists.join(", ") || "?" };
  } catch {
    return null;
  }
};

const raw = await fsPromises.readFile(TRACKS_FILE, "utf-8");
const episodes: EpisodeAggregated[] = JSON.parse(raw);

// Collect unique (tidalId → track) — one representative per ID
const byId = new Map<string, BaseTrack>();
for (const ep of episodes) {
  for (const t of ep.tracks) {
    if (t.tidalId && !byId.has(t.tidalId)) byId.set(t.tidalId, t);
  }
}

const total = byId.size;
console.log(`\n🔍 Verifying ${total} unique TIDAL IDs...\n`);

let token = await getAccessToken();
let ok = 0;
let mismatches = 0;
let notFound = 0;
let i = 0;

const report: string[] = [];

for (const [tidalId, track] of byId) {
  i++;
  if (i % 50 === 0) token = await getAccessToken();

  await sleep(FETCH_DELAY_MS);
  const tidal = await fetchTrack(tidalId, token);

  if (!tidal) {
    notFound++;
    const line = `[NOT FOUND] ${tidalId} | ${track.artist} – ${track.title}`;
    console.log(`❓ ${line}`);
    report.push(line);
    continue;
  }

  const { score, artistScore, titleScore } = computeMatchScore(
    track.artist, track.title, tidal.artist, tidal.title
  );

  const isMismatch = score < MISMATCH_THRESHOLD || artistScore < MIN_ARTIST_VERIFY;

  if (isMismatch) {
    mismatches++;
    const line = [
      `[MISMATCH] ${tidalId}`,
      `  ours:  ${track.artist} – ${track.title}`,
      `  tidal: ${tidal.artist} – ${tidal.title}`,
      `  score=${score.toFixed(2)} artist=${artistScore.toFixed(2)} title=${titleScore.toFixed(2)}`,
    ].join("\n");
    console.log(`❌ ${line}`);
    report.push(line);
  } else {
    ok++;
    process.stdout.write(`✅ [${i}/${total}] ${track.artist} – ${track.title}\r`);
  }
}

console.log(`\n\n── Results ──────────────────────────────`);
console.log(`✅ OK:         ${ok}`);
console.log(`❌ Mismatches: ${mismatches}`);
console.log(`❓ Not found:  ${notFound}`);
console.log(`─────────────────────────────────────────\n`);

if (report.length > 0) {
  const reportFile = "./data/battiti/tidal_id_mismatches.txt";
  await fsPromises.writeFile(reportFile, report.join("\n\n") + "\n");
  console.log(`📄 Report saved to ${reportFile}`);
}
