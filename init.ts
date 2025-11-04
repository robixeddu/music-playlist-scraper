import { loadPreviousTracks, saveTracks, exportNewTracks, ensureDataDirectory } from "./lib/fileHandler.js";
import { getEpisodeLinks, getTracksFromEpisode } from "./lib/scraper.js";
import { aggregateTracksByEpisode } from "./lib/parser.js";
import { updateAllTracks, getKnownEpisodeUrls } from "./lib/aggregation.js";
import { logStart, logAnalysisSummary, logNewTracks, logInterruption, logError } from "./lib/logger.js";
import { BATTITI_URL, SKIPPED_COUNT_LIMIT } from "./lib/config.js";
import { Track, EpisodeAggregated } from "./lib/types.js";

async function main(): Promise<void> {
    await ensureDataDirectory();

    logStart(BATTITI_URL);

    const previousTracks: Track[] = await loadPreviousTracks();
    const episodeLinks: string[] = await getEpisodeLinks(BATTITI_URL); 

    // Tipizzazione delle variabili di stato
    let allTracks: Track[] = previousTracks; 
    let newTracks: Track[] = []; 
    let scrapedCount: number = 0;
    let skippedCount: number = 0;

    const knownEpisodeUrls: Set<string> = getKnownEpisodeUrls(previousTracks); 
    let isNewEpisodeFound: boolean = false;

    // 3. Processing Loop
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
            const episodeTracks: Track[] = await getTracksFromEpisode(link);
            scrapedCount++;

            // Aggiorna gli array (newTracks viene modificato per riferimento)
            allTracks = updateAllTracks(allTracks, episodeTracks, newTracks); 

        } catch (e: any) { // Tipizza l'errore
            logError(`episode processing ${link}`, e.message);
        }
    }

    // 4. Final Logging
    logAnalysisSummary(scrapedCount, episodeLinks.length, skippedCount);
    logNewTracks(newTracks.length, allTracks.length);

    // 5. Save Data
    const aggregatedResults: EpisodeAggregated[] = aggregateTracksByEpisode(allTracks);
    
    await saveTracks(aggregatedResults); // Non serve più TRACKS_FILE
    await exportNewTracks(newTracks); // Non serve più EXPORT_FILE
}

// Esecuzione e gestione errori
main().catch((err: any) =>
    logError("application startup", (err as Error).message || "Unknown error")
);