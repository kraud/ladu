/**
 * English lexicon selectors (lib/lexicon/selectors/en.ts) against real kaikki entries.
 * Fixture: tests/unit/fixtures/lexicon-en.json (Wiktionary excerpts, CC BY-SA 4.0).
 * Plan: .context/plans/autocomplete-data-source-strategy.md, Slice 0 step 0c.
 */
const { selectCases } = require('../../lib/lexicon/select');
const { NOUN_SELECTORS_EN, VERB_SELECTORS_EN } = require('../../lib/lexicon/selectors/en');
const { entries } = require('./fixtures/lexicon-en.json');

const entry = (word) => entries.find((e) => e.word === word);
const verb = (word) => Object.fromEntries(selectCases(entry(word), VERB_SELECTORS_EN));
const noun = (word) => Object.fromEntries(selectCases(entry(word), NOUN_SELECTORS_EN));

const sameIn = (cases, prefix, slots, value) => slots.forEach((slot) => expect(cases[`${prefix}${slot}EN`]).toBe(value));
const ALL_SLOTS = ['1s', '2s', '3s', '1pl', '3pl'];

describe('English verb selectors', () => {
    test('a verb with a full table', () => {
        const cases = verb('walk');
        expect(cases.regularityEN).toBe('regular');
        sameIn(cases, 'simplePresent', ['1s', '2s', '1pl', '3pl'], 'walk');
        expect(cases.simplePresent3sEN).toBe('walks');
        sameIn(cases, 'simplePast', ALL_SLOTS, 'walked');
    });

    test('a verb with head forms only falls back to the general past row and to the lemma', () => {
        const cases = verb('bake');
        expect(cases.regularityEN).toBe('regular');
        sameIn(cases, 'simplePresent', ['1s', '2s', '1pl', '3pl'], 'bake');
        expect(cases.simplePresent3sEN).toBe('bakes');
        sameIn(cases, 'simplePast', ALL_SLOTS, 'baked');
    });

    test('archaic and nonstandard rows are skipped', () => {
        const cases = verb('run');
        expect(cases.regularityEN).toBe('irregular');
        expect(cases.simplePresent2sEN).toBe('run');
        expect(cases.simplePresent3sEN).toBe('runs');
        sameIn(cases, 'simplePast', ALL_SLOTS, 'ran');
    });

    test('"be" gets its per-person forms', () => {
        const cases = verb('be');
        expect(cases.regularityEN).toBe('irregular');
        expect([cases.simplePresent1sEN, cases.simplePresent2sEN, cases.simplePresent3sEN]).toEqual(['am', 'are', 'is']);
        expect([cases.simplePresent1plEN, cases.simplePresent3plEN]).toEqual(['are', 'are']);
        expect([cases.simplePast1sEN, cases.simplePast2sEN, cases.simplePast3sEN]).toEqual(['was', 'were', 'was']);
        expect([cases.simplePast1plEN, cases.simplePast3plEN]).toEqual(['were', 'were']);
    });

    test('future and conditional store the bare verb (the form shows will/would)', () => {
        const cases = verb('run');
        sameIn(cases, 'simpleFuture', ALL_SLOTS, 'run');
        sameIn(cases, 'simpleConditional', ALL_SLOTS, 'run');
    });
});

describe('English noun selectors', () => {
    test('irregular and unchanged plurals', () => {
        expect(noun('child')).toEqual({ singularEN: 'child', pluralEN: 'children' });
        expect(noun('sheep')).toEqual({ singularEN: 'sheep', pluralEN: 'sheep' });
    });

    test('an uncountable noun has no plural', () => {
        expect(noun('news')).toEqual({ singularEN: 'news' });
    });
});
