"use client";

import { createContext, useContext, useState, useCallback } from "react";
import type { ImportStatus } from "../lib/types";

export type StatusEntry = {
  state: ImportStatus["state"];
  playlistId?: string;
  newIds?: string[];
};

type StatusMap = Map<string, StatusEntry>;

const PlaylistStatusContext = createContext<{
  report: (key: string, entry: StatusEntry) => void;
  statuses: StatusMap;
} | null>(null);

export function PlaylistStatusProvider({ children }: { children: React.ReactNode }) {
  const [statuses, setStatuses] = useState<StatusMap>(new Map());

  const report = useCallback((key: string, entry: StatusEntry) => {
    setStatuses((prev) => {
      const existing = prev.get(key);
      if (existing?.state === entry.state && existing?.playlistId === entry.playlistId) return prev;
      return new Map(prev).set(key, entry);
    });
  }, []);

  return (
    <PlaylistStatusContext.Provider value={{ report, statuses }}>
      {children}
    </PlaylistStatusContext.Provider>
  );
}

export function usePlaylistStatus() {
  return useContext(PlaylistStatusContext);
}
