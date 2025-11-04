// lib/scraper.ts
import fetch from "node-fetch";
import * as cheerio from "cheerio";
import { parseTrackString } from "./parser.js";
import { logError } from "./logger.js";
import { BASE_URL, SELECTORS } from "./config.js";
// Importa entrambi i tipi, BaseTrack per l'input e Track per l'output finale
import { Track, BaseTrack } from "./types.js"; 

// Tipizza l'URL in input e la Promise<string> in output
const fetchHtml = async (url: string): Promise<string> => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Status ${res.status}`);
    return res.text();
};

// Tipizza l'URL in input e la Promise<string[]> in output
const getEpisodeLinks = async (mainUrl: string): Promise<string[]> => {
    try {
        const html = await fetchHtml(mainUrl);
        const $ = cheerio.load(html);

        const links: string[] = []; // Tipizza l'array links
        $(SELECTORS.EPISODE_LINK).each((_, el) => {
            const weblink = $(el).attr("weblink");
            if (weblink && weblink.startsWith("/audio/")) {
                links.push(BASE_URL + weblink);
            }
        });
        return links;
    } catch (e: any) { // Tipizza l'errore se necessario
        logError(`loading main page (${mainUrl})`, e.message);
        return [];
    }
};

// Tipizza l'URL in input e la Promise<Track[]> in output
const getTracksFromEpisode = async (episodeUrl: string): Promise<Track[]> => {
    try {
        const html = await fetchHtml(episodeUrl);
        const $ = cheerio.load(html);

        const episodeTitle = $(SELECTORS.EPISODE_TITLE).first().text().trim();
        const date = $(SELECTORS.EPISODE_DATE).first().text().trim();

        let trackText = "";

        // *** CORREZIONE FLUSSO DI CODICE ***
        // Non si può restituire un array Track[] dentro .each(). 
        // Il return all'interno del .each() serve solo a interrompere l'iterazione (false).
        $(SELECTORS.EPISODE_DESCRIPTION).each((i, el) => {
            const text = $(el).text().trim();
            if (text.includes("//") && text !== date) {
                trackText = text;
                return false; // Interrompe l'iterazione di jQuery/Cheerio
            }
        });
        // **********************************

        const trackStrings = trackText
            .split("//")
            .map((t) => t.trim())
            .filter(Boolean);

        return trackStrings
            .map((ts) => {
                // parseTrackString restituisce BaseTrack | null
                const parsed: BaseTrack | null = parseTrackString(ts); 
                
                // Se parsed non è null, lo uniamo ai dati contestuali per formare un oggetto Track
                if (parsed) {
                    return {
                        ...parsed,
                        episodeTitle,
                        episodeUrl,
                        date,
                    } as Track; // Assicuriamo a TypeScript che è un Track completo
                }
                return null;
            })
            .filter((t): t is Track => t !== null); // Filtra i null e garantisce che l'array finale sia Track[]
    } catch (e: any) {
        logError(`fetching episode data (${episodeUrl})`, e.message);
        return [];
    }
};

export { fetchHtml, getEpisodeLinks, getTracksFromEpisode };