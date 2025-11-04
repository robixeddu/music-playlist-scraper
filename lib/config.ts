export const TRACKS_FILE = "./data/tracks.json";
export const EXPORT_FILE = "./data/new_tracks_for_tidal.txt";

export const BASE_URL = process.env.SCRAPER_BASE_URL;
export const PROGRAM_PATH = process.env.SCRAPER_PROGRAM_PATH;
export const BATTITI_URL = `${BASE_URL}${PROGRAM_PATH}`;
export const SKIPPED_COUNT_LIMIT = 20;

export const SELECTORS = {
    EPISODE_LINK: "rps-cta-link[weblink]",
    EPISODE_TITLE: ".audio__header__title",
    EPISODE_DATE: ".audio__header p.text-gray-medium",
    EPISODE_DESCRIPTION: ".audio__header p",
};

if (!BASE_URL || !PROGRAM_PATH) {
    console.warn("⚠️ WARNING: SCRAPER_BASE_URL or SCRAPER_PROGRAM_PATH not found in environment variables. Check your .env file.");
}