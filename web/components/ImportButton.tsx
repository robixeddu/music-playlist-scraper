"use client";

import { useState, useEffect } from "react";
import type { ImportStatus } from "@/lib/types";
import { importPlaylist, importDelta, dedupPlaylist, resolvePlaylistState, clearPlaylistState, persistPlaylistId, type PlaylistType } from "@/lib/tidal-import";
import { enqueueVerify } from "@/lib/tidalVerifyQueue";
import { useTidalConnected } from "@/hooks/useTidalConnected";
import { useImportLock } from "@/hooks/useImportLock";
import { redirectToTidal, getStoredToken, getStoredUserId } from "@/lib/tidal-auth";
import { usePlaylistStatus } from "@/hooks/usePlaylistStatus";
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
  const [status, setStatus] = useState<ImportStatus>({ state: "idle" });
  const [deduping, setDeduping] = useState(false);
  const [dedupResult, setDedupResult] = useState<number | null>(null);
  const [dedupError, setDedupError] = useState<string | null>(null);

  useEffect(() => {
    const entry =
      status.state === "has-new"
        ? { state: status.state, playlistId: status.playlistId, newIds: status.newIds, hasExcess: status.hasExcess }
        : status.state === "up-to-date"
        ? { state: status.state, playlistId: status.playlistId, hasExcess: status.hasExcess }
        : { state: status.state };
    playlistStatus?.report(`${type}:${slug}`, entry);
  }, [status.state]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync state when ImportAllButton marks this playlist as up-to-date externally
  const contextEntry = playlistStatus?.statuses.get(`${type}:${slug}`);
  useEffect(() => {
    if (
      contextEntry?.state === "up-to-date" &&
      (status.state === "has-new" || status.state === "checking")
    ) {
      setStatus({ state: "up-to-date", playlistId: contextEntry.playlistId! });
    }
  }, [contextEntry?.state]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (tidalIds.length === 0) return;
    const token = getStoredToken();
    const userId = token?.userId ?? getStoredUserId();
    if (!token || !userId) return;

    resolvePlaylistState(userId, type, slug).then(({ playlistId: storedId, importedIds }) => {
      if (!storedId) return; // user hasn't imported yet → stays idle

      setStatus({ state: "checking" });
      enqueueVerify({
        type, slug, playlistId: storedId, tidalIds,
        referenceIds: importedIds ? Array.from(importedIds) : undefined,
        token: token.access_token,
        onVerified: () => { persistPlaylistId(userId, type, slug, storedId); },
        onResult: (newIds, pid, hasExcess) => {
          setStatus(newIds.length > 0
            ? { state: "has-new", count: newIds.length, playlistId: pid, newIds, hasExcess }
            : { state: "up-to-date", playlistId: pid, hasExcess });
        },
        onNotFound: () => {
          clearPlaylistState(userId, type, slug);
          setStatus({ state: "idle" });
        },
      });
    }).catch(() => {}); // ignore resolve errors — stays idle
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleClick() {
    if (status.state === "loading" || status.state === "checking" || importing) return;

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
      const userId = token.userId ?? getStoredUserId();
      const result =
        status.state === "has-new" && userId
          ? await importDelta({
              type, slug,
              playlistId: status.playlistId,
              newIds: status.newIds,
              allTidalIds: tidalIds,
              token: token.access_token,
              userId,
            })
          : await importPlaylist({
              type, slug, playlistName, tidalIds,
              playlistId: status.state === "up-to-date" ? status.playlistId : undefined,
            });
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


  if (status.state === "checking") {
    return (
      <span className="px-3 py-1.5 rounded text-sm font-medium text-[var(--muted)] flex items-center gap-2 whitespace-nowrap">
        <svg
          aria-hidden="true"
          className="animate-spin h-3.5 w-3.5"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        {tr.checking}
      </span>
    );
  }

  async function handleDedup() {
    if (deduping || status.state !== "up-to-date") return;
    const token = getStoredToken();
    if (!token || !status.playlistId) return;
    setDeduping(true);
    setDedupResult(null);
    setDedupError(null);
    try {
      const { removed } = await dedupPlaylist(token.access_token, status.playlistId);
      setDedupResult(removed);
    } catch (err) {
      setDedupError(err instanceof Error ? err.message : "errore dedup");
    } finally {
      setDeduping(false);
    }
  }

  if (status.state === "up-to-date") {
    const showDedup = (status.hasExcess || dedupError !== null) && dedupResult === null;
    return (
      <span className="flex items-center gap-2 whitespace-nowrap">
        <span className="px-3 py-1.5 text-sm text-[var(--muted)]">
          {dedupResult !== null ? tr.dedupRemoved(dedupResult) : tr.upToDate}
        </span>
        {showDedup && (
          <button
            onClick={handleDedup}
            disabled={deduping}
            title={dedupError ?? tr.dedup}
            className={`text-xs transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer mt-[2px] ${dedupError ? "text-red-400" : "text-[var(--muted)] hover:text-[var(--foreground)]"}`}
          >
            {deduping ? "…" : dedupError ? tr.dedupError : tr.dedup}
          </button>
        )}
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
    const showDedup = (status.hasExcess || dedupError !== null) && dedupResult === null;
    return (
      <span className="flex items-center gap-2 whitespace-nowrap">
        <button
          onClick={handleClick}
          disabled={importing}
          className="px-3 py-1.5 rounded text-sm font-medium border border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
        >
          {tr.newTracks(status.count)}
        </button>
        {showDedup && (
          <button
            onClick={handleDedup}
            disabled={deduping}
            title={dedupError ?? tr.dedup}
            className={`text-xs transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer mt-[2px] ${dedupError ? "text-red-400" : "text-[var(--muted)] hover:text-[var(--foreground)]"}`}
          >
            {deduping ? "…" : dedupError ? tr.dedupError : tr.dedup}
          </button>
        )}
      </span>
    );
  }

  if (status.state === "loading") {
    return (
      <button
        className="px-3 py-1.5 rounded text-sm font-medium bg-[var(--accent)] text-white flex items-center gap-2 whitespace-nowrap cursor-default opacity-80"
      >
        <svg
          aria-hidden="true"
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
