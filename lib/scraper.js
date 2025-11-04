import fetch from "node-fetch";
import * as cheerio from "cheerio";
import { parseTrackString } from "./parser.js";
import { logError } from "./logger.js";
import { BASE_URL, SELECTORS } from "./config.js";

const fetchHtml = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Status ${res.status}`);
  return res.text();
};

const getEpisodeLinks = async (mainUrl) => {
  try {
    const html = await fetchHtml(mainUrl);
    const $ = cheerio.load(html);

    const links = [];
    $(SELECTORS.EPISODE_LINK).each((_, el) => {
      const weblink = $(el).attr("weblink");
      if (weblink && weblink.startsWith("/audio/")) {
        links.push(BASE_URL + weblink);
      }
    });
    return links;
  } catch (e) {
    logError(`loading main page (${mainUrl})`, e.message);
    return [];
  }
};

const getTracksFromEpisode = async (episodeUrl) => {
  try {
    const html = await fetchHtml(episodeUrl);
    const $ = cheerio.load(html);

    const episodeTitle = $(SELECTORS.EPISODE_TITLE).first().text().trim();
    const date = $(SELECTORS.EPISODE_DATE).first().text().trim();

    let trackText = "";

    $(SELECTORS.EPISODE_DESCRIPTION).each((i, el) => {
      const text = $(el).text().trim();
      if (text.includes("//") && text !== date) {
        trackText = text;
        return false;
      }
    });

    const trackStrings = trackText
      .split("//")
      .map((t) => t.trim())
      .filter(Boolean);

    return trackStrings
      .map((ts) => {
        const parsed = parseTrackString(ts);
        return parsed ? { ...parsed, episodeTitle, episodeUrl, date } : null;
      })
      .filter(Boolean);
  } catch (e) {
    logError(`fetching episode data (${episodeUrl})`, e.message);
    return [];
  }
};

export { fetchHtml, getEpisodeLinks, getTracksFromEpisode };
