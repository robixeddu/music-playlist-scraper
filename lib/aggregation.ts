// lib/aggregation.ts

import { aggregateTracksByEpisode } from "./parser.js";
import { Track } from "./types.js"; // Importiamo il tipo Track per l'input/output

/**
 * Unisce i nuovi brani nella lista esistente, controllando i duplicati tramite la chiave normalizzata.
 * @param {Track[]} allTracks - L'array completo di brani storici.
 * @param {Track[]} episodeTracks - I brani trovati nell'episodio corrente.
 * @param {Track[]} newTracks - L'array in cui inserire i brani veramente nuovi.
 * @returns {Track[]} L'array aggiornato di tutti i brani.
 */
const updateAllTracks = (
    allTracks: Track[], 
    episodeTracks: Track[], 
    newTracks: Track[]
): Track[] => {
    
    let updatedAllTracks: Track[] = [...allTracks]; // Tipizziamo l'array

    // Il Set memorizza solo le chiavi (stringhe)
    const knownKeys = new Set(allTracks.map(t => t.key));

    for (const track of episodeTracks) {
        // TypeScript è felice perché usiamo `track.key` e sa che `track` è di tipo Track.
        if (!track || !track.key) continue; 
        
        if (!knownKeys.has(track.key)) {
            updatedAllTracks.push(track);
            newTracks.push(track); // L'array newTracks è passato per riferimento, quindi viene modificato
            knownKeys.add(track.key);
        }
    }
    
    return updatedAllTracks;
};

/**
 * Ottiene le URL degli episodi noti dai dati storici per una ricerca veloce.
 * @param {Track[]} previousTracks - L'array piatto dei brani storici.
 * @returns {Set<string>} Un Set contenente tutte le URL degli episodi noti.
 */
const getKnownEpisodeUrls = (previousTracks: Track[]): Set<string> => {
    // La tipizzazione qui è implicita (aggregateTracksByEpisode restituisce EpisodeAggregated[])
    const aggregatedHistory = aggregateTracksByEpisode(previousTracks);
    return new Set(aggregatedHistory.map((ep) => ep.episodeUrl));
};

export {
    updateAllTracks,
    getKnownEpisodeUrls
};