const K = require('../../services/exercises/knowledge');
const { NOW, daysAgo, stat, perf } = require('./exercisesFixtures');

describe('calculateNewPercentageOfKnowledge (A.8)', () => {
    it('follows the documented all-correct sequence and the wrong answer that follows', () => {
        let knowledge = 0;
        const record = [];
        const seen = [];
        for (let i = 0; i < 5; i++) {
            record.push(true);
            if (record.length > 4) record.shift();
            knowledge = K.calculateNewPercentageOfKnowledge(knowledge, record);
            seen.push(knowledge);
        }
        expect(seen[0]).toBeCloseTo(25, 1);
        expect(seen[1]).toBeCloseTo(46.9, 1);
        expect(seen[2]).toBeCloseTo(71.5, 1);
        expect(seen[3]).toBeCloseTo(96.4, 1);
        expect(seen[4]).toBeCloseTo(99.6, 1);

        expect(K.calculateNewPercentageOfKnowledge(seen[4], [true, true, true, false])).toBeCloseTo(78.1, 1);
    });

    it('uses the window alone when the previous value is 0', () => {
        expect(K.calculateNewPercentageOfKnowledge(0, [true, false])).toBe(25);
    });

    it('returns the previous value for an empty record', () => {
        expect(K.calculateNewPercentageOfKnowledge(42, [])).toBe(42);
    });
});

describe('calculateAging (A.8)', () => {
    it.each([[30, 0.74], [69, 0.5], [180, 0.17]])('%i days multiply by about %f', (days, factor) => {
        expect(K.calculateAging(100, daysAgo(days), NOW)).toBeCloseTo(factor * 100, 0);
    });

    it('counts whole days only', () => {
        const almostADay = new Date(NOW.getTime() - 23 * 60 * 60 * 1000);
        expect(K.calculateAging(80, almostADay, NOW)).toBe(80);
    });
});

describe('applyAnswer', () => {
    it('creates a case stat on the first answer', () => {
        const s = K.applyAnswer(undefined, 'singularEN', true, NOW);
        expect(s).toEqual({ caseName: 'singularEN', record: [true], knowledge: 25, lastDate: NOW });
    });

    it('keeps the last 4 answers, oldest dropped, and does not change the input', () => {
        const existing = stat('singularEN', 50, daysAgo(1), [true, false, true, true]);
        const s = K.applyAnswer(existing, 'singularEN', false, NOW);
        expect(s.record).toEqual([false, true, true, false]);
        expect(existing.record).toEqual([true, false, true, true]);
        expect(s.knowledge).toBeCloseTo((0.5 * 50 + 3.5 * 50) / 4, 5);
    });
});

describe('translationAverage', () => {
    it('is the mean of the aged case knowledge', () => {
        const cases = [stat('a', 100, NOW), stat('b', 50, NOW)];
        expect(K.translationAverage(cases, NOW)).toBe(75);
    });

    it('ages each case from its own date', () => {
        const cases = [stat('a', 100, daysAgo(69))];
        expect(K.translationAverage(cases, NOW)).toBeCloseTo(50, 0);
    });
});

describe('nextReviseState (A.8 modifiers)', () => {
    it('adds 1 per correct answer while Revise', () => {
        expect(K.nextReviseState('Revise', 2, true)).toEqual({ performanceModifier: 'Revise', reviseCounter: 3 });
    });

    it('clears the modifier and resets the counter at 5', () => {
        expect(K.nextReviseState('Revise', 4, true)).toEqual({ performanceModifier: null, reviseCounter: 0 });
    });

    it('ignores wrong answers', () => {
        expect(K.nextReviseState('Revise', 2, false)).toEqual({ performanceModifier: 'Revise', reviseCounter: 2 });
    });

    it('does not touch other modifiers', () => {
        expect(K.nextReviseState('Mastered', 0, true)).toEqual({ performanceModifier: 'Mastered', reviseCounter: 0 });
        expect(K.nextReviseState(null, null, true)).toEqual({ performanceModifier: null, reviseCounter: 0 });
    });
});

describe('wordScore (A.9 step 2)', () => {
    const langs = ['English', 'Spanish'];

    it('is 0 without performances', () => {
        expect(K.wordScore([], langs, NOW)).toBe(0);
    });

    it('takes 100 for Mastered, 0 for Revise, aged average otherwise', () => {
        const rows = [
            perf('t1', 'English', { performanceModifier: 'Mastered', averageTranslationKnowledge: 10 }),
            perf('t2', 'Spanish', { performanceModifier: 'Revise', averageTranslationKnowledge: 90 }),
        ];
        expect(K.wordScore(rows, langs, NOW)).toBe(50);
        const aged = [perf('t1', 'English', { averageTranslationKnowledge: 100, lastDateModifiedTranslation: daysAgo(69) })];
        expect(K.wordScore(aged, langs, NOW)).toBeCloseTo(50, 0);
    });

    it('ignores languages outside the user profile', () => {
        const rows = [
            perf('t1', 'English', { averageTranslationKnowledge: 40 }),
            perf('t2', 'German', { averageTranslationKnowledge: 100 }),
        ];
        expect(K.wordScore(rows, langs, NOW)).toBe(40);
    });
});

describe('exerciseScore (A.9 step 4)', () => {
    const exercise = (translationId, caseName) => ({
        matchingTranslations: { itemA: {}, itemB: { translationId, case: caseName } },
    });

    it('is 0 without a performance', () => {
        expect(K.exerciseScore(exercise('t1', 'c'), [], NOW)).toEqual({ knowledge: 0 });
    });

    it('is 100 when Mastered and 0 when Revise, on any case', () => {
        const mastered = perf('t1', 'English', { performanceModifier: 'Mastered' });
        const revise = perf('t1', 'English', { performanceModifier: 'Revise' });
        expect(K.exerciseScore(exercise('t1', 'c'), [mastered], NOW).knowledge).toBe(100);
        expect(K.exerciseScore(exercise('t1', 'c'), [revise], NOW).knowledge).toBe(0);
    });

    it('ages the case stat, and gives 0 to a case without a stat', () => {
        const p = perf('t1', 'English', { statsByCase: [stat('c', 100, daysAgo(69))] });
        const hit = K.exerciseScore(exercise('t1', 'c'), [p], NOW);
        expect(hit.knowledge).toBeCloseTo(50, 0);
        expect(hit.performance).toBe(p);
        expect(K.exerciseScore(exercise('t1', 'other'), [p], NOW).knowledge).toBe(0);
    });
});
