import fetch from "node-fetch";
import * as cheerio from "cheerio";
import { parseTrackString } from "./parser.js";
import { logError, logSuccessParsing } from "./logger.js";
import { BASE_URL, SELECTORS } from "./config.js";
import { Track, BaseTrack } from "./types.js";

const fetchHtml = async (url: string): Promise<string> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Status ${res.status}`);
  return res.text();
};

const getEpisodeLinks = async (mainUrl: string): Promise<string[]> => {
  try {
    const html = await fetchHtml(mainUrl);
    const $ = cheerio.load(html);

    const links: string[] = [];
    $(SELECTORS.EPISODE_LINK).each((_, el) => {
      const weblink = $(el).attr("weblink");
      if (weblink && weblink.startsWith("/audio/")) {
        links.push(BASE_URL + weblink);
      }
    });
    return links;
  } catch (e: any) {
    logError(`loading main page (${mainUrl})`, e.message);
    return [];
  }
};

const getTracksFromEpisode = async (episodeUrl: string): Promise<Track[]> => {
  try {
    const html = await fetchHtml(episodeUrl);
    const $ = cheerio.load(html);

    const episodeTitle = $(SELECTORS.EPISODE_TITLE).first().text().trim();
    const date = $(SELECTORS.EPISODE_DATE).first().text().trim();
    const allTrackTexts: string[] = [];

    $(SELECTORS.EPISODE_DESCRIPTION).each((i, el) => {
      const text = $(el).text().trim();
      if (text.includes("//") && text !== date && text.length > 20) {
        allTrackTexts.push(text);
        // console.log(
        //   `📄 Found track paragraph ${allTrackTexts.length}: ${text.substring(
        //     0,
        //     60
        //   )}...`
        // );
      }
    });

    //console.log(`📚 Found ${allTrackTexts.length} paragraph(s) with tracks`);

    let combinedTrackText = allTrackTexts.join(" // ");

    combinedTrackText = combinedTrackText.replace(
      /(\b(?:Records?|sps|Label|Music|Recordings)\s+)([A-Z][A-Z\s&\/\+\-]{2,}?,)/g,
      "$1// $2"
    );

    const trackStrings = combinedTrackText
      .split("//")
      .map((t) => t.trim())
      .filter(Boolean);

    //console.log(`🎵 Found ${trackStrings.length} potential track strings`);

    const tracks = trackStrings
      .map((ts) => {
        const parsed: BaseTrack | null = parseTrackString(ts);

        if (parsed) {
          return {
            ...parsed,
            episodeTitle,
            episodeUrl,
            date,
          } as Track;
        }
        return null;
      })
      .filter((t): t is Track => t !== null);
    
      logSuccessParsing(tracks.length, episodeTitle)

    return tracks;
  } catch (e: any) {
    logError(`fetching episode data (${episodeUrl})`, e.message);
    return [];
  }
};

export { fetchHtml, getEpisodeLinks, getTracksFromEpisode };
