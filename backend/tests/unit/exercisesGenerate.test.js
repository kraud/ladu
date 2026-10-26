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
        // French (slice 5): present, imparfait as "past", simple future. No 2nd person plural in any language.
        expect(verbs.present.firstSingular.French).toBe('indicativePresent1sFR');
        expect(verbs.past.thirdPlural.French).toBe('indicativeImperfect3plFR');
        expect(verbs.future.firstPlural.French).toBe('indicativeSimpleFuture1plFR');
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

    it('pairs a French noun with an English one, singular and plural', () => {
        const w = word('h', 'Noun', {
            English: { singularEN: 'horse', pluralEN: 'horses' },
            French: { singularFR: 'cheval', pluralFR: 'chevaux', genderFR: 'le' },
        });
        const out = gen(w, { languages: ['English', 'French'] });
        expect(out).toHaveLength(2); // one exercise per slot, direction at random
        const allowed = new Set(['pluralEN>pluralFR', 'pluralFR>pluralEN', 'singularEN>singularFR', 'singularFR>singularEN']);
        for (const e of out) expect(allowed.has(cases(e))).toBe(true);
        expect(out.filter((e) => cases(e).includes('singular'))).toHaveLength(1);
        expect(out.filter((e) => cases(e).includes('plural'))).toHaveLength(1);
    });

    it('pairs a French verb with an English one in the present, the imparfait and the future (slice 5)', () => {
        const persons = [['1s', 'I'], ['2s', 'you'], ['3s', 'he'], ['1pl', 'we'], ['3pl', 'they']];
        const w = word('v', 'Verb', {
            English: Object.fromEntries(persons.flatMap(([code]) => ['simplePresent', 'simplePast', 'simpleFuture'].map((t) => [`${t}${code}EN`, 'x']))),
            French: Object.fromEntries(
                persons.flatMap(([code]) => ['indicativePresent', 'indicativeImperfect', 'indicativeSimpleFuture'].map((t) => [`${t}${code}FR`, 'y'])),
            ),
        });
        const out = gen(w, { languages: ['English', 'French'] });
        expect(out).toHaveLength(15); // 3 tenses x 5 persons
        const usedFrench = out.map((e) => [e.matchingTranslations.itemA, e.matchingTranslations.itemB].find((i) => i.language === 'French').case);
        expect(usedFrench.filter((c) => c.startsWith('indicativeImperfect'))).toHaveLength(5);
        // The passé composé is never asked: the form is only a participle.
        expect(usedFrench.some((c) => c.startsWith('indicativePerfect'))).toBe(false);
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

    it('builds the French gender drill with its fixed options (language-french.md, slice 4)', () => {
        const frenchNoun = word('f', 'Noun', { French: { singularFR: 'cheval', genderFR: 'le' } });
        const [e] = gen(frenchNoun, { languages: ['French'], multiLang: 'Single-Language', type: 'Multiple-Choice' });
        expect(e.matchingTranslations.itemA).toEqual({ language: 'French', case: 'singularFR', value: 'cheval' });
        expect(e.matchingTranslations.itemB).toEqual({
            language: 'French', case: 'genderFR', value: 'le', translationId: 'f-French', otherValues: ['le', 'la', 'le/la'],
        });
    });

    describe('French verb drills (slice 5)', () => {
        const frenchVerb = () =>
            word('v', 'Verb', { French: { infinitiveFR: 'aller', auxVerbFR: 'être', verbGroupFR: '3e groupe', pastParticipleFR: 'allé' } });

        it('multiple choice: the auxiliary and the verb group, each with its fixed options', () => {
            const out = gen(frenchVerb(), { languages: ['French'], multiLang: 'Single-Language', type: 'Multiple-Choice' });
            expect(out.map((e) => e.matchingTranslations.itemB)).toEqual([
                { language: 'French', case: 'auxVerbFR', value: 'être', translationId: 'v-French', otherValues: ['avoir', 'être'] },
                { language: 'French', case: 'verbGroupFR', value: '3e groupe', translationId: 'v-French', otherValues: ['1er groupe', '2e groupe', '3e groupe'] },
            ]);
            expect(out.every((e) => e.matchingTranslations.itemA.case === 'infinitiveFR')).toBe(true);
        });

        it('text input: the past participle from the infinitive', () => {
            const [e] = gen(frenchVerb(), { languages: ['French'], multiLang: 'Single-Language', type: 'Text-Input' });
            expect(e.matchingTranslations.itemA).toEqual({ language: 'French', case: 'infinitiveFR', value: 'aller' });
            expect(e.matchingTranslations.itemB).toMatchObject({ language: 'French', case: 'pastParticipleFR', value: 'allé' });
        });

        it('skips a drill whose answer is empty', () => {
            const w = word('v', 'Verb', { French: { infinitiveFR: 'manger', auxVerbFR: 'avoir' } });
            const out = gen(w, { languages: ['French'], multiLang: 'Single-Language', type: 'Multiple-Choice' });
            expect(out.map((e) => e.matchingTranslations.itemB.case)).toEqual(['auxVerbFR']);
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

describe('native-language hint', () => {
    const trio = () =>
        word('w2', 'Noun', {
            English: { singularEN: 'house', pluralEN: 'houses' },
            Spanish: { singularES: 'casa', pluralES: 'casas', genderES: 'la' },
            German: { singularNominativDE: 'Haus', pluralNominativDE: 'Häuser', genderDE: 'das' },
        });

    it('gives the native form of the same slot when native is not in the pair', () => {
        const out = gen(trio(), { languages: ['English', 'Spanish'], hintLanguage: 'German' });
        expect(out).toHaveLength(2);
        const singular = out.find((e) => e.matchingTranslations.itemA.case.startsWith('singular'));
        const plural = out.find((e) => e.matchingTranslations.itemA.case.startsWith('plural'));
        expect(singular.hint).toEqual({ language: 'German', value: 'Haus' });
        expect(plural.hint).toEqual({ language: 'German', value: 'Häuser' });
    });

    it('falls back to the base form, marked approximate, when the exact case is missing', () => {
        const w = word('w3', 'Noun', {
            English: { singularEN: 'house', pluralEN: 'houses' },
            Spanish: { singularES: 'casa', pluralES: 'casas' },
            German: { singularNominativDE: 'Haus' },
        });
        const out = gen(w, { languages: ['English', 'Spanish'], hintLanguage: 'German' });
        const singular = out.find((e) => e.matchingTranslations.itemA.case.startsWith('singular'));
        const plural = out.find((e) => e.matchingTranslations.itemA.case.startsWith('plural'));
        expect(singular.hint).toEqual({ language: 'German', value: 'Haus' });
        expect(plural.hint).toEqual({ language: 'German', value: 'Haus', approximate: true });
    });

    it('gives no hint when native is one of the pair', () => {
        const out = gen(trio(), { languages: ['English', 'Spanish'], hintLanguage: 'English' });
        expect(out.every((e) => e.hint === undefined)).toBe(true);
    });

    it('gives no hint when the word has no native translation', () => {
        const out = gen(house(), { languages: ['English', 'Spanish'], hintLanguage: 'German' });
        expect(out.every((e) => e.hint === undefined)).toBe(true);
    });

    it('gives the native headword on a drill', () => {
        const out = gen(trio(), { languages: ['Spanish'], multiLang: 'Single-Language', type: 'Multiple-Choice', hintLanguage: 'English' });
        expect(out).toHaveLength(1);
        expect(out[0].hint).toEqual({ language: 'English', value: 'house' });
    });
});
