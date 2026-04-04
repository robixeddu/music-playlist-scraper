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

// ── localStorage helpers ───────────────────────────────────────────────────────

function getLocalPlaylistId(type: PlaylistType, slug: string): string | null {
  try { return localStorage.getItem(storageKey(type, slug)); } catch { return null; }
}

function setLocalPlaylistId(type: PlaylistType, slug: string, id: string): void {
  try { localStorage.setItem(storageKey(type, slug), id); } catch {}
}

export function importedIdsKey(type: PlaylistType, slug: string): string {
  return `${storageKey(type, slug)}_ids`;
}

export function getLocalImportedIds(type: PlaylistType, slug: string): Set<string> | null {
  try {
    const raw = localStorage.getItem(importedIdsKey(type, slug));
    if (!raw) return null;
    return new Set(JSON.parse(raw) as string[]);
  } catch { return null; }
}

function saveLocalImportedIds(type: PlaylistType, slug: string, ids: string[]): void {
  try { localStorage.setItem(importedIdsKey(type, slug), JSON.stringify(ids)); } catch {}
}

// ── DB helpers (persistent, cross-device) ─────────────────────────────────────

async function fetchDbState(
  userId: string,
  type: PlaylistType,
  slug: string
): Promise<{ playlistId: string | null; importedIds: string[] | null }> {
  try {
    const res = await fetch(
      `/api/playlists?userId=${encodeURIComponent(userId)}&type=${type}&slug=${encodeURIComponent(slug)}`
    );
    const data = (await res.json()) as { playlistId: string | null; importedIds: string[] | null };
    return data;
  } catch {
    return { playlistId: null, importedIds: null };
  }
}

function saveDbState(
  userId: string,
  type: PlaylistType,
  slug: string,
  opts: { playlistId?: string; importedIds?: string[] }
): void {
  fetch("/api/playlists", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, type, slug, ...opts }),
  }).catch(() => {});
}

function deleteDbState(userId: string, type: PlaylistType, slug: string): void {
  fetch(`/api/playlists?userId=${encodeURIComponent(userId)}&type=${type}&slug=${encodeURIComponent(slug)}`, {
    method: "DELETE",
  }).catch(() => {});
}

// ── Resolve state: localStorage first, then DB ────────────────────────────────

async function resolvePlaylistId(
  userId: string,
  type: PlaylistType,
  slug: string
): Promise<string | null> {
  // Always fetch from DB (Redis) as authoritative source — localStorage can be stale
  const { playlistId } = await fetchDbState(userId, type, slug);
  if (playlistId) setLocalPlaylistId(type, slug, playlistId); // keep local in sync
  return playlistId;
}

/**
 * Loads the imported IDs for a playlist, validating against DB.
 * If the playlist no longer exists in DB, clears stale local cache.
 * Returns null if no import record or playlist no longer exists.
 * Does NOT call TIDAL.
 */
export async function loadImportedIds(
  userId: string,
  type: PlaylistType,
  slug: string
): Promise<Set<string> | null> {
  const { playlistId, importedIds: dbIds } = await fetchDbState(userId, type, slug);

  if (!playlistId) {
    // Playlist removed from DB — clear any stale local state
    try { localStorage.removeItem(importedIdsKey(type, slug)); } catch {}
    try { localStorage.removeItem(storageKey(type, slug)); } catch {}
    return null;
  }

  // Playlist exists — prefer local cache, fall back to DB
  const local = getLocalImportedIds(type, slug);
  if (local) return local;

  if (dbIds) {
    saveLocalImportedIds(type, slug, dbIds);
    setLocalPlaylistId(type, slug, playlistId);
    return new Set(dbIds);
  }

  return null; // playlist exists but no import record yet
}

// ── Persist: both localStorage and DB ─────────────────────────────────────────

function persistPlaylistId(
  userId: string,
  type: PlaylistType,
  slug: string,
  id: string
): void {
  setLocalPlaylistId(type, slug, id);
  saveDbState(userId, type, slug, { playlistId: id });
}

function persistImportedIds(
  userId: string,
  type: PlaylistType,
  slug: string,
  ids: string[]
): void {
  saveLocalImportedIds(type, slug, ids);
  saveDbState(userId, type, slug, { importedIds: ids });
}

// ── Public API ────────────────────────────────────────────────────────────────

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
  if (!token) throw new Error("Not authenticated");

  const { access_token: accessToken, userId } = token;

  const createNew = async () => {
    const id = await createPlaylist(accessToken, playlistName, `Battiti – ${playlistName}`);
    persistPlaylistId(userId, type, slug, id);
    return id;
  };

  let playlistId = await resolvePlaylistId(userId, type, slug);
  if (!playlistId) playlistId = await createNew();

  let existingIds: Set<string>;
  try {
    existingIds = await getPlaylistItemIds(accessToken, playlistId);
  } catch (e: unknown) {
    if (e instanceof Error && e.message.toLowerCase().includes("not found")) {
      // Playlist deleted from TIDAL — clear all stale state, let user re-import explicitly
      try { localStorage.removeItem(importedIdsKey(type, slug)); } catch {}
      try { localStorage.removeItem(storageKey(type, slug)); } catch {}
      deleteDbState(userId, type, slug);
      throw new Error("Playlist non trovata su TIDAL. Clicca Import per ricrearla.");
    }
    throw e;
  }

  const newIds = tidalIds.filter((id) => !existingIds.has(id));
  const alreadyPresent = tidalIds.length - newIds.length;

  if (newIds.length > 0) {
    await addTracksToPlaylist(accessToken, playlistId, newIds);
  }

  // Persist the full current set to localStorage + Redis
  persistImportedIds(userId, type, slug, tidalIds);

  return { added: newIds.length, alreadyPresent };
}
