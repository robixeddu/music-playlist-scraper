// test/fileHandler.test.ts

import { loadPreviousTracks, saveTracks, exportNewTracks } from '../lib/fileHandler.js';
import { Track, EpisodeAggregated } from '../lib/types.js';

// --- 1. DICHIARAZIONE DEI PLACEHOLDER E MOCKING ---

// Dichiarazione dei placeholder (saranno definiti in beforeAll)
// Non li assegniamo a jest.fn() qui per evitare l'hoisting.
let mockExistsSync: jest.Mock;
let mockReadFile: jest.Mock;
let mockWriteFile: jest.Mock;
let mockMkdir: jest.Mock;
let mockDirname: jest.Mock;


// MOCK dei moduli. Questi factory ritornano solo funzioni che chiamano i placeholder.
// Questa è la chiave per prevenire il ReferenceError.
jest.mock('fs', () => ({
    existsSync: (...args: any) => mockExistsSync(...args),
}));

jest.mock('fs/promises', () => ({
    readFile: (...args: any) => mockReadFile(...args),
    writeFile: (...args: any) => mockWriteFile(...args),
    mkdir: (...args: any) => mockMkdir(...args),
}));

jest.mock('path', () => ({
    dirname: (...args: any) => mockDirname(...args),
}));


// --- 2. DATI MOCK ---
const MOCK_AGGREGATED_DATA: EpisodeAggregated[] = [
    {
        episodeTitle: "Episodio Test Aggregato",
        episodeUrl: "test_url_agg",
        date: "2025-01-01",
        tracks: [
            { title: "Song Agg 1", artist: "Artist X", albumDetails: "Album 1", key: "artist_x___song_agg_1" },
            { title: "Song Agg 2", artist: "Artist Y", albumDetails: "Album 2", key: "artist_y___song_agg_2" },
        ],
    },
];

const MOCK_FLAT_TRACKS: Track[] = [
    {
        title: "New Song C", artist: "New Artist Z", albumDetails: "New Album", key: "new_artist_z___new_song_c",
        episodeTitle: "New Ep 2", episodeUrl: "test_url_2", date: "2025-01-02",
    },
];

describe('fileHandler.ts', () => {
    
    // --- 3. INIZIALIZZAZIONE NEL CONTESTO DEI TEST (DOPO L'HOISTING) ---
    beforeAll(() => {
        // Assegniamo qui le implementazioni reali ai placeholder.
        // Questo avviene DOPO che Jest ha eseguito tutti i jest.mock().
        mockExistsSync = jest.fn();
        mockReadFile = jest.fn();
        mockWriteFile = jest.fn();
        mockMkdir = jest.fn();
        mockDirname = jest.fn(() => '/mock/data'); 
    });

    beforeEach(() => {
        // Resettiamo i mock
        jest.clearAllMocks();
    });

    // --- Test 1: loadPreviousTracks (Caricamento e Appiattimento) ---
    describe('loadPreviousTracks', () => {

        it('should return an empty array if tracks.json does not exist', async () => {
            mockExistsSync.mockReturnValue(false); // <--- Usiamo la funzione inizializzata
            
            const tracks = await loadPreviousTracks();
            
            expect(tracks).toEqual([]);
            expect(mockReadFile).not.toHaveBeenCalled();
        });

        it('should correctly load and flatten aggregated data into Track[] format', async () => {
            mockExistsSync.mockReturnValue(true);
            mockReadFile.mockResolvedValue(JSON.stringify(MOCK_AGGREGATED_DATA));

            const tracks = await loadPreviousTracks();

            expect(tracks.length).toBe(2);
            const firstTrack = tracks[0];
            expect(firstTrack.title).toBe("Song Agg 1");
            expect(firstTrack.episodeTitle).toBe("Episodio Test Aggregato");
        });
    });

    // --- Test 2: saveTracks ---
    describe('saveTracks', () => {

        it('should write the aggregated data to tracks.json in formatted JSON', async () => {
            const aggregatedData = MOCK_AGGREGATED_DATA;
            await saveTracks(aggregatedData);

            expect(mockWriteFile).toHaveBeenCalledTimes(1);
            
            const writtenContent = mockWriteFile.mock.calls[0][1];
            expect(writtenContent).toEqual(JSON.stringify(aggregatedData, null, 2));
        });
    });

    // --- Test 3: exportNewTracks ---
    describe('exportNewTracks', () => {

        it('should export cleaned tracks in "Artist - Title" format, removing parenthetical noise', async () => {
            const tracksToExport: Track[] = [
                {
                    ...MOCK_FLAT_TRACKS[0],
                    title: "Cool Song (feat. Feat Artist) [Radio Edit]",
                    artist: "The Band [feat. Someone Else]",
                },
            ];

            await exportNewTracks(tracksToExport);

            expect(mockWriteFile).toHaveBeenCalledTimes(1);
            
            const writtenContent = mockWriteFile.mock.calls[0][1];
            expect(writtenContent).toBe("The Band - Cool Song");
        });

        it('should not write the file if the tracks array is empty', async () => {
            await exportNewTracks([]);
            
            expect(mockWriteFile).not.toHaveBeenCalled();
        });
    });
});