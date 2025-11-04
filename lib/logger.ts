const logNewTracks = (count: number, totalHistorical: number): void => {
    console.log(`🎧 Found **${count}** new tracks (total historical: ${totalHistorical})`);
};

const logEpisodesAggregated = (count: number): void => {
    console.log(`💾 Found **${count}** episodes aggregated (tracks.json)`);
};

const logCompletion = (message: string): void => {
    console.log(`✅ ${message}`);
};

const logAnalysisSummary = (scraped: number, total: number, skipped: number): void => {
    console.log(`---`);
    console.log(`✅ Episodes analyzed: ${scraped}/${total} (Skipped: ${skipped})`);
};

const logStart = (url: string): void => {
    console.log(`🎧 Start scraping ${url}`);
};

const logInterruption = (link: string): void => {
    console.log(`⏭️ Found known episode (${link}). Stopping incremental analysis.`);
};

const logError = (context: string, message: string): void => {
    console.error(`❌ Error during ${context}: ${message}`);
};

export {
    logNewTracks,
    logEpisodesAggregated,
    logCompletion,
    logAnalysisSummary,
    logStart,
    logInterruption,
    logError
};