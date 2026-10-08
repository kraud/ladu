/**
 * German lexicon selectors (lib/lexicon/selectors/de.ts) against real kaikki entries.
 * Fixture: tests/unit/fixtures/lexicon-de.json (Wiktionary excerpts, CC BY-SA 4.0).
 * Plan: .context/plans/autocomplete-data-source-strategy.md, Slice 0 step 0b.
 */
const { selectCases, selectForm } = require('../../lib/lexicon/select');
const { NOUN_SELECTORS_DE, VERB_SELECTORS_DE } = require('../../lib/lexicon/selectors/de');
const { entries } = require('./fixtures/lexicon-de.json');

const entry = (word) => entries.find((e) => e.word === word);
const verb = (word) => Object.fromEntries(selectCases(entry(word), VERB_SELECTORS_DE));
const noun = (word) => Object.fromEntries(selectCases(entry(word), NOUN_SELECTORS_DE));

describe('German verb selectors', () => {
    test('a regular verb fills every tense and property field except caseTypeDE', () => {
        expect(verb('tanzen')).toEqual({
            infinitiveDE: 'tanzen',
            auxVerbDE: 'haben',
            regularityDE: 'regular',
            indicativePresent1sDE: 'tanze',
            indicativePresent2sDE: 'tanzt',
            indicativePresent3sDE: 'tanzt',
            indicativePresent1plDE: 'tanzen',
            indicativePresent2plDE: 'tanzt',
            indicativePresent3plDE: 'tanzen',
            indicativePerfect1sDE: 'getanzt',
            indicativePerfect2sDE: 'getanzt',
            indicativePerfect3sDE: 'getanzt',
            indicativePerfect1plDE: 'getanzt',
            indicativePerfect2plDE: 'getanzt',
            indicativePerfect3plDE: 'getanzt',
            indicativeSimpleFuture1sDE: 'tanzen',
            indicativeSimpleFuture2sDE: 'tanzen',
            indicativeSimpleFuture3sDE: 'tanzen',
            indicativeSimpleFuture1plDE: 'tanzen',
            indicativeSimpleFuture2plDE: 'tanzen',
            indicativeSimpleFuture3plDE: 'tanzen',
            indicativeSimplePast1sDE: 'tanzte',
            indicativeSimplePast2sDE: 'tanztest',
            indicativeSimplePast3sDE: 'tanzte',
            indicativeSimplePast1plDE: 'tanzten',
            indicativeSimplePast2plDE: 'tanztet',
            indicativeSimplePast3plDE: 'tanzten',
        });
    });

    test('a strong verb with "sein" gets the right auxiliary and regularity', () => {
        const cases = verb('gehen');
        expect(cases.auxVerbDE).toBe('sein');
        expect(cases.regularityDE).toBe('irregular');
        expect(cases.indicativePerfect3sDE).toBe('gegangen');
        expect(cases.indicativeSimplePast2sDE).toBe('gingst');
        expect(cases.prefixDE).toBeUndefined();
    });

    test('a separable verb stores the joined form and its prefix', () => {
        const cases = verb('anrufen');
        expect(cases.prefixDE).toBe('an');
        expect(cases.indicativePresent3sDE).toBe('anruft');
        expect(cases.indicativeSimplePast1sDE).toBe('anrief');
        expect(cases.indicativePerfect1sDE).toBe('angerufen');
        expect(cases.indicativeSimpleFuture1sDE).toBe('anrufen');
    });
});

describe('German noun selectors', () => {
    test('a strong neuter noun fills gender and all eight forms, standard forms first', () => {
        expect(noun('Haus')).toEqual({
            genderDE: 'das',
            singularNominativDE: 'Haus',
            pluralNominativDE: 'Häuser',
            singularAkkusativDE: 'Haus',
            pluralAkkusativDE: 'Häuser',
            singularGenitivDE: 'Hauses',
            pluralGenitivDE: 'Häuser',
            singularDativDE: 'Haus',
            pluralDativDE: 'Häusern',
        });
    });

    test('colloquial plurals are skipped', () => {
        const cases = noun('Junge');
        expect(cases.genderDE).toBe('der');
        expect(cases.pluralNominativDE).toBe('Jungen');
        expect(cases.singularGenitivDE).toBe('Jungen');
    });
});

describe('selectForm', () => {
    const sample = {
        word: 'x',
        pos: 'verb',
        forms: [
            { form: '-', tags: ['a'] },
            { form: 'old', tags: ['a', 'archaic'] },
            { form: 'first', tags: ['a'] },
            { form: 'second', tags: ['a', 'b'] },
            { form: 'aux main', tags: ['c'] },
        ],
    };

    test('skips placeholder and excluded rows, and takes the first match', () => {
        expect(selectForm(sample, { kind: 'form', caseName: 't', tags: ['a'] })).toBe('first');
    });

    test('preferTags picks a later row', () => {
        expect(selectForm(sample, { kind: 'form', caseName: 't', tags: ['a'], preferTags: ['b'] })).toBe('second');
    });

    test('dropLeadingWords removes the auxiliary', () => {
        expect(selectForm(sample, { kind: 'form', caseName: 't', tags: ['c'], dropLeadingWords: 1 })).toBe('main');
    });

    test('fallbackToLemma applies only when no row matches', () => {
        expect(selectForm(sample, { kind: 'form', caseName: 't', tags: ['z'] })).toBeUndefined();
        expect(selectForm(sample, { kind: 'form', caseName: 't', tags: ['z'], fallbackToLemma: true })).toBe('x');
    });
});
