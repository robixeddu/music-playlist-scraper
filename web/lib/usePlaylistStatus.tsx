"use client";

import { createContext, useContext, useState, useCallback } from "react";
import type { ImportStatus } from "./types";

type StatusMap = Map<string, ImportStatus["state"]>;

const PlaylistStatusContext = createContext<{
  report: (key: string, state: ImportStatus["state"]) => void;
  statuses: StatusMap;
} | null>(null);

export function PlaylistStatusProvider({ children }: { children: React.ReactNode }) {
  const [statuses, setStatuses] = useState<StatusMap>(new Map());

  const report = useCallback((key: string, state: ImportStatus["state"]) => {
    setStatuses((prev) => new Map(prev).set(key, state));
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
