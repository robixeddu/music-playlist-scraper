export interface BaseTrack {
  title: string;
  artist: string;
  albumDetails?: string;
  key: string;
  genres?: string[];
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
