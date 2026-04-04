"use client";

import { getPlaylistItemIds, TidalNotFoundError } from "./tidal-api";
import type { PlaylistType } from "./tidal-import";

const VERIFY_DELAY_MS = 400;

type VerifyRequest = {
  type: PlaylistType;
  slug: string;
  playlistId: string;
  tidalIds: string[];
  token: string;
  onResult: (missing: number) => void;
  onNotFound: () => void;
};

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
      req.onResult(missing);
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
