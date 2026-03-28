import fsPromises from "fs/promises";
import path from "path";
import {
  logError,
  logCompletion,
  logCreatedDirectory,
  logSavedTracks,
} from "./logger.js";
import { TRACKS_FILE, EXPORT_FILE } from "./config.js";
import { Track, EpisodeAggregated, BaseTrack } from "./types.js";

const ensureDataDirectory = async (): Promise<void> => {
  const dirPath = path.dirname(TRACKS_FILE);
  try {
    const created = await fsPromises.mkdir(dirPath, { recursive: true });
    if (created) logCreatedDirectory(dirPath);
  } catch (e: any) {
    logError("creating data directory", e.message);
    throw e;
  }
};

const loadPreviousTracks = async (): Promise<Track[]> => {
  try {
    const data = await fsPromises.readFile(TRACKS_FILE, "utf-8");
    const loadedData: any = JSON.parse(data);

    if (
      Array.isArray(loadedData) &&
      loadedData.length > 0 &&
      (loadedData[0] as EpisodeAggregated).tracks
    ) {
      const flatTracks: Track[] = [];

      (loadedData as EpisodeAggregated[]).forEach((episode) => {
        const episodeContext = {
          episodeTitle: episode.episodeTitle,
          episodeUrl: episode.episodeUrl,
          date: episode.date,
        };

        episode.tracks.forEach((track: BaseTrack) => {
          flatTracks.push({ ...track, ...episodeContext } as Track);
        });
      });
      return flatTracks;
    }

    return loadedData as Track[];
  } catch (e: any) {
    if (e.code === "ENOENT") return [];
    if (e instanceof SyntaxError) {
      logError("loading tracks.json", `Invalid JSON — fix or restore the file before running. (${e.message})`);
      process.exit(1);
    }
    logError("loading tracks.json", e.message);
    return [];
  }
};

const saveTracks = async (
  aggregatedTracks: EpisodeAggregated[]
): Promise<void> => {
  try {
    await fsPromises.writeFile(
      TRACKS_FILE,
      JSON.stringify(aggregatedTracks, null, 2)
    );
    logSavedTracks(aggregatedTracks.length, TRACKS_FILE);
  } catch (e: any) {
    logError("saving tracks.json", e.message);
  }
};

const exportNewTracks = async (tracks: Track[]): Promise<void> => {
  if (tracks.length === 0) {
    logCompletion("No new tracks to export.");
    return;
  }

  const cleanedContent = tracks
    .map((t) => {
      const clean = (str: string) =>
        str
          .replace(/ \(([^)]+)\)/g, "")
          .replace(/ \[([^\]]+)\]/g, "")
          .trim();

      return `${clean(t.artist)} - ${clean(t.title)}`;
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
