"use client";

import { getPlaylistItemIds, getPlaylistCount, TidalNotFoundError } from "./tidal-api";
import type { PlaylistType } from "./tidal-import";

const VERIFY_DELAY_MS = 400;

type VerifyRequest = {
  type: PlaylistType;
  slug: string;
  playlistId: string;
  tidalIds: string[];
  referenceIds?: string[]; // tidalIds stored at last import — avoids false "+N" for TIDAL-unavailable tracks
  token: string;
  onResult: (missing: number, playlistId: string) => void;
  onNotFound: () => void;
  onVerified: () => void;
};

const queue: VerifyRequest[] = [];
let running = false;

async function processQueue() {
  if (running) return;
  running = true;
  while (queue.length > 0) {
    const req = queue.shift()!;
    try {
      // Always do count check — fast single call, also detects playlist deletion (404)
      const count = await getPlaylistCount(req.token, req.playlistId);

      if (req.referenceIds) {
        // We have a reference from last import: only show "+N" for genuinely new app tracks,
        // not for tracks that TIDAL silently rejected as unavailable at import time.
        const refSet = new Set(req.referenceIds);
        const newTracks = req.tidalIds.filter((id) => !refSet.has(id)).length;
        req.onVerified();
        req.onResult(newTracks, req.playlistId);
      } else if (count !== null && count >= req.tidalIds.length) {
        req.onVerified();
        req.onResult(0, req.playlistId);
      } else {
        // No reference and count mismatch — fetch full ID set for precise diff
        const tidalSet = await getPlaylistItemIds(req.token, req.playlistId);
        const missing = req.tidalIds.filter((id) => !tidalSet.has(id)).length;
        req.onVerified();
        req.onResult(missing, req.playlistId);
      }
    } catch (e: unknown) {
      if (e instanceof TidalNotFoundError) {
        req.onNotFound();
      }
      // other errors: skip silently
    }
    if (queue.length > 0) await new Promise<void>((r) => setTimeout(r, VERIFY_DELAY_MS));
  }
  running = false;
}

export function enqueueVerify(req: VerifyRequest): void {
  if (queue.some((r) => r.type === req.type && r.slug === req.slug)) return;
  queue.push(req);
  processQueue();
}
