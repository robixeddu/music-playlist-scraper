"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { EpisodeAggregated } from "@/lib/types";
import { getUserCollectionTrackIds } from "@/lib/tidal-api";
import { getStoredToken } from "@/lib/tidal-auth";
import { importPlaylist } from "@/lib/tidal-import";
import { useTidalConnected } from "@/hooks/useTidalConnected";
import { useImportLock } from "@/hooks/useImportLock";
import { usePlaylistStatus } from "@/hooks/usePlaylistStatus";
import { useT } from "./LangProvider";
import type { LovedCache } from "@/app/api/loved-cache/route";

interface LovedSectionProps {
  playlistPrefix: string;
  episodes: EpisodeAggregated[];
}

type AutoStatus = "idle" | "loading" | "success" | "error";

const LS_ENABLED_KEY = "battiti_loved_enabled";

async function fetchCache(userId: string): Promise<LovedCache | null> {
  try {
    const res = await fetch(`/api/loved-cache?userId=${encodeURIComponent(userId)}`);
    const data = (await res.json()) as { cache: LovedCache | null };
    return data.cache;
  } catch {
    return null;
  }
}

function saveCache(userId: string, cache: LovedCache): void {
  fetch("/api/loved-cache", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, ...cache }),
  }).catch(() => {});
}

export default function LovedSection({ playlistPrefix, episodes }: LovedSectionProps) {
  const tr = useT();
  const [connected] = useTidalConnected();
  const { importing, acquire, release } = useImportLock();
  const playlistStatus = usePlaylistStatus();

  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setEnabled(localStorage.getItem(LS_ENABLED_KEY) === "true");
  }, []);

  const [autoStatus, setAutoStatus] = useState<AutoStatus>("idle");
  const [lastResult, setLastResult] = useState<{ added: number; alreadyPresent: number } | null>(null);

  const playlistName = `${playlistPrefix}-loved`;
  const globalKey = `global:${playlistPrefix.toLowerCase()}`;

  const handleToggle = (val: boolean) => {
    setEnabled(val);
    try { localStorage.setItem(LS_ENABLED_KEY, String(val)); } catch {}
  };

  const triggerAutoImport = useCallback(async () => {
    if (importing) return;
    const token = getStoredToken();
    if (!token) return;

    const battitiIds = new Set(
      episodes.flatMap((ep) => ep.tracks.flatMap((t) => (t.tidalId ? [t.tidalId] : [])))
    );

    acquire();
    setAutoStatus("loading");
    try {
      const cached = await fetchCache(token.userId);
      const cachedIds = new Set<string>(cached?.ids ?? []);
      const { ids: newIds, latestAddedAt } = await getUserCollectionTrackIds(
        token.access_token,
        token.userId,
        cached?.lastCheckedAt ?? undefined
      );

      for (const id of newIds) cachedIds.add(id);
      const tidalIds = [...cachedIds].filter((id) => battitiIds.has(id));

      if (latestAddedAt) {
        saveCache(token.userId, { ids: [...cachedIds], lastCheckedAt: latestAddedAt });
      }

      if (tidalIds.length === 0) {
        setAutoStatus("idle");
        return;
      }

      const result = await importPlaylist({ type: "loved", slug: "loved", playlistName, tidalIds });
      setLastResult(result);
      setAutoStatus("success");
      setTimeout(() => { setAutoStatus("idle"); setLastResult(null); }, 4000);
    } catch {
      setAutoStatus("error");
      setTimeout(() => setAutoStatus("idle"), 4000);
    } finally {
      release();
    }
  }, [importing, episodes, playlistName, acquire, release]); // eslint-disable-line react-hooks/exhaustive-deps

  // Trigger immediately when toggle is turned on (not on mount restore)
  const prevEnabledRef = useRef<boolean | null>(null);
  useEffect(() => {
    const prev = prevEnabledRef.current;
    prevEnabledRef.current = enabled;
    if (prev === null) return; // skip mount restore
    if (enabled && !prev && connected) triggerAutoImport();
  }, [enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  // Watch for global import success and auto-trigger
  const prevGlobalStateRef = useRef<string | undefined>(undefined);
  const globalState = playlistStatus?.statuses.get(globalKey)?.state;

  useEffect(() => {
    const prev = prevGlobalStateRef.current;
    prevGlobalStateRef.current = globalState;

    if (globalState === "success" && prev !== "success" && enabled && connected) {
      triggerAutoImport();
    }
  }, [globalState]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="px-5 py-4 flex items-center justify-between gap-4 border-b border-[var(--border)] last:border-b-0">
      <div className="flex flex-col min-w-0">
        <span className="font-mono text-sm font-medium text-[var(--foreground)]">{playlistName}</span>
        <span className="text-xs text-[var(--muted)] mt-0.5">{tr.sectionLovedDesc}</span>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {autoStatus === "loading" && (
          <svg
            aria-hidden="true"
            className="animate-spin h-3.5 w-3.5 text-[var(--muted)]"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {autoStatus === "success" && lastResult !== null && (
          <span className="text-xs text-[var(--muted)]">
            {tr.importSuccess(lastResult.added, lastResult.alreadyPresent)}
          </span>
        )}
        {autoStatus === "error" && (
          <span className="text-xs text-red-400">✗ {tr.importError}</span>
        )}
        <button
          role="switch"
          aria-checked={enabled}
          aria-label={playlistName}
          disabled={!connected}
          onClick={() => handleToggle(!enabled)}
          className={`relative w-9 h-5 rounded-full transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border)] ${
            enabled ? "bg-[var(--accent)]" : "bg-[var(--border)]"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
              enabled ? "translate-x-4" : "translate-x-0"
            }`}
          />
        </button>
      </div>
    </div>
  );
}
