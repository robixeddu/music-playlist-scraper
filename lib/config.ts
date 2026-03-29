import { logWarn } from "./logger.js";

export const PROGRAM_ID = process.env.PROGRAM_ID ?? "battiti";
export const PLAYLIST_PREFIX = PROGRAM_ID.toUpperCase();

const PROGRAM_DIR = `./data/${PROGRAM_ID}`;

export const TRACKS_FILE = `${PROGRAM_DIR}/tracks.json`;
export const EXPORT_FILE = `${PROGRAM_DIR}/new_tracks_for_playlist.txt`;
export const MISSING_TRACKS_FILE = `${PROGRAM_DIR}/missing_tracks.txt`;
export const GLOBAL_PLAYLIST_FILE = `${PROGRAM_DIR}/global_playlist.json`;
export const GENRE_PLAYLISTS_FILE = `${PROGRAM_DIR}/genre_playlists.json`;

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
    logWarn("⚠️ WARNING: SCRAPER_BASE_URL or SCRAPER_PROGRAM_PATH not found in environment variables. Check your .env file.");
}
