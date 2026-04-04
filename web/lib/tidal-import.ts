"use client";

import { getStoredToken } from "./tidal-auth";
import {
  createPlaylist,
  getPlaylistItemIds,
  addTracksToPlaylist,
} from "./tidal-api";

export type PlaylistType = "global" | "genre" | "episode";

function storageKey(type: PlaylistType, slug: string): string {
  return `battiti_tidal_${type}_${slug}`;
}

// ── localStorage helpers (fast cache) ─────────────────────────────────────────

function getLocalPlaylistId(type: PlaylistType, slug: string): string | null {
  try {
    return localStorage.getItem(storageKey(type, slug));
  } catch {
    return null;
  }
}

function setLocalPlaylistId(type: PlaylistType, slug: string, id: string): void {
  try {
    localStorage.setItem(storageKey(type, slug), id);
  } catch {}
}

// Stores the set of tidalIds known to be in the playlist — used for instant delta on remount
function importedIdsKey(type: PlaylistType, slug: string): string {
  return `${storageKey(type, slug)}_ids`;
}

export function getLocalImportedIds(type: PlaylistType, slug: string): Set<string> | null {
  try {
    const raw = localStorage.getItem(importedIdsKey(type, slug));
    if (!raw) return null;
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return null;
  }
}

function saveLocalImportedIds(type: PlaylistType, slug: string, ids: string[]): void {
  try {
    localStorage.setItem(importedIdsKey(type, slug), JSON.stringify(ids));
  } catch {}
}

// ── DB helpers (persistent, cross-device) ─────────────────────────────────────

async function getDbPlaylistId(
  userId: string,
  type: PlaylistType,
  slug: string
): Promise<string | null> {
  try {
    const res = await fetch(
      `/api/playlists?userId=${encodeURIComponent(userId)}&type=${type}&slug=${encodeURIComponent(slug)}`
    );
    const data = (await res.json()) as { playlistId: string | null };
    return data.playlistId ?? null;
  } catch {
    return null;
  }
}

function saveDbPlaylistId(
  userId: string,
  type: PlaylistType,
  slug: string,
  id: string
): void {
  // Fire and forget — don't block the import flow
  fetch("/api/playlists", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, type, slug, playlistId: id }),
  }).catch(() => {});
}

// ── Resolve: localStorage first, then DB ──────────────────────────────────────

async function resolvePlaylistId(
  userId: string,
  type: PlaylistType,
  slug: string
): Promise<string | null> {
  const local = getLocalPlaylistId(type, slug);
  if (local) return local;

  const remote = await getDbPlaylistId(userId, type, slug);
  if (remote) {
    setLocalPlaylistId(type, slug, remote); // populate cache
  }
  return remote;
}

// ── Persist: both localStorage and DB ─────────────────────────────────────────

function persistPlaylistId(
  userId: string,
  type: PlaylistType,
  slug: string,
  id: string
): void {
  setLocalPlaylistId(type, slug, id);
  saveDbPlaylistId(userId, type, slug, id);
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface ImportResult {
  added: number;
  alreadyPresent: number;
}

export async function checkDelta(params: {
  type: PlaylistType;
  slug: string;
  tidalIds: string[];
}): Promise<{ newCount: number } | null> {
  const token = getStoredToken();
  if (!token) return null;

  const playlistId = await resolvePlaylistId(token.userId, params.type, params.slug);
  if (!playlistId) return null;

  try {
    const existingIds = await getPlaylistItemIds(token.access_token, playlistId);
    const newCount = params.tidalIds.filter((id) => !existingIds.has(id)).length;
    return { newCount };
  } catch (e: unknown) {
    if (e instanceof Error && e.message.toLowerCase().includes("not found")) return null;
    throw e;
  }
}

export async function importPlaylist(params: {
  type: PlaylistType;
  slug: string;
  playlistName: string;
  tidalIds: string[];
}): Promise<ImportResult> {
  const { type, slug, playlistName, tidalIds } = params;

  const token = getStoredToken();
  if (!token) throw new Error("Not authenticated");

  const { access_token: accessToken, userId } = token;

  const createNew = async () => {
    const id = await createPlaylist(
      accessToken,
      playlistName,
      `Battiti – ${playlistName}`
    );
    persistPlaylistId(userId, type, slug, id);
    return id;
  };

  let playlistId = await resolvePlaylistId(userId, type, slug);
  if (!playlistId) {
    playlistId = await createNew();
  }

  // Fetch existing track IDs, recreating playlist if not found
  let existingIds: Set<string>;
  try {
    existingIds = await getPlaylistItemIds(accessToken, playlistId);
  } catch (e: unknown) {
    if (e instanceof Error && e.message.includes("not found")) {
      playlistId = await createNew();
      existingIds = new Set();
    } else {
      throw e;
    }
  }

  const newIds = tidalIds.filter((id) => !existingIds.has(id));
  const alreadyPresent = tidalIds.length - newIds.length;

  if (newIds.length > 0) {
    await addTracksToPlaylist(accessToken, playlistId, newIds);
  }

  // Persist the full current set so next render can compute delta instantly
  saveLocalImportedIds(type, slug, tidalIds);

  return { added: newIds.length, alreadyPresent };
}
