import { describe, expect, it } from 'vitest';
import { addPair, coversEveryPair, keepPairsWithin } from './masteredPairs';

const THREE = ['English', 'Spanish', 'German'];

describe('addPair', () => {
    it('sorts the two languages inside the pair', () => {
        expect(addPair([], 'Spanish', 'English')).toEqual([['English', 'Spanish']]);
    });

    it('does not add the same pair twice, whatever the order', () => {
        const once = addPair([], 'English', 'Spanish');
        expect(addPair(once, 'Spanish', 'English')).toEqual([['English', 'Spanish']]);
    });

    it('keeps the pairs that exist', () => {
        const once = addPair([], 'English', 'Spanish');
        expect(addPair(once, 'German', 'English')).toEqual([
            ['English', 'Spanish'],
            ['English', 'German'],
        ]);
    });
});

describe('keepPairsWithin', () => {
    it('drops a pair when one of its languages is not selected', () => {
        const pairs = [['English', 'Spanish'], ['German', 'French']];
        expect(keepPairsWithin(pairs, ['English', 'German', 'French'])).toEqual([['German', 'French']]);
    });
});

describe('coversEveryPair', () => {
    it('is true when the only pair of 2 languages is mastered', () => {
        expect(coversEveryPair([['English', 'Spanish']], ['English', 'Spanish'])).toBe(true);
    });

    it('is false when one pair of 3 languages is mastered', () => {
        expect(coversEveryPair([['English', 'Spanish']], THREE)).toBe(false);
    });

    it('is true when all 3 pairs of 3 languages are mastered', () => {
        const all = [['English', 'Spanish'], ['English', 'German'], ['Spanish', 'German']];
        expect(coversEveryPair(all, THREE)).toBe(true);
    });

    it('counts a pair once, whatever the order of its languages', () => {
        const repeated = [['English', 'Spanish'], ['Spanish', 'English'], ['English', 'German']];
        expect(coversEveryPair(repeated, THREE)).toBe(false);
    });

    it('ignores a pair that uses a language that is not selected', () => {
        expect(coversEveryPair([['English', 'French']], ['English', 'Spanish'])).toBe(false);
    });

    it('is false when fewer than 2 languages are selected, because no pair exists', () => {
        expect(coversEveryPair([], [])).toBe(false);
        expect(coversEveryPair([], ['English'])).toBe(false);
    });
});
