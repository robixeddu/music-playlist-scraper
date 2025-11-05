import { parseTrackString } from '../lib/parser.js';

describe('parser.ts', () => {

    describe('parseTrackString', () => {
        
        it('should correctly parse Artist, Title, and generate key for simple track', () => {
            const result = parseTrackString('Beyoncé, BREAK MY SOUL');
            expect(result).not.toBeNull();
            expect(result!.artist).toBe('Beyoncé');
            expect(result!.title).toBe('BREAK MY SOUL');
            expect(result!.key).toBe('beyonce___break_my_soul');
            expect(result!.albumDetails).toBeUndefined();
        });

        it('should remove punctuation and normalize spaces in key', () => {
            const result = parseTrackString('Pino D’Angiò, Ma Quale Idea?');
            expect(result!.key).toBe('pino_d_angio___ma_quale_idea');
        });

        it('should handle complex artist names with special characters', () => {
            const result = parseTrackString('J Balvin & Skrillex, In Da Getto');
            expect(result!.artist).toBe('J Balvin & Skrillex');
            expect(result!.key).toBe('j_balvin__skrillex___in_da_getto');
        });

        it('should correctly extract album/label details from the end and strip them from the title', () => {
            const result1 = parseTrackString('Achille Lauro, Rolls Royce (feat. Boss Doms) (da "Rolls Royce")');
            expect(result1!.title).toBe('Rolls Royce (feat. Boss Doms)');
            expect(result1!.albumDetails).toBe('(da "Rolls Royce")');
            
            const result2 = parseTrackString('Elisa, L’anima vola (Sugar Music)');
            expect(result2!.title).toBe('L’anima vola');
            expect(result2!.albumDetails).toBe('(Sugar Music)');
            
            const result3 = parseTrackString('Lazza, Cenere, dall’album “Sirio” (Island Records)');
            expect(result3!.title).toBe('Cenere');
            expect(result3!.albumDetails).toBe('dall’album “Sirio” (Island Records)');
            expect(result3!.key).toBe('lazza___cenere');
        });

        it('should return null for invalid or too short titles', () => {
            const result = parseTrackString('Artista X, Y');
            expect(result).toBeNull();
        });
    });
});