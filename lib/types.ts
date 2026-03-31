export interface BaseTrack {
  title: string;
  artist: string;
  albumDetails?: string;
  key: string;
  genres?: string[];        // normalized via ALIASES (used for playlists/UI)
  genresRaw?: string[];     // raw Haiku output (audit trail)
  tidalId?: string;
}
export interface BaseEpisode {
  episodeTitle: string;
  episodeUrl: string;
  date: string;
}

export interface Track extends BaseTrack, BaseEpisode {}

export interface EpisodeAggregated extends BaseEpisode {
  tracks: BaseTrack[];
}
