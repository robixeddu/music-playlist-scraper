"use client";

import {
  getStoredToken,
  redirectToTidal,
} from "./tidal-auth";
import {
  createPlaylist,
  getPlaylistItemIds,
  addTracksToPlaylist,
} from "./tidal-api";

export type PlaylistType = "global" | "genre" | "episode";

function storageKey(type: PlaylistType, slug: string): string {
  return `battiti_tidal_${type}_${slug}`;
}

function getStoredPlaylistId(type: PlaylistType, slug: string): string | null {
  try {
    return localStorage.getItem(storageKey(type, slug));
  } catch {
    return null;
  }
}

function savePlaylistId(type: PlaylistType, slug: string, id: string): void {
  try {
    localStorage.setItem(storageKey(type, slug), id);
  } catch {
    // silently ignore storage errors
  }
}

export interface ImportResult {
  added: number;
  alreadyPresent: number;
}

export async function importPlaylist(params: {
  type: PlaylistType;
  slug: string;
  playlistName: string;
  tidalIds: string[];
}): Promise<ImportResult> {
  const { type, slug, playlistName, tidalIds } = params;

  const token = getStoredToken();
  if (!token) {
    await redirectToTidal("/");
    // redirectToTidal navigates away; this line is never reached in practice
    throw new Error("Not authenticated");
  }

  const accessToken = token.access_token;

  // Get or create playlist
  let playlistId = getStoredPlaylistId(type, slug);

  if (!playlistId) {
    playlistId = await createPlaylist(
      accessToken,
      playlistName,
      `Battiti – ${playlistName}`
    );
    savePlaylistId(type, slug, playlistId);
  }

  // Fetch existing track IDs from the playlist
  const existingIds = await getPlaylistItemIds(accessToken, playlistId);

  // Compute delta
  const newIds = tidalIds.filter((id) => !existingIds.has(id));
  const alreadyPresent = tidalIds.length - newIds.length;

  if (newIds.length > 0) {
    await addTracksToPlaylist(accessToken, playlistId, newIds);
  }

  return { added: newIds.length, alreadyPresent };
}
