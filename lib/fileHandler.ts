// lib/fileHandler.ts
import fs from "fs";
import fsPromises from "fs/promises";
import path from "path";
import { logError, logCompletion } from "./logger.js";
// Import all required constants from config
import { TRACKS_FILE, EXPORT_FILE } from "./config.js";
// Import types
import { Track, EpisodeAggregated, TrackForSaving } from "./types.js";

/**
 * Ensures the data directory exists before the script attempts to write files.
 * Uses the directory path derived from TRACKS_FILE in config.
 */
const ensureDataDirectory = async (): Promise<void> => {
    // Get the directory path (e.g., ../data)
    const dirPath = path.dirname(TRACKS_FILE); 
    
    if (!fs.existsSync(dirPath)) {
        try {
            await fsPromises.mkdir(dirPath, { recursive: true });
            console.log(`Created directory: ${dirPath}`); // Log for first run
        } catch (e: any) {
            logError("creating data directory", e.message);
            throw e; // Stop execution if we can't create the directory
        }
    }
};

const loadPreviousTracks = async (): Promise<Track[]> => {
    try {
        if (!fs.existsSync(TRACKS_FILE)) return [];
        const data = await fsPromises.readFile(TRACKS_FILE, "utf-8");
        const aggregatedData: any = JSON.parse(data);

        if (
            Array.isArray(aggregatedData) &&
            aggregatedData.length > 0 &&
            aggregatedData[0].tracks
        ) {
            const flatTracks: Track[] = [];

            (aggregatedData as EpisodeAggregated[]).forEach((episode) => {
                episode.tracks.forEach((track: TrackForSaving) => {
                    flatTracks.push({
                        title: track.title,
                        artist: track.artist,
                        episodeTitle: episode.episodeTitle,
                        episodeUrl: episode.episodeUrl,
                        date: episode.date,
                        albumDetails: track.albumDetails || "",
                        key: track.key,
                    });
                });
            });
            return flatTracks;
        }

        return aggregatedData as Track[];

    } catch (e: any) {
        logError("loading tracks.json", e.message);
        return [];
    }
};

/**
 * Saves the complete aggregated list of episodes to tracks.json.
 * @param {EpisodeAggregated[]} aggregatedTracks - The array of episode objects.
 */
const saveTracks = async (aggregatedTracks: EpisodeAggregated[]): Promise<void> => {
    try {
        await fsPromises.writeFile(
            TRACKS_FILE,
            JSON.stringify(aggregatedTracks, null, 2)
        );

        console.log(
            `💾 Saved ${aggregatedTracks.length} episodes to ${TRACKS_FILE} (aggregated format)`
        );
    } catch (e: any) {
        logError("saving tracks.json", e.message);
    }
};

/**
 * Exports only the new tracks found in this run to a clean text file.
 * @param {Track[]} tracks - The array of new tracks found.
 */
const exportNewTracks = async (tracks: Track[]): Promise<void> => {
    if (tracks.length === 0) {
        logCompletion("No new tracks to export.");
        return;
    }

    const cleanedContent = tracks
        .map((t) => {
            const clean = (str: string) => // Type the 'str' parameter
                str
                    .replace(/ \(([^)]+)\)/g, "")
                    .replace(/ \[([^\]]+)\]/g, "")
                    .trim();

            const cleanedTitle = clean(t.title);
            const cleanedArtist = clean(t.artist);

            return `${cleanedArtist} - ${cleanedTitle}`;
        })
        .join("\n");

    try {
        await fsPromises.writeFile(EXPORT_FILE, cleanedContent);
        logCompletion(`${tracks.length} tracks exported to ${EXPORT_FILE}.`);
    } catch (e: any) {
        logError("exporting new tracks", e.message);
    }
};

export { ensureDataDirectory, loadPreviousTracks, saveTracks, exportNewTracks };