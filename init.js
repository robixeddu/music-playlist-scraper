import dotenv from "dotenv";
dotenv.config();

import { loadPreviousTracks, saveTracks, exportNewTracks } from "./lib/fileHandler.js";
import { getEpisodeLinks, getTracksFromEpisode } from "./lib/scraper.js";
import { aggregateTracksByEpisode } from "./lib/parser.js";
import { updateAllTracks, getKnownEpisodeUrls } from "./lib/aggregation.js";
import { logStart, logAnalysisSummary, logNewTracks, logInterruption, logError } from "./lib/logger.js";
import { TRACKS_FILE, EXPORT_FILE, BATTITI_URL, SKIPPED_COUNT_LIMIT } from "./lib/config.js";


async function main() {
    logStart(BATTITI_URL);

    const previousTracks = await loadPreviousTracks(TRACKS_FILE);
    const episodeLinks = await getEpisodeLinks(BATTITI_URL); 

    let allTracks = previousTracks; 
    let newTracks = []; 
    let scrapedCount = 0;
    let skippedCount = 0;

    const knownEpisodeUrls = getKnownEpisodeUrls(previousTracks); 
    let isNewEpisodeFound = false;

    for (const link of episodeLinks) {
        if (knownEpisodeUrls.has(link)) {
            skippedCount++;

            if (isNewEpisodeFound || skippedCount > SKIPPED_COUNT_LIMIT) {
                logInterruption(link);
                break;
            }

            continue;
        }

        isNewEpisodeFound = true;

        try {
            const episodeTracks = await getTracksFromEpisode(link);
            scrapedCount++;

            allTracks = updateAllTracks(allTracks, episodeTracks, newTracks); 

        } catch (e) {
            logError(`episode processing ${link}`, e.message);
        }
    }

    logAnalysisSummary(scrapedCount, episodeLinks.length, skippedCount);
    logNewTracks(newTracks.length, allTracks.length);

    const aggregatedResults = aggregateTracksByEpisode(allTracks);
    
    await saveTracks(aggregatedResults, TRACKS_FILE); 
    await exportNewTracks(newTracks, EXPORT_FILE); 
}

main().catch((err) =>
    logError("application startup", err.message || err)
);