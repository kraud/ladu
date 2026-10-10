/**
 * English Wiktionary translations → lexeme_translations rows (lib/lexicon/translations.ts).
 * Plan: .context/plans/autocomplete-data-source-strategy.md, Slice F (decision D22).
 */
const { translationGender, translationRows } = require('../../lib/lexicon/translations');

describe('translationGender', () => {
    it('German: one gender → der / die / das; two → null (the form has no "der/das")', () => {
        expect(translationGender('German', ['masculine'])).toBe('der');
        expect(translationGender('German', ['feminine', 'plural'])).toBe('die');
        expect(translationGender('German', ['neuter'])).toBe('das');
        expect(translationGender('German', ['masculine', 'neuter'])).toBeNull();
        expect(translationGender('German', ['plural'])).toBeNull();
    });

    it('Spanish: el / la, both → "el/la"; neuter → null', () => {
        expect(translationGender('Spanish', ['masculine'])).toBe('el');
        expect(translationGender('Spanish', ['feminine'])).toBe('la');
        expect(translationGender('Spanish', ['feminine', 'masculine'])).toBe('el/la');
        expect(translationGender('Spanish', ['neuter'])).toBeNull();
    });

    it('Estonian has no gender', () => {
        expect(translationGender('Estonian', ['masculine'])).toBeNull();
    });
});

describe('translationRows', () => {
    const lake = {
        word: 'lake',
        pos: 'noun',
        translations: [
            { lang: 'et', word: 'järv', sense: 'body of water' },
            { lang: 'de', word: 'See', tags: ['masculine'], sense: 'body of water' },
            { lang: 'fr', word: 'lac', tags: ['masculine'], sense: 'body of water' },
            { lang: 'es', word: 'lago', tags: ['masculine'], sense: 'body of water' },
            { lang: 'es', word: 'lago', tags: ['masculine'], sense: 'body of water' },
            { lang: 'de', word: 'Lack', tags: ['masculine'], sense: 'a coloring agent' },
            { lang: 'es', sense: 'a coloring agent' },
        ],
    };

    it('one row per target word: only es / de / et, duplicates once, senses numbered in order', () => {
        const rows = translationRows(lake, 2);
        expect(rows.map((r) => [r.senseOrder, r.language, r.word, r.gender])).toEqual([
            [0, 'Estonian', 'järv', null],
            [0, 'German', 'See', 'der'],
            [0, 'Spanish', 'lago', 'el'],
            [1, 'German', 'Lack', 'der'],
        ]);
        expect(rows[1]).toEqual({
            englishLemma: 'lake', partOfSpeech: 'Noun', entryOrder: 2, sense: 'body of water', senseOrder: 0,
            language: 'German', word: 'See', wordOrder: 0, gender: 'der', tags: ['masculine'],
        });
    });

    it('numbers the words per sense and language, in source order', () => {
        const rows = translationRows({ word: 'run', pos: 'verb', translations: [
            { lang: 'de', word: 'rennen', sense: 'move fast' },
            { lang: 'es', word: 'correr', sense: 'move fast' },
            { lang: 'de', word: 'laufen', sense: 'move fast' },
            { lang: 'de', word: 'laufen', sense: 'flow' },
        ] }, 0);
        expect(rows.map((r) => [r.sense, r.word, r.wordOrder])).toEqual([
            ['move fast', 'rennen', 0], ['move fast', 'correr', 0], ['move fast', 'laufen', 1], ['flow', 'laufen', 0],
        ]);
    });

    it('a sense label used only by a skipped language still takes its number', () => {
        const rows = translationRows({ word: 'x', pos: 'noun', translations: [
            { lang: 'fr', word: 'y', sense: 'first' },
            { lang: 'de', word: 'Z', tags: ['neuter'], sense: 'second' },
        ] }, 0);
        expect(rows.map((r) => [r.sense, r.senseOrder])).toEqual([['second', 1]]);
    });

    it('gender only for nouns: a verb keeps its tags but has no gender', () => {
        const [row] = translationRows({ word: 'run', pos: 'verb', translations: [{ lang: 'es', word: 'correr', tags: ['masculine'], sense: 'move' }] }, 0);
        expect(row).toMatchObject({ partOfSpeech: 'Verb', gender: null, tags: ['masculine'] });
    });

    it('adjectives and adverbs are kept; other parts of speech and entries without translations give nothing', () => {
        expect(translationRows({ word: 'big', pos: 'adj', translations: [{ lang: 'de', word: 'groß', sense: '' }] }, 0)).toHaveLength(1);
        expect(translationRows({ word: 'quickly', pos: 'adv', translations: [{ lang: 'de', word: 'schnell', sense: '' }] }, 0)).toHaveLength(1);
        expect(translationRows({ word: 'Paris', pos: 'name', translations: [{ lang: 'de', word: 'Paris', sense: '' }] }, 0)).toEqual([]);
        expect(translationRows({ word: 'lake', pos: 'noun' }, 0)).toEqual([]);
    });
});
