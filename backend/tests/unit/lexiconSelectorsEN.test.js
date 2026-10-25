/**
 * English lexicon selectors (lib/lexicon/selectors/en.ts) against real kaikki entries.
 * Fixture: tests/unit/fixtures/lexicon-en.json (Wiktionary excerpts, CC BY-SA 4.0).
 * Plan: .context/plans/autocomplete-data-source-strategy.md, Slice 0 step 0c.
 */
const { selectCases } = require('../../lib/lexicon/select');
const { NOUN_SELECTORS_EN, VERB_SELECTORS_EN, ADJECTIVE_SELECTORS_EN, ADVERB_SELECTORS_EN, CONJUNCTION_SELECTORS_EN, PREPOSITION_SELECTORS_EN } = require('../../lib/lexicon/selectors/en');
const { entries } = require('./fixtures/lexicon-en.json');

const entry = (word) => entries.find((e) => e.word === word);
const verb = (word) => Object.fromEntries(selectCases(entry(word), VERB_SELECTORS_EN));
const noun = (word) => Object.fromEntries(selectCases(entry(word), NOUN_SELECTORS_EN));
const adjective = (word) => Object.fromEntries(selectCases(entry(word), ADJECTIVE_SELECTORS_EN));
const adverb = (word) => Object.fromEntries(selectCases(entry(word), ADVERB_SELECTORS_EN));

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

describe('English adjective and adverb selectors', () => {
    test('a short adjective takes -er and -est', () => {
        expect(adjective('big')).toEqual({ positiveEN: 'big', comparativeEN: 'bigger', superlativeEN: 'biggest' });
        expect(adjective('happy')).toEqual({ positiveEN: 'happy', comparativeEN: 'happier', superlativeEN: 'happiest' });
    });

    test('a long adjective takes "more" and "most", also when -er is listed first', () => {
        expect(adjective('beautiful')).toEqual({ positiveEN: 'beautiful', comparativeEN: 'more beautiful', superlativeEN: 'most beautiful' });
        expect(adjective('unique').comparativeEN).toBe('more unique');
    });

    test('an adverb in -ly takes "more", another adverb takes -er', () => {
        // "more quickly / most quickly" is derived by the form's "Uses more / most" box, so only the box is sent.
        expect(adverb('quickly')).toEqual({ gradableEN: 'Gradable', adverbEN: 'quickly', periphrasticEN: 'true' });
        expect(adverb('fast')).toEqual({ gradableEN: 'Gradable', adverbEN: 'fast', comparativeEN: 'faster', superlativeEN: 'fastest' });
    });

    test('a "more" comparative with a one-word superlative keeps the typed text and leaves the box off', () => {
        const mixed = { word: 'early', pos: 'adv', forms: [{ form: 'more early', tags: ['comparative'] }, { form: 'earliest', tags: ['superlative'] }] };
        expect(Object.fromEntries(selectCases(mixed, ADVERB_SELECTORS_EN))).toEqual({
            gradableEN: 'Gradable', adverbEN: 'early', comparativeEN: 'more early', superlativeEN: 'earliest',
        });
    });

    test('the "more / most" check ignores case and spacing, but needs the adverb itself after the prefix', () => {
        const spaced = { word: 'slowly', pos: 'adv', forms: [{ form: 'More  slowly', tags: ['comparative'] }, { form: 'most slowly', tags: ['superlative'] }] };
        expect(Object.fromEntries(selectCases(spaced, ADVERB_SELECTORS_EN))).toMatchObject({ periphrasticEN: 'true' });
        const other = { word: 'well', pos: 'adv', forms: [{ form: 'more wellness', tags: ['comparative'] }, { form: 'most well', tags: ['superlative'] }] };
        expect(Object.fromEntries(selectCases(other, ADVERB_SELECTORS_EN)).periphrasticEN).toBeUndefined();
    });

    test('an adverb with no degree form gets no radio value: the lexicon does not prove it is non-gradable', () => {
        expect(Object.fromEntries(selectCases({ word: 'sometimes', pos: 'adv', forms: [] }, ADVERB_SELECTORS_EN))).toEqual({ adverbEN: 'sometimes' });
    });
});

describe('English conjunction and preposition selectors', () => {
    const find = (word, pos) => entries.find((e) => e.word === word && e.pos === pos);
    const conjunction = (word) => Object.fromEntries(selectCases(find(word, 'conj'), CONJUNCTION_SELECTORS_EN));
    const preposition = (word, pos = 'prep') => Object.fromEntries(selectCases(find(word, pos), PREPOSITION_SELECTORS_EN));

    test('a conjunction Wiktionary marks as subordinating gets the type', () => {
        expect(conjunction('because')).toEqual({ conjunctionEN: 'because', conjunctionTypeEN: 'Subordinating' });
        expect(conjunction('although')).toEqual({ conjunctionEN: 'although', conjunctionTypeEN: 'Subordinating' });
    });

    test('"neither … nor" (an ellipsis headword) fills the first part, the box and the second part, but no type', () => {
        expect(conjunction('neither … nor')).toEqual({ conjunctionEN: 'neither', correlativeEN: 'true', secondPartEN: 'nor' });
    });

    test('a preposition gets the word and "Before the noun"; an English postposition ("ago") gets "After the noun"', () => {
        expect(preposition('in')).toEqual({ prepositionEN: 'in', positionEN: 'Before the noun' });
        expect(preposition('ago', 'postp')).toEqual({ prepositionEN: 'ago', positionEN: 'After the noun' });
    });
});
