"use client";

import { getPlaylistItemIds, TidalNotFoundError } from "./tidal-api";
import type { PlaylistType } from "./tidal-import";

const VERIFY_DELAY_MS = 400;
const STALE_MS = 30 * 60 * 1000; // 30 minutes

type VerifyRequest = {
  type: PlaylistType;
  slug: string;
  playlistId: string;
  tidalIds: string[];
  token: string;
  onResult: (missing: number) => void;
  onNotFound: () => void;
};

function verifiedKey(type: string, slug: string): string {
  return `battiti_verified_${type}_${slug}`;
}

function isStale(type: string, slug: string): boolean {
  try {
    const ts = localStorage.getItem(verifiedKey(type, slug));
    if (!ts) return true;
    return Date.now() - parseInt(ts, 10) > STALE_MS;
  } catch { return true; }
}

function markVerified(type: string, slug: string): void {
  try { localStorage.setItem(verifiedKey(type, slug), String(Date.now())); } catch {}
}

const queue: VerifyRequest[] = [];
let running = false;

async function processQueue() {
  if (running) return;
  running = true;
  while (queue.length > 0) {
    const req = queue.shift()!;
    try {
      const tidalSet = await getPlaylistItemIds(req.token, req.playlistId);
      const missing = req.tidalIds.filter((id) => !tidalSet.has(id)).length;
      markVerified(req.type, req.slug);
      req.onResult(missing);
    } catch (e: unknown) {
      if (e instanceof TidalNotFoundError) {
        req.onNotFound();
      }
      // other errors: skip silently, will retry after stale window
    }
    if (queue.length > 0) await new Promise<void>((r) => setTimeout(r, VERIFY_DELAY_MS));
  }
  running = false;
}

export function enqueueVerify(req: VerifyRequest): void {
  if (!isStale(req.type, req.slug)) return;
  if (queue.some((r) => r.type === req.type && r.slug === req.slug)) return;
  queue.push(req);
  processQueue();
}
