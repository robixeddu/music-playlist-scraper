"use client";

import { getPlaylistItemIds, getPlaylistCount, TidalNotFoundError } from "./tidal-api";
import type { PlaylistType } from "./tidal-import";

const VERIFY_DELAY_MS = 150;

type VerifyRequest = {
  type: PlaylistType;
  slug: string;
  playlistId: string;
  tidalIds: string[];
  referenceIds?: string[]; // tidalIds stored at last import — avoids false "+N" for TIDAL-unavailable tracks
  token: string;
  onResult: (newIds: string[], playlistId: string) => void;
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
      if (req.referenceIds) {
        // Fast path: pure in-memory diff, no API call needed.
        // Shows +N only for tracks genuinely new since last import.
        // 404 detection happens lazily on next import attempt.
        const refSet = new Set(req.referenceIds);
        const newIds = req.tidalIds.filter((id) => !refSet.has(id));
        req.onVerified();
        req.onResult(newIds, req.playlistId);
      } else {
        // No reference — verify against TIDAL (first import or state lost)
        const count = await getPlaylistCount(req.token, req.playlistId);
        if (count !== null && count >= req.tidalIds.length) {
          req.onVerified();
          req.onResult([], req.playlistId);
        } else {
          const tidalSet = await getPlaylistItemIds(req.token, req.playlistId);
          const newIds = req.tidalIds.filter((id) => !tidalSet.has(id));
          req.onVerified();
          req.onResult(newIds, req.playlistId);
        }
      }
    } catch (e: unknown) {
      if (e instanceof TidalNotFoundError) {
        req.onNotFound();
      }
      // other errors: skip silently
    }
    // Only delay before API-bound requests (no referenceIds = calls TIDAL)
    if (queue.length > 0 && !queue[0].referenceIds) {
      await new Promise<void>((r) => setTimeout(r, VERIFY_DELAY_MS));
    }
  }
  running = false;
}

export function enqueueVerify(req: VerifyRequest): void {
  if (queue.some((r) => r.type === req.type && r.slug === req.slug)) return;
  queue.push(req);
  processQueue();
}
