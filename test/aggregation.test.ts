import { updateAllTracks, getKnownEpisodeUrls } from '../lib/aggregation.js';
import { Track } from '../lib/types.js';

const createMockTrack = (
    title: string,
    artist: string,
    episodeUrl: string
): Track => {
    const key = `${artist.toLowerCase().replace(/ /g, '_')}___${title.toLowerCase().replace(/ /g, '_')}`;
    
    return {
        title: title,
        artist: artist,
        albumDetails: 'Mock Album',
        key: key,
        episodeTitle: 'Mock Episode',
        episodeUrl: episodeUrl,
        date: '2025-01-01',
    };
};

describe('aggregation.ts', () => {

    describe('getKnownEpisodeUrls', () => {
        it('should return a Set of unique episode URLs', () => {
            const tracks: Track[] = [
                createMockTrack('Song A', 'Artist 1', 'url_1'),
                createMockTrack('Song B', 'Artist 2', 'url_1'),
                createMockTrack('Song C', 'Artist 3', 'url_2'),
            ];
            
            const result = getKnownEpisodeUrls(tracks);
            
            expect(result.size).toBe(2);
            expect(result.has('url_1')).toBe(true);
            expect(result.has('url_2')).toBe(true);
            expect(result.has('url_3')).toBe(false);
        });
    });

    describe('updateAllTracks', () => {
        
        let allTracks: Track[];
        let newTracks: Track[];

        beforeEach(() => {
            allTracks = [
                createMockTrack('Old Song 1', 'Old Artist', 'url_old_1'),
            ];
            newTracks = [];
        });

        it('should correctly add a completely new track to both archives', () => {
            const freshTrack = createMockTrack('New Track', 'Fresh Artist', 'url_new_1');
            const newEpisodeTracks: Track[] = [freshTrack];

            const updatedAllTracks = updateAllTracks(allTracks, newEpisodeTracks, newTracks);

            expect(updatedAllTracks.length).toBe(2);
            expect(updatedAllTracks.map(t => t.key)).toContain(freshTrack.key);

            expect(newTracks.length).toBe(1);
            expect(newTracks[0].key).toBe(freshTrack.key);
        });

        it('should skip a duplicate track (same key) and not modify newTracks', () => {
            const duplicateTrack = createMockTrack('Old Song 1', 'Old Artist', 'url_old_2');
            const newEpisodeTracks: Track[] = [duplicateTrack];

            const updatedAllTracks = updateAllTracks(allTracks, newEpisodeTracks, newTracks);

            expect(updatedAllTracks.length).toBe(1);
            
            expect(newTracks.length).toBe(0);
        });

        it('should handle a mix of new and duplicate tracks', () => {
            const newTrack1 = createMockTrack('Hit Song', 'Pop Star', 'url_new_2');
            const duplicateTrack = createMockTrack('Old Song 1', 'Old Artist', 'url_old_3');
            const newTrack2 = createMockTrack('Cool Tune', 'Indie Band', 'url_new_4');

            const newEpisodeTracks: Track[] = [newTrack1, duplicateTrack, newTrack2];

            const updatedAllTracks = updateAllTracks(allTracks, newEpisodeTracks, newTracks);

            expect(updatedAllTracks.length).toBe(3);

            expect(newTracks.length).toBe(2);
            expect(newTracks.map(t => t.key)).toContain(newTrack1.key);
            expect(newTracks.map(t => t.key)).toContain(newTrack2.key);
            expect(newTracks.map(t => t.key)).not.toContain(duplicateTrack.key);
        });
    });
});