export interface BaseTrack {
  title: string;
  artist: string;
  albumDetails?: string;
  key: string;
}

export interface Track extends BaseTrack {
  episodeTitle?: string;
  episodeUrl: string;
  date: string;
}

export interface TrackForSaving extends BaseTrack {}

export interface EpisodeAggregated {
  episodeTitle: string;
  episodeUrl: string;
  date: string;
  tracks: TrackForSaving[];
}

export interface RawEpisodeData {
  id: string;
  description: string;
}
