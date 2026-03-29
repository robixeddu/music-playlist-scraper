const logNewTracks = (count: number, totalHistorical: number): void => {
  console.log(
    `🎧 Found **${count}** new tracks (total historical: ${totalHistorical})`
  );
};

const logSavedTracks = (aggregatedTracksLength: number, filePath: string, newEpisodes?: number) => {
  const newPart = newEpisodes !== undefined ? `+${newEpisodes} new, ` : "";
  console.log(
    `💾 Saved to ${filePath} (${newPart}${aggregatedTracksLength} total episodes)`
  );
};

const logCompletion = (message: string): void => {
  console.log(`✅ ${message}`);
};

const logSuccessParsing = (tracksLength: number, episodeTitle: string) => {
  console.log(
    `✅ Successfully parsed ${tracksLength} tracks from episode ${episodeTitle}`
  );
};

const logCreatedDirectory = (dirPath: string) => {
  console.log(`Created directory: ${dirPath}`);
};

const logAnalysisSummary = (
  scraped: number,
  total: number,
  skipped: number
): void => {
  console.log(`---`);
  console.log(
    `✅ Episodes analyzed: ${scraped}/${total} (Skipped: ${skipped})`
  );
};

const logStart = (url: string): void => {
  console.log(`🎧 Start scraping ${url}`);
};

const logInterruption = (link: string): void => {
  console.log(
    `⏭️ Found known episode (${link}). Stopping incremental analysis.`
  );
};

const logError = (context: string, message: string): void => {
  console.error(`❌ Error during ${context}: ${message}`);
};

const logWarn = (context: string): void => {
  console.warn(`⚠️ Warning ${context}`);
};

export {
  logNewTracks,
  logSavedTracks,
  logCompletion,
  logSuccessParsing,
  logCreatedDirectory,
  logAnalysisSummary,
  logStart,
  logInterruption,
  logError,
  logWarn,
};
