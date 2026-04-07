import "dotenv/config";
import fsPromises from "fs/promises";
import { getAccessToken } from "../lib/tidalAuth.js";
import { getTrackInfo } from "../lib/tidalClient.js";
import { TRACKS_FILE } from "../lib/config.js";
import { EpisodeAggregated, BaseTrack } from "../lib/types.js";
import { computeMatchScore, MIN_ARTIST_VERIFY } from "../lib/similarity.js";

const FETCH_DELAY_MS = 500;
const SAVE_EVERY = 50;

// A match is flagged only when BOTH score and artistScore are below threshold.
// If artistScore is high (≥0.8) but titleScore is low, TIDAL likely moved a feat.
// into the artist field — treat it as OK.
const MISMATCH_SCORE_THRESHOLD = 0.5;

const CHECKPOINT_FILE = "./data/battiti/tidal_verify_checkpoint.json";
const REPORT_FILE = "./data/battiti/tidal_id_mismatches.txt";

interface Checkpoint {
  processedCount: number;
  ok: number;
  mismatches: number;
  notFound: number;
  report: string[];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));


const isMismatch = (
  score: number,
  artistScore: number,
): boolean => {
  // Artist matches well → TIDAL may have split a feat. into a separate artist entry.
  // Don't flag these as mismatches.
  if (artistScore >= 0.8) return false;
  return score < MISMATCH_SCORE_THRESHOLD || artistScore < MIN_ARTIST_VERIFY;
};

// ── Main ───────────────────────────────────────────────────────────────────────

const isResume = process.argv.includes("--resume");

const raw = await fsPromises.readFile(TRACKS_FILE, "utf-8");
const episodes: EpisodeAggregated[] = JSON.parse(raw);

const byId = new Map<string, BaseTrack>();
for (const ep of episodes) {
  for (const t of ep.tracks) {
    if (t.tidalId && !byId.has(t.tidalId)) byId.set(t.tidalId, t);
  }
}
const entries = [...byId.entries()];
const total = entries.length;

let checkpoint: Checkpoint = { processedCount: 0, ok: 0, mismatches: 0, notFound: 0, report: [] };

if (isResume) {
  try {
    const raw = await fsPromises.readFile(CHECKPOINT_FILE, "utf-8");
    checkpoint = JSON.parse(raw);
    console.log(`\n▶️  Resuming from track ${checkpoint.processedCount + 1}/${total}\n`);
  } catch {
    console.log("\n⚠️  No checkpoint found, starting from the beginning.\n");
  }
} else {
  await fsPromises.writeFile(REPORT_FILE, "");
  console.log(`\n🔍 Verifying ${total} unique TIDAL IDs...\n`);
}

let { processedCount, ok, mismatches, notFound, report } = checkpoint;
let token = await getAccessToken();

for (let i = processedCount; i < entries.length; i++) {
  if (i % 50 === 0 && i > 0) token = await getAccessToken();

  const [tidalId, track] = entries[i];
  await sleep(FETCH_DELAY_MS);
  const tidal = await getTrackInfo(tidalId, token);

  if (!tidal) {
    notFound++;
    const line = `[NOT FOUND] ${tidalId} | ${track.artist} – ${track.title}`;
    console.log(`❓ ${line}`);
    report.push(line);
    await fsPromises.appendFile(REPORT_FILE, line + "\n\n");
  } else {
    const { score, artistScore, titleScore } = computeMatchScore(
      track.artist, track.title, tidal.artist, tidal.title
    );

    if (isMismatch(score, artistScore)) {
      mismatches++;
      const line = [
        `[MISMATCH] ${tidalId}`,
        `  ours:  ${track.artist} – ${track.title}`,
        `  tidal: ${tidal.artist} – ${tidal.title}`,
        `  score=${score.toFixed(2)} artist=${artistScore.toFixed(2)} title=${titleScore.toFixed(2)}`,
      ].join("\n");
      console.log(`❌ ${line}`);
      report.push(line);
      await fsPromises.appendFile(REPORT_FILE, line + "\n\n");
    } else {
      ok++;
      process.stdout.write(`✅ [${i + 1}/${total}] ${track.artist} – ${track.title}\r`);
    }
  }

  processedCount = i + 1;

  if (processedCount % SAVE_EVERY === 0) {
    await fsPromises.writeFile(CHECKPOINT_FILE, JSON.stringify({ processedCount, ok, mismatches, notFound, report }, null, 2));
  }
}

// Final save
await fsPromises.writeFile(CHECKPOINT_FILE, JSON.stringify({ processedCount, ok, mismatches, notFound, report }, null, 2));

console.log(`\n\n── Results ──────────────────────────────`);
console.log(`✅ OK:         ${ok}`);
console.log(`❌ Mismatches: ${mismatches}`);
console.log(`❓ Not found:  ${notFound}`);
console.log(`─────────────────────────────────────────\n`);

if (report.length > 0) {
  console.log(`📄 Report in ${REPORT_FILE}`);
}
