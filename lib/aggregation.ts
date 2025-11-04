import { Track } from "./types.js";

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

export { updateAllTracks, getKnownEpisodeUrls };