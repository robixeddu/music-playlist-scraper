"use client";

import { useState } from "react";
import { importPlaylist, type PlaylistType } from "@/lib/tidal-import";
import { useTidalConnected } from "@/lib/useTidalConnected";
import { useImportLock } from "@/lib/useImportLock";
import { redirectToTidal, getStoredToken } from "@/lib/tidal-auth";
import { usePlaylistStatus } from "@/lib/usePlaylistStatus";
import { useT } from "./LangProvider";

interface ImportAllItem {
  type: PlaylistType;
  slug: string;
  playlistName: string;
  tidalIds: string[];
}

interface ImportAllButtonProps {
  items: ImportAllItem[];
}

type State =
  | { state: "idle" }
  | { state: "loading"; done: number; total: number }
  | { state: "success"; added: number; alreadyPresent: number }
  | { state: "error"; message: string };

export default function ImportAllButton({ items }: ImportAllButtonProps) {
  const tr = useT();
  const [connected] = useTidalConnected();
  const { importing, acquire, release } = useImportLock();
  const [status, setStatus] = useState<State>({ state: "idle" });
  const playlistStatus = usePlaylistStatus();

  const upToDate =
    items.length > 0 &&
    items.every((it) => {
      if (it.tidalIds.length === 0) return true;
      return playlistStatus?.statuses.get(`${it.type}:${it.slug}`) === "up-to-date";
    });

  async function handleClick() {
    if (status.state === "loading" || importing) return;

    const token = getStoredToken();
    if (!token) {
      await redirectToTidal(window.location.pathname);
      return;
    }

    const eligible = items.filter((it) => it.tidalIds.length > 0);
    if (eligible.length === 0) return;

    setStatus({ state: "loading", done: 0, total: eligible.length });
    acquire();

    let totalAdded = 0;
    let totalPresent = 0;

    try {
      for (let i = 0; i < eligible.length; i++) {
        try {
          const result = await importPlaylist(eligible[i]);
          totalAdded += result.added;
          totalPresent += result.alreadyPresent;
        } catch {
          // skip failures, continue with remaining
        }
        setStatus({ state: "loading", done: i + 1, total: eligible.length });
      }
    } finally {
      release();
    }

    setStatus({ state: "success", added: totalAdded, alreadyPresent: totalPresent });
  }

  if (status.state === "idle") {
    if (upToDate) return null;
    return (
      <button
        onClick={handleClick}
        disabled={!connected || importing || items.every((it) => it.tidalIds.length === 0)}
        className="px-3 py-1.5 rounded text-sm font-medium border border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
      >
        {tr.importAll}
      </button>
    );
  }

  if (status.state === "loading") {
    return (
      <button
        className="px-3 py-1.5 rounded text-sm font-medium border border-[var(--accent)] text-[var(--accent)] flex items-center gap-2 whitespace-nowrap cursor-default opacity-80"
      >
        <svg
          className="animate-spin h-3.5 w-3.5"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        {tr.importAllProgress(status.done, status.total)}
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

  return (
    <span
      title={status.message}
      className="px-3 py-1.5 rounded text-sm font-medium text-red-400 bg-red-400/10 whitespace-nowrap cursor-help"
    >
      ✗ {tr.importError}
    </span>
  );
}
