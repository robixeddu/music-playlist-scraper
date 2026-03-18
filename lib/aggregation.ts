import { Track, EpisodeAggregated, BaseTrack } from "./types.js";

const getKnownEpisodeUrls = (previousTracks: Track[]): Set<string> => {
  return new Set(previousTracks.map((t) => t.episodeUrl));
};

const updateAllTracks = (
  allTracks: Track[],
  newEpisodeTracks: Track[],
  newTracks: Track[]
): Track[] => {
  const knownKeys = new Set(allTracks.map((t) => t.key));

  newEpisodeTracks.forEach((track) => {
    if (!knownKeys.has(track.key)) {
      allTracks.push(track);
      newTracks.push(track);
      knownKeys.add(track.key);
    }
  });

  return allTracks;
};

const aggregateTracksByEpisode = (tracks: Track[]): EpisodeAggregated[] => {
  const episodesMap = new Map<string, EpisodeAggregated>();

  tracks.forEach((track) => {
    const key = track.episodeUrl;

    if (!episodesMap.has(key)) {
      episodesMap.set(key, {
        episodeTitle: track.episodeTitle,
        episodeUrl: track.episodeUrl,
        date: track.date,
        tracks: [],
      });
    }

    episodesMap.get(key)!.tracks.push({
      title: track.title,
      artist: track.artist,
      albumDetails: track.albumDetails || "",
      key: track.key,
    } as BaseTrack);
  });

  return Array.from(episodesMap.values());
};

export { updateAllTracks, getKnownEpisodeUrls, aggregateTracksByEpisode };
