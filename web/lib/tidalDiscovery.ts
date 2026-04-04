"use client";

import { getUserPlaylistsMap } from "./tidal-api";

// Singleton promise — all ImportButtons share one TIDAL call per session
let promise: Promise<Map<string, string>> | null = null;

export function discoverUserPlaylists(token: string): Promise<Map<string, string>> {
  if (!promise) {
    promise = getUserPlaylistsMap(token).catch(() => new Map());
  }
  return promise;
}

export function resetDiscovery(): void {
  promise = null;
}
