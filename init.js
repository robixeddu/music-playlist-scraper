import fs from "fs";
import fsPromises from "fs/promises";
import fetch from "node-fetch";
import dotenv from "dotenv";
import * as cheerio from "cheerio";

dotenv.config();

const TRACKS_FILE = "./tracks.json";
const EXPORT_FILE = "./new_tracks_for_tidal.txt";
const BASE_URL = "https://www.raiplaysound.it";
const BATTITI_URL = `${BASE_URL}/programmi/battiti`;
const EPISODE_SELECTOR = "rps-cta-link[weblink]";
const EPISODE_TITLE_SELECTOR = ".audio__header__title";
const EPISODE_DATE_SELECTOR = ".audio__header p.text-gray-medium";
const EPISODE_DESCRIPTION_SELECTOR = ".audio__header p";
const SKIPPED_COUNT_LIMIT = 20;

async function loadPreviousTracks() {
  try {
    if (!fs.existsSync(TRACKS_FILE)) return [];
    const data = await fsPromises.readFile(TRACKS_FILE, "utf-8");
    const aggregatedData = JSON.parse(data);

    if (Array.isArray(aggregatedData) && aggregatedData.length > 0) {
      const flatTracks = [];
      aggregatedData.forEach((episode) => {
        episode.tracks.forEach((track) => {
          flatTracks.push({
            title: track.title,
            artist: track.artist,
            episodeTitle: episode.episodeTitle,
            episodeUrl: episode.episodeUrl,
            date: episode.date,
            albumDetails: track.albumDetails || "",
          });
        });
      });
      return flatTracks;
    }

    return aggregatedData;
  } catch (e) {
    console.error("❌ Error on loading tracks.json:", e.message);
    return [];
  }
}

async function saveTracks(aggregatedTracks) {
  await fsPromises.writeFile(
    TRACKS_FILE,
    JSON.stringify(aggregatedTracks, null, 2)
  );

  console.log(
    `💾 Saved ${aggregatedTracks.length} episodes to ${TRACKS_FILE} (aggregated format)`
  );
}

async function exportNewTracks(tracks) {
  if (tracks.length === 0) {
    console.log("✅ No new tracks to export.");
    return;
  }

  const cleanedContent = tracks
    .map((t) => {
      const clean = (str) =>
        str
          .replace(/ \(([^)]+)\)/g, "")
          .replace(/ \[([^\]]+)\]/g, "")
          .trim();

      const cleanedTitle = clean(t.title);
      const cleanedArtist = clean(t.artist);

      return `${cleanedArtist} - ${cleanedTitle}`;
    })
    .join("\n");

  await fsPromises.writeFile(EXPORT_FILE, cleanedContent);
  console.log(`✅ ${tracks.length} tracks exported to ${EXPORT_FILE}.`);
}

function aggregateTracksByEpisode(tracks) {
  const episodesMap = new Map();

  tracks.forEach((track) => {
    const key = track.episodeUrl;

    if (!episodesMap.has(key)) {
      episodesMap.set(key, {
        episodeTitle: track.episodeTitle,
        episodeUrl: track.episodeUrl,
        date: track.date || "Unknown",
        tracks: [],
      });
    }

    episodesMap.get(key).tracks.push({
      title: track.title,
      artist: track.artist,
      albumDetails: track.albumDetails || "",
    });
  });

  return Array.from(episodesMap.values());
}

async function fetchHtml(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`❌ Error on loading ${url}: ${res.status}`);
  return res.text();
}

async function getEpisodeLinks(mainUrl) {
  const html = await fetchHtml(mainUrl);
  const $ = cheerio.load(html);

  const links = [];
  $(EPISODE_SELECTOR).each((_, el) => {
    const weblink = $(el).attr("weblink");
    if (weblink && weblink.startsWith("/audio/")) {
      links.push(BASE_URL + weblink);
    }
  });
  return links;
}

function parseTrackString(trackStr) {
  const [artistPart, ...rest] = trackStr.split(",");

  let rawTitle = rest.join(",");
  let albumDetails = "";

  const albumRegex = /,\s*(da\s+"?.*"?\s*–?.*)$/i;
  const match = rawTitle.match(albumRegex);

  if (match) {
    albumDetails = match[1].trim();
    rawTitle = rawTitle.replace(albumRegex, "").trim();
  }

  const title = rawTitle.trim().replace(/^["']|["']$/g, "");
  const artist = artistPart.trim();

  if (!artist || title.length < 5) {
    return null;
  }

  return { title, artist, albumDetails };
}

async function getTracksFromEpisode(episodeUrl) {
  const html = await fetchHtml(episodeUrl);
  const $ = cheerio.load(html);
  const episodeTitle = $(EPISODE_TITLE_SELECTOR).first().text().trim();
  const date = $(EPISODE_DATE_SELECTOR).first().text().trim();

  let trackText = "";

  $(EPISODE_DESCRIPTION_SELECTOR).each((i, el) => {
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
}

async function main() {
  console.log(`🎧 Start scraping ${BATTITI_URL}`);

  const previousTracks = await loadPreviousTracks();
  const episodeLinks = await getEpisodeLinks(BATTITI_URL);

  let allTracks = [...previousTracks];
  let newTracks = [];
  let scrapedCount = 0;
  let skippedCount = 0;

  const aggregatedHistory = aggregateTracksByEpisode(previousTracks);
  const knownEpisodeUrls = new Set(
    aggregatedHistory.map((ep) => ep.episodeUrl)
  );

  let isNewEpisodeFound = false;

  for (const link of episodeLinks) {
    if (knownEpisodeUrls.has(link)) {
      skippedCount++;

      // INTERRUPT LOGIC: If we've found new episodes AND we now hit old ones, break.
      if (isNewEpisodeFound || skippedCount > SKIPPED_COUNT_LIMIT) {
        console.log(
          `⏭️ Found known episode (${link}). Stopping incremental analysis.`
        );
        break;
      }

      continue;
    }

    // If the episode URL is unknown, it's new.
    isNewEpisodeFound = true;

    try {
      const episodeTracks = await getTracksFromEpisode(link);
      scrapedCount++;

      for (const track of episodeTracks) {
        const exists = allTracks.some(
          (t) =>
            t.title.trim() === track.title.trim() &&
            t.artist.trim() === track.artist.trim()
        );

        if (!exists) {
          allTracks.push(track);
          newTracks.push(track);
        }
      }
    } catch (e) {
      console.error(`❌ Error during episode processing ${link}:`, e.message);
    }
  }

  console.log(`---`);
  console.log(
    `✅ Episodes analyzed: ${scrapedCount}/${episodeLinks.length} (Skipped: ${skippedCount})`
  );
  console.log(
    `🎧 Found **${newTracks.length}** new tracks (total historical: ${allTracks.length})`
  );

  const aggregatedResults = aggregateTracksByEpisode(allTracks);
  await saveTracks(aggregatedResults);
  await exportNewTracks(newTracks);
}

main().catch((err) =>
  console.error("❌ General error in the application:", err.message || err)
);
