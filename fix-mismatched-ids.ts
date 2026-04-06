import "dotenv/config";
import fsPromises from "fs/promises";
import { getAccessToken } from "./lib/tidalAuth.js";
import { findTidalMatch } from "./lib/tidalClient.js";
import { TRACKS_FILE } from "./lib/config.js";
import { EpisodeAggregated, BaseTrack } from "./lib/types.js";

const REPORT_FILE = "./data/battiti/tidal_id_mismatches.txt";
const CHECKPOINT_FILE = "./data/battiti/fix_mismatched_checkpoint.json";
const SAVE_EVERY = 50;

// ── Parse mismatch report into blocks ────────────────────────────────────────
const reportRaw = await fsPromises.readFile(REPORT_FILE, "utf-8");

interface MismatchEntry {
  artist: string;
  title: string;
  block: string; // original text block, kept for rewriting the report
}

const entries: MismatchEntry[] = [];
// Split on blank lines to get individual blocks
const blocks = reportRaw.split(/\n\n+/).map(b => b.trim()).filter(Boolean);
for (const block of blocks) {
  const ourLine = block.split("\n").find(l => /^\s+ours:/.test(l)) ?? "";
  const m = ourLine.match(/^\s+ours:\s+(.+?)\s+–\s+(.+)$/);
  if (m) entries.push({ artist: m[1].trim(), title: m[2].trim(), block });
}

// ── Build lookup: "artist|||title" → [{ ep, idx }] ───────────────────────────
const raw = await fsPromises.readFile(TRACKS_FILE, "utf-8");
const episodes: EpisodeAggregated[] = JSON.parse(raw);

const lookup = new Map<string, { ep: number; idx: number; track: BaseTrack }[]>();
for (let ei = 0; ei < episodes.length; ei++) {
  for (let ti = 0; ti < episodes[ei].tracks.length; ti++) {
    const t = episodes[ei].tracks[ti];
    const key = `${t.artist}|||${t.title}`;
    if (!lookup.has(key)) lookup.set(key, []);
    lookup.get(key)!.push({ ep: ei, idx: ti, track: t });
  }
}

// Deduplicate entries by artist+title (same track may appear in multiple episodes)
const seen = new Set<string>();
const queue: (MismatchEntry & { refs: { ep: number; idx: number }[] })[] = [];
const fixedKeys = new Set<string>(); // tracks successfully fixed

for (const e of entries) {
  const key = `${e.artist}|||${e.title}`;
  if (seen.has(key)) continue;
  seen.add(key);
  const refs = lookup.get(key);
  if (!refs) continue;
  queue.push({ ...e, refs: refs.map(r => ({ ep: r.ep, idx: r.idx })) });
}

// ── Resume support ────────────────────────────────────────────────────────────
let startFrom = 0;
let found = 0;
let notFound = 0;

const isResume = process.argv.includes("--resume");
if (isResume) {
  try {
    const cp = JSON.parse(await fsPromises.readFile(CHECKPOINT_FILE, "utf-8"));
    startFrom = cp.processedCount ?? 0;
    found = cp.found ?? 0;
    notFound = cp.notFound ?? 0;
    console.log(`\n▶️  Resuming from ${startFrom + 1}/${queue.length}\n`);
  } catch {
    console.log("\n⚠️  No checkpoint found, starting from the beginning.\n");
  }
} else {
  console.log(`\n🔍 Re-searching ${queue.length} unique mismatched tracks...\n`);
}

let token = await getAccessToken();
let currentIndex = startFrom;

const saveProgress = async () => {
  await fsPromises.writeFile(TRACKS_FILE, JSON.stringify(episodes, null, 2));
  await fsPromises.writeFile(CHECKPOINT_FILE, JSON.stringify({ processedCount: currentIndex, found, notFound }));
  // Rewrite report keeping only unresolved entries
  const remaining = entries.filter(e => !fixedKeys.has(`${e.artist}|||${e.title}`));
  await fsPromises.writeFile(REPORT_FILE, remaining.map(e => e.block).join("\n\n") + (remaining.length ? "\n" : ""));
  console.log(`  📋 Remaining mismatches: ${remaining.length}`);
};

process.on("SIGINT", async () => {
  console.log(`\n\n⚠️  Interrupted at ${currentIndex}/${queue.length} — saving...`);
  await saveProgress();
  console.log(`💾 Saved. Resume with: npm run fix-mismatched-ids -- --resume`);
  process.exit(0);
});

for (let i = startFrom; i < queue.length; i++) {
  currentIndex = i;
  if (i % 50 === 0 && i > 0) token = await getAccessToken();

  const { artist, title, refs } = queue[i];
  process.stdout.write(`[${i + 1}/${queue.length}] ${artist} – ${title} → `);

  // Extract album hint from albumDetails of first ref
  const firstTrack = episodes[refs[0].ep].tracks[refs[0].idx];
  const albumMatch = firstTrack.albumDetails?.match(/["""]([^"""]+)["""]/);
  const album = albumMatch?.[1];

  try {
    const match = await findTidalMatch(artist, title, token, album);
    if (match) {
      console.log(`✅ ${match.id} (score: ${match.score.toFixed(2)})`);
      for (const { ep, idx } of refs) {
        episodes[ep].tracks[idx].tidalId = match.id;
      }
      fixedKeys.add(`${artist}|||${title}`);
      found++;
    } else {
      console.log(`❌ not found`);
      notFound++;
    }
  } catch (e: any) {
    console.error(`❌ Error during searching "${artist} ${title}": ${e.message}`);
    notFound++;
  }

  if ((i + 1) % SAVE_EVERY === 0) {
    currentIndex = i + 1;
    await saveProgress();
    console.log(`  💾 Progress saved (${i + 1}/${queue.length})\n`);
  }
}

currentIndex = queue.length;
await saveProgress();
console.log(`\n✅ Done. Found: ${found}, Not found: ${notFound}`);
console.log(`💾 Saved to ${TRACKS_FILE}`);
