/**
 * Spanish lexicon selectors (lib/lexicon/selectors/es.ts) against real kaikki entries.
 * Fixture: tests/unit/fixtures/lexicon-es.json (Wiktionary excerpts, CC BY-SA 4.0).
 * Plan: .context/plans/autocomplete-data-source-strategy.md, Slice 0 step 0c.
 */
const { selectCases } = require('../../lib/lexicon/select');
const { NOUN_SELECTORS_ES, VERB_SELECTORS_ES, ADJECTIVE_SELECTORS_ES, ADVERB_SELECTORS_ES } = require('../../lib/lexicon/selectors/es');
const { entries } = require('./fixtures/lexicon-es.json');

const entry = (word) => entries.find((e) => e.word === word);
const verb = (word) => Object.fromEntries(selectCases(entry(word), VERB_SELECTORS_ES));
const noun = (word) => Object.fromEntries(selectCases(entry(word), NOUN_SELECTORS_ES));
const adjective = (word) => Object.fromEntries(selectCases(entry(word), ADJECTIVE_SELECTORS_ES));
const adverb = (word) => Object.fromEntries(selectCases(entry(word), ADVERB_SELECTORS_ES));

describe('Spanish verb selectors', () => {
    test('a regular verb fills every field of the v2 form, plus conditional and imperative', () => {
        expect(verb('bailar')).toEqual({
            regularityES: 'regular',
            reflexivityES: 'Not reflexive',
            infinitiveNonFiniteSimpleES: 'bailar',
            gerundNonFiniteSimpleES: 'bailando',
            participleNonFiniteSimpleES: 'bailado',
            indicativePresent1sES: 'bailo',
            indicativePresent2sES: 'bailas',
            indicativePresent3sES: 'baila',
            indicativePresent1plES: 'bailamos',
            indicativePresent2plES: 'bailan',
            indicativePresent3plES: 'bailan',
            indicativeImperfectPast1sES: 'bailaba',
            indicativeImperfectPast2sES: 'bailabas',
            indicativeImperfectPast3sES: 'bailaba',
            indicativeImperfectPast1plES: 'bailábamos',
            indicativeImperfectPast2plES: 'bailaban',
            indicativeImperfectPast3plES: 'bailaban',
            indicativePerfectSimplePast1sES: 'bailé',
            indicativePerfectSimplePast2sES: 'bailaste',
            indicativePerfectSimplePast3sES: 'bailó',
            indicativePerfectSimplePast1plES: 'bailamos',
            indicativePerfectSimplePast2plES: 'bailaron',
            indicativePerfectSimplePast3plES: 'bailaron',
            indicativeFuture1sES: 'bailaré',
            indicativeFuture2sES: 'bailarás',
            indicativeFuture3sES: 'bailará',
            indicativeFuture1plES: 'bailaremos',
            indicativeFuture2plES: 'bailarán',
            indicativeFuture3plES: 'bailarán',
            indicativeConditional1sES: 'bailaría',
            indicativeConditional2sES: 'bailarías',
            indicativeConditional3sES: 'bailaría',
            indicativeConditional1plES: 'bailaríamos',
            indicativeConditional2plES: 'bailarían',
            indicativeConditional3plES: 'bailarían',
            imperative2sES: 'baila',
            imperative3sES: 'baile',
            imperative1plES: 'bailemos',
            imperative2plES: 'bailen',
            imperative3plES: 'bailen',
        });
    });

    test('irregular verbs are marked irregular and keep their irregular forms', () => {
        const ir = verb('ir');
        expect(ir.regularityES).toBe('irregular');
        expect(ir.gerundNonFiniteSimpleES).toBe('yendo');
        expect(ir.indicativePresent1sES).toBe('voy');
        expect(ir.indicativePerfectSimplePast1sES).toBe('fui');
        expect(ir.imperative2sES).toBe('ve');

        const tener = verb('tener');
        expect(tener.regularityES).toBe('irregular');
        expect(tener.indicativeFuture1sES).toBe('tendré');
        expect(tener.imperative2sES).toBe('ten');
    });

    test('reflexive verbs are stored without the pronoun (decision D8)', () => {
        const cases = verb('personarse');
        expect(cases.infinitiveNonFiniteSimpleES).toBe('personarse');
        expect(cases.indicativePresent1plES).toBe('personamos');
        expect(cases.indicativeImperfectPast3sES).toBe('personaba');
        expect(cases.indicativePerfectSimplePast1sES).toBe('personé');
    });

    test('regularity: stem changes and -zc are irregular, spelling- and accent-only changes are regular (D16)', () => {
        expect(verb('sentir').regularityES).toBe('irregular'); // e-ie-i: siento
        expect(verb('conocer').regularityES).toBe('irregular'); // c-zc: conozco
        expect(verb('buscar').regularityES).toBe('regular'); // c-qu: busqué
        expect(verb('enviar').regularityES).toBe('regular'); // i-í: envío
        expect(verb('bailar').regularityES).toBe('regular');
    });

    test('2nd person plural is ustedes, the 3rd-person plural form, in every tense (decision D10)', () => {
        for (const word of ['bailar', 'tener', 'ir']) {
            const cases = verb(word);
            for (const prefix of ['indicativePresent', 'indicativeImperfectPast', 'indicativePerfectSimplePast', 'indicativeFuture', 'indicativeConditional', 'imperative']) {
                expect(cases[`${prefix}2plES`]).toBe(cases[`${prefix}3plES`]);
            }
        }
        expect(verb('tener').indicativePresent2plES).toBe('tienen');
    });

    test('there is never a first-person singular imperative', () => {
        expect(verb('bailar').imperative1sES).toBeUndefined();
    });
});

