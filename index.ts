import { loadPreviousTracks, saveTracks, exportNewTracks, ensureDataDirectory } from "./lib/fileHandler.js";
import { getEpisodeLinks, getTracksFromEpisode } from "./lib/scraper.js";
import { aggregateTracksByEpisode } from "./lib/aggregation.js";
import { updateAllTracks, getKnownEpisodeUrls } from "./lib/aggregation.js";
import { logStart, logAnalysisSummary, logNewTracks, logInterruption, logError } from "./lib/logger.js";
import { BATTITI_URL, SKIPPED_COUNT_LIMIT } from "./lib/config.js";
import { Track } from "./lib/types.js";

async function main(): Promise<void> {
    await ensureDataDirectory();

    logStart(BATTITI_URL);

    const previousTracks = await loadPreviousTracks();
    const episodeLinks = await getEpisodeLinks(BATTITI_URL);

    let allTracks = previousTracks;
    let newTracks: Track[] = [];
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

        } catch (e: any) {
            logError(`episode processing ${link}`, e.message);
        }
    }

    logAnalysisSummary(scrapedCount, episodeLinks.length, skippedCount);
    logNewTracks(newTracks.length, allTracks.length);

    await saveTracks(aggregateTracksByEpisode(allTracks));
    await exportNewTracks(newTracks);
}

main().catch((err: any) =>
    logError("application startup", (err as Error).message || "Unknown error")
);
