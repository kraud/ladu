/**
 * Spanish lexicon selectors (lib/lexicon/selectors/es.ts) against real kaikki entries.
 * Fixture: tests/unit/fixtures/lexicon-es.json (Wiktionary excerpts, CC BY-SA 4.0).
 * Plan: .context/plans/autocomplete-data-source-strategy.md, Slice 0 step 0c.
 */
const { selectCases } = require('../../lib/lexicon/select');
const { NOUN_SELECTORS_ES, VERB_SELECTORS_ES } = require('../../lib/lexicon/selectors/es');
const { entries } = require('./fixtures/lexicon-es.json');

const entry = (word) => entries.find((e) => e.word === word);
const verb = (word) => Object.fromEntries(selectCases(entry(word), VERB_SELECTORS_ES));
const noun = (word) => Object.fromEntries(selectCases(entry(word), NOUN_SELECTORS_ES));

describe('Spanish verb selectors', () => {
    test('a regular verb fills every field of the v2 form, plus conditional and imperative', () => {
        expect(verb('bailar')).toEqual({
            regularityES: 'regular',
            infinitiveNonFiniteSimpleES: 'bailar',
            gerundNonFiniteSimpleES: 'bailando',
            participleNonFiniteSimpleES: 'bailado',
            indicativePresent1sES: 'bailo',
            indicativePresent2sES: 'bailas',
            indicativePresent3sES: 'baila',
            indicativePresent1plES: 'bailamos',
            indicativePresent2plES: 'bailáis',
            indicativePresent3plES: 'bailan',
            indicativeImperfectPast1sES: 'bailaba',
            indicativeImperfectPast2sES: 'bailabas',
            indicativeImperfectPast3sES: 'bailaba',
            indicativeImperfectPast1plES: 'bailábamos',
            indicativeImperfectPast2plES: 'bailabais',
            indicativeImperfectPast3plES: 'bailaban',
            indicativePerfectSimplePast1sES: 'bailé',
            indicativePerfectSimplePast2sES: 'bailaste',
            indicativePerfectSimplePast3sES: 'bailó',
            indicativePerfectSimplePast1plES: 'bailamos',
            indicativePerfectSimplePast2plES: 'bailasteis',
            indicativePerfectSimplePast3plES: 'bailaron',
            indicativeFuture1sES: 'bailaré',
            indicativeFuture2sES: 'bailarás',
            indicativeFuture3sES: 'bailará',
            indicativeFuture1plES: 'bailaremos',
            indicativeFuture2plES: 'bailaréis',
            indicativeFuture3plES: 'bailarán',
            indicativeConditional1sES: 'bailaría',
            indicativeConditional2sES: 'bailarías',
            indicativeConditional3sES: 'bailaría',
            indicativeConditional1plES: 'bailaríamos',
            indicativeConditional2plES: 'bailaríais',
            indicativeConditional3plES: 'bailarían',
            imperative2sES: 'baila',
            imperative3sES: 'baile',
            imperative1plES: 'bailemos',
            imperative2plES: 'bailad',
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
