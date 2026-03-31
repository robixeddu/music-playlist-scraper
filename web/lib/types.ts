export type { BaseTrack as Track, EpisodeAggregated } from "@root/lib/types";

export interface Source {
  id: string;
  name: string;
  description: string;
  url?: string;
  playlistPrefix: string;
  color: string;
  active: boolean;
}

export interface TidalToken {
  access_token: string;
  expires_at: number;
}

export type ImportStatus =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "success"; added: number; alreadyPresent: number }
  | { state: "error"; message: string };

export interface GenreRow {
  genre: string;
  count: number;
}