describe('Spanish noun selectors', () => {
    test('a feminine noun', () => {
        expect(noun('casa')).toEqual({ genderES: 'la', singularES: 'casa', pluralES: 'casas' });
    });

    test('a noun with both genders gets "el/la"', () => {
        expect(noun('estudiante')).toEqual({ genderES: 'el/la', singularES: 'estudiante', pluralES: 'estudiantes' });
    });
});

describe('Spanish reflexivity (D33)', () => {
    test('always reflexive: the lemma is a reflexive infinitive', () => {
        expect(verb('quejarse').reflexivityES).toBe('Always reflexive');
        expect(verb('personarse').reflexivityES).toBe('Always reflexive');
    });

    test('optionally reflexive: a plain lemma with a reflexive sense ("lavar" next to its own lemma "lavarse")', () => {
        expect(verb('lavar').reflexivityES).toBe('Optionally reflexive');
    });

    test('a `pronominal` sense also makes a verb optionally reflexive', () => {
        const stub = { word: 'terminar', pos: 'verb', forms: [], senses: [{ tags: ['transitive'] }, { tags: ['pronominal'] }] };
        expect(Object.fromEntries(selectCases(stub, VERB_SELECTORS_ES)).reflexivityES).toBe('Optionally reflexive');
    });

    test('not reflexive: no reflexive tag (the value means "no evidence"); a pointer sense (form_of) does not count', () => {
        expect(verb('bailar').reflexivityES).toBe('Not reflexive');
        const pointer = { word: 'x', pos: 'verb', forms: [], senses: [{ tags: ['reflexive'], form_of: ['y'] }] };
        expect(Object.fromEntries(selectCases(pointer, VERB_SELECTORS_ES)).reflexivityES).toBe('Not reflexive');
    });

    test('the ending must be a verb ending + "se": "se", "muse" and "ase" are not reflexive infinitives', () => {
        for (const word of ['se', 'muse', 'ase']) {
            const stub = { word, pos: 'verb', forms: [], senses: [{ tags: [] }] };
            expect(Object.fromEntries(selectCases(stub, VERB_SELECTORS_ES)).reflexivityES).toBe('Not reflexive');
        }
    });
});

describe('Spanish adjective and adverb selectors', () => {
    test('a gendered adjective fills the four M/F cells', () => {
        expect(adjective('rojo')).toEqual({ maleSingularES: 'rojo', malePluralES: 'rojos', femaleSingularES: 'roja', femalePluralES: 'rojas' });
    });

    test('an adjective with one shape for both genders fills the Neutral cells', () => {
        expect(adjective('feliz')).toEqual({ neutralSingularES: 'feliz', neutralPluralES: 'felices' });
        expect(adjective('grande')).toEqual({ neutralSingularES: 'grande', neutralPluralES: 'grandes' });
    });

    test('an adverb takes its comparative and has no forms otherwise', () => {
        expect(adverb('bien').comparativeES).toBe('mejor');
        expect(adverb('rápidamente')).toEqual({ adverbES: 'rápidamente' });
    });
});
