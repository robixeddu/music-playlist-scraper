import { BaseTrack, EpisodeAggregated, Track } from "./types.js";

const normalizeString = (str: string): string => {
  if (!str) return "";
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/ /g, "_")
    .trim();
};

const parseTrackString = (trackStr: string): BaseTrack | null => {
  try {
    const cleaned = trackStr
      .trim()
      .replace(/\s+/g, " ")
      .replace(/\u00A0/g, " ");

    if (!cleaned || cleaned.length < 10) {
      return null;
    }

    const firstComma = cleaned.indexOf(",");
    if (firstComma === -1) {
      console.warn(`No comma found in: ${cleaned}`);
      return null;
    }

    const artist = cleaned.substring(0, firstComma).trim();
    const remainder = cleaned.substring(firstComma + 1).trim();
    const albumPattern = /,\s*da\s*["']([^"']+)["']\s*[-–—]\s*(.+)$/;
    const albumMatch = remainder.match(albumPattern);

    let title: string;
    let albumDetails = "";

    if (albumMatch) {
      title = remainder.substring(0, albumMatch.index).trim();
      albumDetails = albumMatch[0].trim();
    } else {
      const labelPattern = /[-–—]\s*(.+)$/;
      const labelMatch = remainder.match(labelPattern);

      if (labelMatch && labelMatch.index && labelMatch.index > 5) {
        title = remainder.substring(0, labelMatch.index).trim();
        albumDetails = labelMatch[0].trim();
      } else {
        title = remainder.trim();
      }
    }

    title = title.replace(/[,\s]+$/, "").trim();

    if (!artist || !title || artist.length < 2 || title.length < 2) {
      console.warn(`Invalid artist/title: "${artist}" / "${title}"`);
      return null;
    }

    const key = `${normalizeString(artist)}___${normalizeString(title)}`;

    return {
      title,
      artist,
      albumDetails,
      key,
    };
  } catch (error) {
    console.error(`Parse error for: ${trackStr}`, error);
    return null;
  }
};

const aggregateTracksByEpisode = (tracks: Track[]): EpisodeAggregated[] => {
  const episodesMap = new Map<string, EpisodeAggregated>();

  tracks.forEach((track) => {
    const key = track.episodeUrl;

    if (!episodesMap.has(key)) {
      episodesMap.set(key, {
        episodeTitle: track.episodeTitle,
        episodeUrl: track.episodeUrl,
        date: track.date,
        tracks: [],
      });
    }

    const episodeAggregated = episodesMap.get(key)!;

    episodeAggregated.tracks.push({
      title: track.title,
      artist: track.artist,
      albumDetails: track.albumDetails || "",
      key: track.key,
    } as BaseTrack);
  });

  return Array.from(episodesMap.values());
};

export { parseTrackString, aggregateTracksByEpisode };
