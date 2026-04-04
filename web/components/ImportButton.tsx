"use client";

import { useState, useEffect } from "react";
import type { ImportStatus } from "@/lib/types";
import { importPlaylist, loadImportedIds, getLocalImportedIds, getLocalPlaylistId, clearPlaylistState, type PlaylistType } from "@/lib/tidal-import";
import { enqueueVerify } from "@/lib/tidalVerifyQueue";
import { useTidalConnected } from "@/lib/useTidalConnected";
import { useImportLock } from "@/lib/useImportLock";
import { redirectToTidal, getStoredToken, getStoredUserId } from "@/lib/tidal-auth";
import { usePlaylistStatus } from "@/lib/usePlaylistStatus";
import { useT } from "./LangProvider";

interface ImportButtonProps {
  type: PlaylistType;
  slug: string;
  playlistName: string;
  tidalIds: string[];
}

export default function ImportButton({
  type,
  slug,
  playlistName,
  tidalIds,
}: ImportButtonProps) {
  const tr = useT();
  const [connected] = useTidalConnected();
  const { importing, acquire, release } = useImportLock();
  const playlistStatus = usePlaylistStatus();
  const [status, setStatus] = useState<ImportStatus>(() => {
    const imported = getLocalImportedIds(type, slug);
    if (!imported) return { state: "idle" };
    const newCount = tidalIds.filter((id) => !imported.has(id)).length;
    return newCount === 0 ? { state: "up-to-date" } : { state: "has-new", count: newCount };
  });

  useEffect(() => {
    playlistStatus?.report(`${type}:${slug}`, status.state);
  }, [status.state]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load state from Redis on mount — works even without active TIDAL session
  useEffect(() => {
    if (tidalIds.length === 0) return;
    const userId = getStoredUserId() ?? getStoredToken()?.userId;
    if (!userId) return;

    loadImportedIds(userId, type, slug).then((imported) => {
      if (!imported) {
        setStatus({ state: "idle" });
        return;
      }
      const newCount = tidalIds.filter((id) => !imported.has(id)).length;
      setStatus(newCount === 0 ? { state: "up-to-date" } : { state: "has-new", count: newCount });

      if (newCount === 0) {
        const token = getStoredToken();
        const playlistId = getLocalPlaylistId(type, slug);
        if (token && playlistId) {
          enqueueVerify({
            type, slug, playlistId, tidalIds,
            token: token.access_token,
            onResult: (missing) => {
              if (missing > 0) setStatus({ state: "has-new", count: missing });
            },
            onNotFound: () => {
              clearPlaylistState(userId, type, slug);
              setStatus({ state: "idle" });
            },
          });
        }
      }
    }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleClick() {
    if (status.state === "loading" || importing) return;

    const token = getStoredToken();
    if (!token) {
      await redirectToTidal(window.location.pathname);
      return;
    }

    if (tidalIds.length === 0) {
      setStatus({ state: "error", message: tr.noTidalTracks });
      return;
    }

    setStatus({ state: "loading" });
    acquire();
    try {
      const result = await importPlaylist({ type, slug, playlistName, tidalIds });
      setStatus({
        state: "success",
        added: result.added,
        alreadyPresent: result.alreadyPresent,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Errore sconosciuto";
      setStatus({ state: "error", message });
    } finally {
      release();
    }
  }


  if (status.state === "up-to-date") {
    return (
      <span className="px-3 py-1.5 text-sm text-[var(--muted)] whitespace-nowrap">
        {tr.upToDate}
      </span>
    );
  }

  if (status.state === "idle") {
    return (
      <button
        onClick={handleClick}
        disabled={!connected || tidalIds.length === 0 || importing}
        className="px-3 py-1.5 rounded text-sm font-medium bg-[var(--accent)] text-white hover:opacity-90 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
      >
        {tr.import}
      </button>
    );
  }

  if (status.state === "has-new") {
    return (
      <button
        onClick={handleClick}
        disabled={importing}
        className="px-3 py-1.5 rounded text-sm font-medium border border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
      >
        {tr.newTracks(status.count)}
      </button>
    );
  }

  if (status.state === "loading") {
    return (
      <button
        className="px-3 py-1.5 rounded text-sm font-medium bg-[var(--accent)] text-white flex items-center gap-2 whitespace-nowrap cursor-default opacity-80"
      >
        <svg
          className="animate-spin h-3.5 w-3.5"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
        {tr.importing}
      </button>
    );
  }

  if (status.state === "success") {
    return (
      <span className="px-3 py-1.5 rounded text-sm font-medium text-green-400 bg-green-400/10 whitespace-nowrap">
        {tr.importSuccess(status.added, status.alreadyPresent)}
      </span>
    );
  }

  // error
  return (
    <span
      title={status.message}
      className="px-3 py-1.5 rounded text-sm font-medium text-red-400 bg-red-400/10 whitespace-nowrap cursor-help"
    >
      ✗ {tr.importError}
    </span>
  );
}
