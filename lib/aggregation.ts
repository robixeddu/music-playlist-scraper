import { aggregateTracksByEpisode } from "./parser.js";
import { Track } from "./types.js";

const updateAllTracks = (
    allTracks: Track[], 
    episodeTracks: Track[], 
    newTracks: Track[]
): Track[] => {
    
    let updatedAllTracks: Track[] = [...allTracks];

    const knownKeys = new Set(allTracks.map(t => t.key));

    for (const track of episodeTracks) {
        if (!track || !track.key) continue; 
        
        if (!knownKeys.has(track.key)) {
            updatedAllTracks.push(track);
            newTracks.push(track);
            knownKeys.add(track.key);
        }
    }
    
    return updatedAllTracks;
};

const getKnownEpisodeUrls = (previousTracks: Track[]): Set<string> => {
    const aggregatedHistory = aggregateTracksByEpisode(previousTracks);
    return new Set(aggregatedHistory.map((ep) => ep.episodeUrl));
};

export {
    updateAllTracks,
    getKnownEpisodeUrls
};