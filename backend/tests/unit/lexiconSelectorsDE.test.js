/**
 * German lexicon selectors (lib/lexicon/selectors/de.ts) against real kaikki entries.
 * Fixture: tests/unit/fixtures/lexicon-de.json (Wiktionary excerpts, CC BY-SA 4.0).
 * Plan: .context/plans/autocomplete-data-source-strategy.md, Slice 0 step 0b.
 */
const { selectCases, selectForm } = require('../../lib/lexicon/select');
const { NOUN_SELECTORS_DE, VERB_SELECTORS_DE, ADJECTIVE_SELECTORS_DE, ADVERB_SELECTORS_DE } = require('../../lib/lexicon/selectors/de');
const { entries } = require('./fixtures/lexicon-de.json');

const entry = (word) => entries.find((e) => e.word === word);
const verb = (word) => Object.fromEntries(selectCases(entry(word), VERB_SELECTORS_DE));
const noun = (word) => Object.fromEntries(selectCases(entry(word), NOUN_SELECTORS_DE));
const adjective = (word) => Object.fromEntries(selectCases(entry(word), ADJECTIVE_SELECTORS_DE));
const adverb = (word) => Object.fromEntries(selectCases(entry(word), ADVERB_SELECTORS_DE));

describe('German verb selectors', () => {
    test('a regular verb fills every tense and property field (no object case: "tanzen" has no valency tag)', () => {
        expect(verb('tanzen')).toEqual({
            infinitiveDE: 'tanzen',
            auxVerbDE: 'haben',
            regularityDE: 'regular',
            reflexivityDE: 'Not reflexive',
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

describe('German verb selector fixes from the Slice 0 measurement', () => {
    test('-ern verbs keep the e in first-person singular, -eln verbs drop it', () => {
        // kaikki lists "sichre, sichere, sicher" and "sammle, sammele, sammel" with equal tags.
        expect(verb('sichern').indicativePresent1sDE).toBe('sichere');
        expect(verb('sammeln').indicativePresent1sDE).toBe('sammle');
    });

    test('the longest-form rule does not reach other cells', () => {
        expect(verb('sichern').indicativePresent3sDE).toBe('sichert');
        expect(verb('sammeln').indicativeSimplePast1sDE).toBe('sammelte');
    });

    test('reflexive verbs are stored without the pronoun (decision D8)', () => {
        const cases = verb('sputen');
        expect(cases.infinitiveDE).toBe('sputen');
        expect(cases.indicativePresent1plDE).toBe('sputen');
        expect(cases.indicativePresent3sDE).toBe('sputet');
        expect(cases.indicativeSimpleFuture1sDE).toBe('sputen');
        expect(cases.indicativePerfect1sDE).toBe('gesputet');
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

describe('German reflexivity, pronoun case and object case (D31, D32)', () => {
    test('always reflexive: infinitive "sich sputen", every sense reflexive', () => {
        expect(verb('sputen')).toMatchObject({ reflexivityDE: 'Always reflexive', reflexiveCaseDE: 'Accusative' });
    });

    test('optionally reflexive: a reflexive sense next to other uses ("waschen" has it next to transitive)', () => {
        expect(verb('waschen')).toMatchObject({ reflexivityDE: 'Optionally reflexive', reflexiveCaseDE: 'Accusative' });
    });

    test('not reflexive: no reflexive tag; the pronoun case is then left out', () => {
        for (const word of ['tanzen', 'anrufen']) {
            const cases = verb(word);
            expect(cases.reflexivityDE).toBe('Not reflexive');
            expect(cases).not.toHaveProperty('reflexiveCaseDE');
        }
    });

    test('the pronoun case follows the tag `dative` on the reflexive senses: all → Dative, some → Both', () => {
        expect(verb('denken').reflexiveCaseDE).toBe('Dative');
        expect(verb('nehmen').reflexiveCaseDE).toBe('Both');
        expect(verb('vorstellen').reflexiveCaseDE).toBe('Both');
    });

    test('an infinitive with "sich" is enough, also an idiom, whatever the sense tags say', () => {
        const idiom = { word: 'sich auf den Weg machen', pos: 'verb', forms: [{ form: 'sich auf den Weg machen', tags: ['infinitive'] }], senses: [{ tags: ['transitive'] }] };
        expect(Object.fromEntries(selectCases(idiom, VERB_SELECTORS_DE))).toMatchObject({ reflexivityDE: 'Always reflexive', reflexiveCaseDE: 'Accusative' });
    });

    test('object case: the accusative comes from transitive / ditransitive / ambitransitive, nothing else is guessed', () => {
        expect(verb('geben')).toMatchObject({ caseTypeDE: 'A', reflexivityDE: 'Optionally reflexive' }); // ditransitive, with a reflexive sense
        expect(verb('waschen').caseTypeDE).toBe('A');
        expect(verb('tanzen')).not.toHaveProperty('caseTypeDE');
        expect(verb('sputen')).not.toHaveProperty('caseTypeDE');
    });
});

describe('German adjective and adverb selectors', () => {
    test('an adjective takes the degrees from the head rows, and the superlative has no "am" (D25)', () => {
        expect(adjective('gut')).toEqual({ positiveDE: 'gut', komparativDE: 'besser', superlativDE: 'besten' });
        expect(adjective('schön')).toEqual({ positiveDE: 'schön', komparativDE: 'schöner', superlativDE: 'schönsten' });
    });

    test('an adjective that cannot be compared keeps only the base word', () => {
        expect(adjective('lila')).toEqual({ positiveDE: 'lila' });
    });

    test('an adverb with a comparative is gradable', () => {
        expect(adverb('oft')).toEqual({ gradableDE: 'Gradable', adverbDE: 'oft', comparativeDE: 'öfter', superlativeDE: 'öftesten' });
    });

    test('an adverb without degrees is non-gradable', () => {
        expect(adverb('hier')).toEqual({ gradableDE: 'Non-gradable', adverbDE: 'hier' });
    });
});
