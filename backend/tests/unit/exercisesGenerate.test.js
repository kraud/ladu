const { generateExercisesForWord, MULTI_LANGUAGE, SINGLE_LANGUAGE, seededRng } = require('../../services/exercises');
const { word, house } = require('./exercisesFixtures');

const opts = (o = {}) => ({
    languages: ['English', 'Spanish', 'German', 'Estonian'],
    type: 'Text-Input',
    multiLang: 'Multi-Language',
    ...o,
});
const gen = (w, o, seed = 1) => generateExercisesForWord(w, opts(o), seededRng(seed));
const cases = (e) => `${e.matchingTranslations.itemA.case}>${e.matchingTranslations.itemB.case}`;

describe('catalogue (A.5)', () => {
    it('has noun and verb groups only', () => {
        expect(Object.keys(MULTI_LANGUAGE).sort()).toEqual(['Noun', 'Verb']);
        expect(Object.keys(SINGLE_LANGUAGE).sort()).toEqual(['Noun', 'Verb']);
    });

    it('has the verb tenses with persons 1s 2s 3s 1pl 3pl and no future in Estonian', () => {
        const verbs = MULTI_LANGUAGE.Verb;
        expect(Object.keys(verbs)).toEqual(['present', 'past', 'future']);
        expect(Object.keys(verbs.present)).toHaveLength(5);
        expect(verbs.present.firstSingular.Estonian).toBe('kindelPresent1sEE');
        expect(verbs.past.thirdPlural.Spanish).toBe('indicativePerfectSimplePast3plES');
        expect(verbs.future.firstPlural.German).toBe('indicativeSimpleFuture1plDE');
        expect(verbs.future.firstPlural.Estonian).toBeUndefined();
    });
});

describe('multi-language generation', () => {
    it('gives one exercise per shared slot for a pair of languages', () => {
        const out = gen(house(), { languages: ['English', 'Spanish'] });
        expect(out).toHaveLength(2);
        expect(out.every((e) => e.multiLang && e.type === 'Text-Input' && e.partOfSpeech === 'Noun')).toBe(true);
    });

    it('puts the answer side on itemB, with the translation id of itemB', () => {
        const [e] = gen(house(), { languages: ['English', 'Spanish'] });
        const { itemA, itemB } = e.matchingTranslations;
        expect(itemA.language).not.toBe(itemB.language);
        expect(itemB.translationId).toBe(`w1-${itemB.language}`);
        expect(itemA.translationId).toBeUndefined();
        expect(itemB.otherValues).toBeUndefined();
    });

    it('uses both directions across seeds', () => {
        const directions = new Set();
        for (let seed = 1; seed <= 20; seed++) {
            directions.add(gen(house(), { languages: ['English', 'Spanish'] }, seed)[0].matchingTranslations.itemA.language);
        }
        expect(directions).toEqual(new Set(['English', 'Spanish']));
    });

    it('skips a slot when a value is missing and a language the word does not have', () => {
        const w = word('w', 'Noun', { English: { singularEN: 'dog' }, Spanish: { singularES: 'perro', pluralES: 'perros' } });
        const out = gen(w, { languages: ['English', 'Spanish', 'German'] });
        expect(out).toHaveLength(1);
        expect(cases(out[0])).toMatch(/singular(EN>singularES|ES>singularEN)/);
    });

    it('makes every pair for a noun with 3 languages (German cases only pair with Estonian)', () => {
        const w = word('w', 'Noun', {
            English: { singularEN: 'a' },
            German: { singularNominativDE: 'b', singularAkkusativDE: 'b2' },
            Estonian: { singularNimetavEE: 'c', singularOsastavEE: 'c2' },
        });
        // nominative: EN-DE, EN-EE, DE-EE; accusative: DE-EE
        expect(gen(w, { languages: ['English', 'German', 'Estonian'] })).toHaveLength(4);
    });

    it('makes all 5 persons of one tense for a verb', () => {
        const forms = (stem, suffix) =>
            Object.fromEntries(['1s', '2s', '3s', '1pl', '3pl'].map((p) => [`${stem}${p}${suffix}`, `${suffix}-${p}`]));
        const w = word('v', 'Verb', {
            English: forms('simplePresent', 'EN'),
            Spanish: forms('indicativePresent', 'ES'),
        });
        expect(gen(w, { languages: ['English', 'Spanish'] })).toHaveLength(5);
    });

    it('gives nothing for adjectives and adverbs', () => {
        for (const pos of ['Adjective', 'Adverb']) {
            const w = word('a', pos, { English: { singularEN: 'x' }, Spanish: { singularES: 'y' } });
            expect(gen(w, { languages: ['English', 'Spanish'], multiLang: 'Random', type: 'Random' })).toEqual([]);
        }
    });

    it('sets otherValues: [] on multiple-choice and mixes both types for Random', () => {
        const mc = gen(house(), { languages: ['English', 'Spanish'], type: 'Multiple-Choice' });
        expect(mc.every((e) => e.type === 'Multiple-Choice' && Array.isArray(e.matchingTranslations.itemB.otherValues))).toBe(true);
        const types = new Set();
        for (let seed = 1; seed <= 30; seed++) {
            gen(house(), { languages: ['English', 'Spanish'], type: 'Random' }, seed).forEach((e) => types.add(e.type));
        }
        expect(types).toEqual(new Set(['Multiple-Choice', 'Text-Input']));
    });
});

