const { buildExerciseSet, pickExercises, seededRng } = require('../../services/exercises');
const { NOW, daysAgo, word, stat, perf, house } = require('./exercisesFixtures');

const params = (o = {}) => ({
    languages: ['English', 'Spanish'],
    type: 'Text-Input',
    multiLang: 'Multi-Language',
    amount: 2,
    wordSelection: 'Exercise-Performance',
    ...o,
});
const build = (words, o, seed = 1) =>
    buildExerciseSet(words, params(o), ['English', 'Spanish'], seededRng(seed), NOW);

describe('buildExerciseSet — ranking (A.9)', () => {
    it('picks the weakest words first', () => {
        const known = (id) => house(id, [perf(`${id}-English`, 'English', { averageTranslationKnowledge: 90 })]);
        const weak = house('weak', [perf('weak-English', 'English', { averageTranslationKnowledge: 10 })]);
        const fresh = house('fresh');
        const out = build([known('a'), weak, known('b'), fresh], { amount: 2 });
        expect(out.map((e) => e.wordId).sort()).toEqual(['fresh', 'weak']);
    });

    it('ranks a Mastered translation last and a Revise translation first', () => {
        const mastered = house('m', [perf('m-English', 'English', { performanceModifier: 'Mastered' })]);
        const revise = house('r', [perf('r-English', 'English', { performanceModifier: 'Revise', averageTranslationKnowledge: 99 })]);
        const middle = house('x', [perf('x-English', 'English', { averageTranslationKnowledge: 50 })]);
        expect(build([mastered, middle, revise], { amount: 3 }).map((e) => e.wordId)).toEqual(['r', 'x', 'm']);
    });

    it('ages the stored average before ranking', () => {
        const old = house('old', [perf('old-English', 'English', { averageTranslationKnowledge: 100, lastDateModifiedTranslation: daysAgo(180) })]);
        const recent = house('recent', [perf('recent-English', 'English', { averageTranslationKnowledge: 40, lastDateModifiedTranslation: NOW })]);
        expect(build([recent, old], { amount: 1 })[0].wordId).toBe('old');
    });

    it('picks the lowest-scored exercise inside a word', () => {
        const w = house('w', [perf('w-English', 'English', {
            averageTranslationKnowledge: 50,
            statsByCase: [stat('singularEN', 90, NOW)],
        }), perf('w-Spanish', 'Spanish', {
            averageTranslationKnowledge: 50,
            statsByCase: [stat('singularES', 90, NOW), stat('pluralES', 20, NOW)],
        })]);
        const [pick] = build([w], { amount: 1 });
        // Answer side is scored: every English/Spanish answer case that is not singular has no stat or a low one.
        expect(pick.knowledge).toBeLessThan(90);
    });

    it('attaches knowledge, performance and wordId to each exercise', () => {
        const p = perf('w-Spanish', 'Spanish', { statsByCase: [stat('singularES', 50, NOW)] });
        const out = build([house('w', [p])], { amount: 5 });
        const answeredES = out.find((e) => e.matchingTranslations.itemB.case === 'singularES');
        expect(answeredES.performance).toBe(p);
        expect(answeredES.knowledge).toBe(50);
        expect(answeredES.wordId).toBe('w');
        expect(Object.keys(answeredES).sort()).toEqual(['knowledge', 'matchingTranslations', 'multiLang', 'partOfSpeech', 'performance', 'type', 'wordId']);
    });

    it('skips words without exercises', () => {
        const adjective = word('adj', 'Adjective', { English: { x: 'a' }, Spanish: { y: 'b' } });
        const out = build([adjective, house('n')], { amount: 2 });
        expect(out.every((e) => e.wordId === 'n')).toBe(true);
    });
});

describe('pickExercises — amounts (A.9 step 5)', () => {
    it('gives one exercise per word when amount is lower than the word count', () => {
        const words = ['a', 'b', 'c'].map((id) => house(id));
        const out = build(words, { amount: 2 });
        expect(out).toHaveLength(2);
        expect(new Set(out.map((e) => e.wordId)).size).toBe(2);
    });

    it('repeats rounds without repeating an exercise, and stops when nothing is left', () => {
        // house() has 2 multi-language TI exercises (singular, plural).
        const out = build([house('a'), house('b')], { amount: 10 });
        expect(out).toHaveLength(4);
        const ids = out.map((e) => `${e.wordId}|${e.matchingTranslations.itemA.case}|${e.matchingTranslations.itemB.case}`);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('does not mutate the entries it is given', () => {
        const entries = [{ word: house('a'), exercises: [{ partOfSpeech: 'Noun', type: 'Text-Input', multiLang: true, matchingTranslations: { itemA: { case: 'x' }, itemB: { case: 'y' } } }], score: 0 }];
        pickExercises(entries, 5, false, seededRng(1), NOW);
        expect(entries[0].exercises).toHaveLength(1);
    });

    it('is reproducible with the same seed, in Random mode too', () => {
        const words = ['a', 'b', 'c', 'd'].map((id) => house(id));
        const first = build(words, { amount: 3, wordSelection: 'Random' }, 7);
        const second = build(words, { amount: 3, wordSelection: 'Random' }, 7);
        expect(second).toEqual(first);
        expect(first).toHaveLength(3);
    });
});

describe('buildExerciseSet — multiple choice (A.6)', () => {
    it('drops a multi-language MC exercise that finds no distractor', () => {
        expect(build([house('only')], { type: 'Multiple-Choice', difficultyMC: 1, amount: 2 })).toEqual([]);
    });

    it('fills otherValues from the other words', () => {
        const dog = word('dog', 'Noun', {
            English: { singularEN: 'dog', pluralEN: 'dogs' },
            Spanish: { singularES: 'perro', pluralES: 'perros' },
        });
        const out = build([house('a'), dog], { type: 'Multiple-Choice', difficultyMC: 1, amount: 2 });
        expect(out.length).toBeGreaterThan(0);
        out.forEach((e) => expect(e.matchingTranslations.itemB.otherValues.length).toBeGreaterThan(0));
    });

    it('does not add distractors in Single-Language mode and keeps the fixed option list', () => {
        const w = word('n', 'Noun', { Spanish: { singularES: 'casa', genderES: 'la' } });
        const out = build([w], { multiLang: 'Single-Language', type: 'Multiple-Choice', languages: ['Spanish'], amount: 1 });
        expect(out[0].matchingTranslations.itemB.otherValues).toEqual(['el', 'la', 'el/la']);
    });
});
