const { addDistractors, seededRng } = require('../../services/exercises');
const { word } = require('./exercisesFixtures');

const answerExercise = (partOfSpeech, language, caseName, value) => ({
    partOfSpeech,
    type: 'Multiple-Choice',
    multiLang: true,
    matchingTranslations: {
        itemA: { language: 'English', case: 'x', value: 'x' },
        itemB: { language, case: caseName, value, translationId: 't', otherValues: [] },
    },
});

// The answer word ("casa") plus other words in the pool.
const casa = word('casa', 'Noun', { English: { singularEN: 'house' }, Spanish: { singularES: 'casa', pluralES: 'casas', genderES: 'la' } });
const perro = word('perro', 'Noun', { English: { singularEN: 'dog' }, Spanish: { singularES: 'perro', pluralES: 'perros', genderES: 'el' } });
const bailar = word('bailar', 'Verb', {
    English: { simplePresent1sEN: 'I dance', simplePresent2sEN: 'you dance', simplePast1sEN: 'I danced', regularityEN: 'regular' },
    Spanish: { indicativePresent1sES: 'bailo', indicativePresent2sES: 'bailas', indicativePresent3sES: 'baila', regularityES: 'regular' },
});
const pool = [casa, perro, bailar];
const nounAnswer = () => answerExercise('Noun', 'Spanish', 'singularES', 'casa');
const options = (level, exercise, seed) =>
    addDistractors([exercise], pool, level, seededRng(seed))[0]?.matchingTranslations.itemB.otherValues;

const seeds = Array.from({ length: 40 }, (_, i) => i + 1);
const allValues = (w) => w.translations.flatMap((t) => t.cases.filter((c) => !/^(gender|regularity)/.test(c.caseName)).map((c) => c.word));

describe('addDistractors (A.6)', () => {
    it('never offers the correct answer', () => {
        for (const level of [0, 1, 2, 3]) {
            for (const seed of seeds) {
                expect(options(level, nounAnswer(), seed) ?? []).not.toContain('casa');
            }
        }
    });

    it('never offers property values (gender, regularity…)', () => {
        for (const seed of seeds) {
            expect(options(0, nounAnswer(), seed)).not.toEqual(expect.arrayContaining(['la']));
            expect(options(0, nounAnswer(), seed)).not.toContain('regular');
        }
    });

    it('level 0: any language, any word type in the pool', () => {
        const seen = new Set();
        seeds.forEach((seed) => options(0, nounAnswer(), seed).forEach((o) => seen.add(o)));
        expect(seen.has('house') || seen.has('dog')).toBe(true); // English values
        expect(seen.has('bailo') || seen.has('bailas') || seen.has('baila')).toBe(true); // a verb value
    });

    it('level 1: same language as the answer, any word type', () => {
        const spanish = new Set([...allValues(casa), ...allValues(perro), ...allValues(bailar)].filter((v) => !['house', 'dog', 'I dance', 'you dance', 'I danced'].includes(v)));
        const seen = new Set();
        seeds.forEach((seed) => options(1, nounAnswer(), seed).forEach((o) => seen.add(o)));
        seen.forEach((o) => expect(spanish.has(o)).toBe(true));
        expect(['bailo', 'bailas', 'baila'].some((v) => seen.has(v))).toBe(true);
    });

    it('level 2: same language and same word type only', () => {
        const spanishNouns = new Set(['perro', 'perros', 'casas']);
        seeds.forEach((seed) => options(2, nounAnswer(), seed).forEach((o) => expect(spanishNouns.has(o)).toBe(true)));
    });

    it('level 3, verbs: other forms of the same verb', () => {
        const answer = answerExercise('Verb', 'Spanish', 'indicativePresent1sES', 'bailo');
        seeds.forEach((seed) => {
            const got = options(3, answer, seed);
            expect(got.length).toBeGreaterThan(0);
            got.forEach((o) => expect(['bailas', 'baila']).toContain(o));
        });
    });

    it('level 3, nouns: a different case value of another noun', () => {
        seeds.forEach((seed) => options(3, nounAnswer(), seed).forEach((o) => expect(['perro', 'perros', 'casas']).toContain(o)));
    });

    it('defaults to level 0 when no difficulty is given', () => {
        expect(addDistractors([nounAnswer()], pool, undefined, seededRng(1))[0].matchingTranslations.itemB.otherValues.length).toBeGreaterThan(0);
    });

    it('drops an exercise with no distractor and passes other exercises through', () => {
        const single = { ...nounAnswer(), multiLang: false };
        const text = { ...nounAnswer(), type: 'Text-Input' };
        expect(addDistractors([nounAnswer(), single, text], [casa], 1, seededRng(1))).toEqual([single, text]);
    });

    it('does not change the input exercise', () => {
        const exercise = nounAnswer();
        addDistractors([exercise], pool, 1, seededRng(1));
        expect(exercise.matchingTranslations.itemB.otherValues).toEqual([]);
    });
});
