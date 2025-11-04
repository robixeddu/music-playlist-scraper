// lib/parser.ts

// Importiamo BaseTrack (l'output di parseTrackString) e i tipi complessi per l'aggregazione.
// Dobbiamo anche importare il tipo Track completo perché è l'input di aggregateTracksByEpisode.
import { BaseTrack, EpisodeAggregated, TrackForSaving, Track } from "./types.js"; 

/**
 * Normalizza una stringa per creare una chiave di deduplicazione affidabile.
 * @param {string} str - La stringa da normalizzare.
 * @returns {string} La stringa normalizzata.
 */
const normalizeString = (str: string): string => {
    if (!str) return '';
    return str
        .toLowerCase()
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "")
        .replace(/\s{2,}/g, ' ')
        .replace(/ /g, '_')
        .trim();
};

/**
 * Effettua il parsing di una stringa grezza di brano in un oggetto BaseTrack.
 * @param {string} trackStr - La stringa grezza.
 * @returns {BaseTrack | null} L'oggetto BaseTrack tipizzato o null.
 */
const parseTrackString = (trackStr: string): BaseTrack | null => {
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
    
    const key = `${normalizeString(artist)}___${normalizeString(title)}`;

    // Restituisce BaseTrack, che non include i dati contestuali dell'episodio
    return { title, artist, albumDetails, key };
};

/**
 * Aggrega una lista piatta di brani in un array di oggetti episodio (per il salvataggio).
 * @param {Track[]} tracks - La lista piatta di tutti i brani (include dati dell'episodio).
 * @returns {EpisodeAggregated[]} L'array di episodi aggregati.
 */
const aggregateTracksByEpisode = (tracks: Track[]): EpisodeAggregated[] => {
    // Tipizziamo Map per garantire che i valori siano EpisodeAggregated
    const episodesMap = new Map<string, EpisodeAggregated>();

    tracks.forEach((track) => {
        const key = track.episodeUrl;

        if (!episodesMap.has(key)) {
            // Aggiungiamo un nuovo episodio, assicurandoci che il tipo sia corretto
            episodesMap.set(key, {
                episodeTitle: track.episodeTitle || "Unknown", // Safe check for optional fields
                episodeUrl: track.episodeUrl,
                date: track.date || "Unknown",
                tracks: [],
            });
        }

        // Recuperiamo l'episodio e pushiamo il brano formattato per il salvataggio
        // L'oggetto pushato DEVE corrispondere a TrackForSaving
        episodesMap.get(key)!.tracks.push({
            title: track.title,
            artist: track.artist,
            albumDetails: track.albumDetails || "",
            key: track.key // Utilizziamo 'key' per il campo, non 'track'
        } as TrackForSaving); // Usiamo 'as TrackForSaving' per la garanzia del tipo
    });

    return Array.from(episodesMap.values());
};

export {
    parseTrackString,
    aggregateTracksByEpisode
};