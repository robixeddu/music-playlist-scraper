import { BaseTrack, EpisodeAggregated, TrackForSaving, Track } from "./types.js"; 

const normalizeString = (str: string): string => {
    if (!str) return '';
    return str
        .toLowerCase()
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "")
        .replace(/\s{2,}/g, ' ')
        .replace(/ /g, '_')
        .trim();
};

const parseTrackString = (trackStr: string): BaseTrack | null => {
    const [artistPart, ...rest] = trackStr.split(",");

    let rawTitle = rest.join(",");
    let albumDetails = "";

    const albumRegex = /,\s*(da\s+"?.*"?\s*–?.*)$/i;
    const match = rawTitle.match(albumRegex);

    if (match) {
        albumDetails = match[1].trim();
        rawTitle = rawTitle.replace(albumRegex, "").trim();
    }

    const title = rawTitle.trim().replace(/^["']|["']$/g, "");
    const artist = artistPart.trim();

    if (!artist || title.length < 5) {
        return null;
    }
    
    const key = `${normalizeString(artist)}___${normalizeString(title)}`;

    return { title, artist, albumDetails, key };
};

const aggregateTracksByEpisode = (tracks: Track[]): EpisodeAggregated[] => {
    const episodesMap = new Map<string, EpisodeAggregated>();

    tracks.forEach((track) => {
        const key = track.episodeUrl;

        if (!episodesMap.has(key)) {
            episodesMap.set(key, {
                episodeTitle: track.episodeTitle || "Unknown",
                episodeUrl: track.episodeUrl,
                date: track.date || "Unknown",
                tracks: [],
            });
        }

        episodesMap.get(key)!.tracks.push({
            title: track.title,
            artist: track.artist,
            albumDetails: track.albumDetails || "",
            key: track.key
        } as TrackForSaving);
    });

    return Array.from(episodesMap.values());
};

export {
    parseTrackString,
    aggregateTracksByEpisode
};