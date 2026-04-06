import { loadPreviousTracks, saveTracks, exportNewTracks, ensureDataDirectory } from "./lib/fileHandler.js";
import { getEpisodeLinks, getTracksFromEpisode } from "./lib/scraper.js";
import { aggregateTracksByEpisode } from "./lib/aggregation.js";
import { updateAllTracks, getKnownEpisodeUrls } from "./lib/aggregation.js";
import { BATTITI_URL, SKIPPED_COUNT_LIMIT } from "./lib/config.js";
import { Track } from "./lib/types.js";

async function ingest(): Promise<void> {
    await ensureDataDirectory();

    console.log(`🎧 Start scraping ${BATTITI_URL}`);

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
                console.log(`⏭️ Found known episode (${link}). Stopping incremental analysis.`);
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
            console.error(`❌ Error during episode processing ${link}: ${e.message}`);
        }
    }

    console.log(`---`);
    console.log(`✅ Episodes analyzed: ${scrapedCount}/${episodeLinks.length} (Skipped: ${skippedCount})`);
    console.log(`🎧 Found **${newTracks.length}** new tracks (total historical: ${allTracks.length})`);

    await saveTracks(aggregateTracksByEpisode(allTracks));
    await exportNewTracks(newTracks);
}

ingest().catch((err: any) =>
    console.error(`❌ Error during application startup: ${(err as Error).message || "Unknown error"}`)
);