describe('single-language generation', () => {
    const spanishNoun = () => word('n', 'Noun', { Spanish: { singularES: 'casa', genderES: 'la' } });

    it('builds the Spanish gender drill with its fixed options', () => {
        const [e] = gen(spanishNoun(), { multiLang: 'Single-Language', type: 'Multiple-Choice' });
        expect(e.multiLang).toBe(false);
        expect(e.matchingTranslations.itemA).toEqual({ language: 'Spanish', case: 'singularES', value: 'casa' });
        expect(e.matchingTranslations.itemB).toEqual({
            language: 'Spanish', case: 'genderES', value: 'la', translationId: 'n-Spanish', otherValues: ['el', 'la', 'el/la'],
        });
    });

    it('only gives drills of the requested card type', () => {
        expect(gen(spanishNoun(), { multiLang: 'Single-Language', type: 'Text-Input' })).toEqual([]);
    });

    it('excludes the native language', () => {
        expect(gen(spanishNoun(), { multiLang: 'Single-Language', type: 'Multiple-Choice', nativeLanguage: 'Spanish' })).toEqual([]);
    });

    it('gives the Estonian short-form text drill and 3 Spanish verb drills for Random', () => {
        const ee = word('e', 'Noun', { Estonian: { singularNimetavEE: 'maja', shortFormEE: 'maja' } });
        expect(gen(ee, { multiLang: 'Single-Language', type: 'Random' })).toHaveLength(1);
        const verb = word('v', 'Verb', {
            Spanish: {
                infinitiveNonFiniteSimpleES: 'bailar', regularityES: 'regular',
                participleNonFiniteSimpleES: 'bailado', gerundNonFiniteSimpleES: 'bailando',
            },
        });
        const out = gen(verb, { multiLang: 'Single-Language', type: 'Random' });
        expect(out.map((e) => e.type)).toEqual(['Multiple-Choice', 'Text-Input', 'Text-Input']);
    });

    it('does not check the native language for multi-language exercises', () => {
        const out = gen(house(), { languages: ['English', 'Spanish'], nativeLanguage: 'Spanish' });
        expect(out).toHaveLength(2);
    });

    it('Random language mode returns multi- and single-language exercises together', () => {
        const out = gen(house(), { languages: ['English', 'Spanish'], multiLang: 'Random', type: 'Multiple-Choice' });
        expect(out.filter((e) => e.multiLang)).toHaveLength(2);
        expect(out.filter((e) => !e.multiLang)).toHaveLength(1);
    });
});
