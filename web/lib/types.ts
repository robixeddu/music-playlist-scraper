export interface Track {
  title: string;
  artist: string;
  albumDetails?: string;
  key: string;
  genres?: string[];
  genresRaw?: string[];
  tidalId?: string;
}

export interface EpisodeAggregated {
  episodeTitle: string;
  episodeUrl: string;
  date: string;
  tracks: Track[];
}

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
