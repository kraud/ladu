/**
 * Merging the preposition and postposition rows of one word (lib/lexicon/adpositions.ts):
 * Wiktionary lists German "nach" twice, once as a preposition and once as a postposition. The
 * lexicon keeps ONE row, "Before or after the noun", with the cases of both entries.
 */
const { mergeAdpositionRows } = require('../../lib/lexicon/adpositions');

const row = (lemma, forms, extra = {}) => ({ partOfSpeech: 'Preposition', lemma, frequencyRank: null, entryOrder: 0, forms, ...extra });

describe('mergeAdpositionRows', () => {
    test('a preposition row and a postposition row of one word become one row with both positions', () => {
        const merged = mergeAdpositionRows([
            row('zufolge', { prepositionDE: 'zufolge', positionDE: 'Before the noun', governedCaseDE: 'G' }, { frequencyRank: 900 }),
            row('zufolge', { prepositionDE: 'zufolge', positionDE: 'After the noun', governedCaseDE: 'D' }),
        ]);
        expect(merged).toEqual([
            row('zufolge', { prepositionDE: 'zufolge', positionDE: 'Before or after the noun', governedCaseDE: 'DG' }, { frequencyRank: 900 }),
        ]);
    });

    test('the cases are the union, in the order A, D, G, each letter once', () => {
        const [merged] = mergeAdpositionRows([
            row('nach', { prepositionDE: 'nach', positionDE: 'Before the noun', governedCaseDE: 'D' }),
            row('nach', { prepositionDE: 'nach', positionDE: 'After the noun', governedCaseDE: 'D' }),
        ]);
        expect(merged.forms.governedCaseDE).toBe('D');
    });

    test('a word with one position, other words and other parts of speech stay as they are', () => {
        const rows = [
            row('in', { prepositionDE: 'in', positionDE: 'Before the noun' }),
            row('entgegen', { prepositionDE: 'entgegen', positionDE: 'After the noun' }),
            { partOfSpeech: 'Adverb', lemma: 'in', frequencyRank: null, entryOrder: 0, forms: { adverbDE: 'in' } },
        ];
        expect(mergeAdpositionRows(rows)).toEqual(rows);
    });

    test('homograph rows of one position stay separate and keep their order numbers', () => {
        const rows = [
            row('an', { prepositionDE: 'an', positionDE: 'Before the noun', governedCaseDE: 'AD' }, { entryOrder: 0 }),
            row('an', { prepositionDE: 'an', positionDE: 'Before the noun' }, { entryOrder: 1 }),
        ];
        expect(mergeAdpositionRows(rows)).toEqual(rows);
    });

    test('a word with both positions becomes one row with order number 0, even when it had several rows', () => {
        const merged = mergeAdpositionRows([
            row('an', { prepositionDE: 'an', positionDE: 'Before the noun', governedCaseDE: 'AD' }, { entryOrder: 0 }),
            row('an', { prepositionDE: 'an', positionDE: 'After the noun' }, { entryOrder: 1 }),
            row('an', { prepositionDE: 'an', positionDE: 'Before the noun' }, { entryOrder: 2 }),
        ]);
        expect(merged).toHaveLength(1);
        expect(merged[0].entryOrder).toBe(0);
        expect(merged[0].forms).toEqual({ prepositionDE: 'an', positionDE: 'Before or after the noun', governedCaseDE: 'AD' });
    });

    test('works for every language: the case names carry the language code', () => {
        const [merged] = mergeAdpositionRows([
            row('ago', { prepositionEN: 'ago', positionEN: 'After the noun' }),
            row('ago', { prepositionEN: 'ago', positionEN: 'Before the noun' }),
        ]);
        expect(merged.forms.positionEN).toBe('Before or after the noun');
    });
});
