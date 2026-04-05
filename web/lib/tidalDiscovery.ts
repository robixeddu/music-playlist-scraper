"use client";

import { getUserPlaylistsMap, type TidalPlaylistInfo } from "./tidal-api";

// One call per session, shared across all ImportButtons
let promise: Promise<Map<string, TidalPlaylistInfo>> | null = null;

export function discoverUserPlaylists(token: string): Promise<Map<string, TidalPlaylistInfo>> {
  if (!promise) {
    promise = getUserPlaylistsMap(token).catch(() => new Map());
  }
  return promise;
}

export function resetDiscovery(): void {
  promise = null;
}
