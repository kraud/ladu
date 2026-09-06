const { calculateAging, calculateNewPercentageOfKnowledge } = require('../../controllers/exercisePerformanceController');

describe('calculateAging', () => {
    it('returns 100% when lastDate is now (0 days ago)', () => {
        const result = calculateAging(100, new Date());
        expect(result).toBeCloseTo(100, 5);
    });

    it('decays exponentially over time', () => {
        const now = new Date();
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        const dayResult = calculateAging(100, oneDayAgo);
        const weekResult = calculateAging(100, oneWeekAgo);
        const monthResult = calculateAging(100, thirtyDaysAgo);

        expect(dayResult).toBeLessThan(100);
        expect(weekResult).toBeLessThan(dayResult);
        expect(monthResult).toBeLessThan(weekResult);
    });

    it('decays by ~0.995 per day (0.01 decay factor)', () => {
        const now = new Date();
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        const result = calculateAging(100, oneDayAgo);
        expect(result).toBeCloseTo(99.005, 1);
    });

    it('approaches zero but never reaches it over long periods', () => {
        const now = new Date();
        const farAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

        const result = calculateAging(100, farAgo);
        expect(result).toBeGreaterThan(0);
        expect(result).toBeLessThan(5);
    });

    it('handles 0% knowledge (stays 0)', () => {
        const now = new Date();
        const oldDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        const result = calculateAging(0, oldDate);
        expect(result).toBe(0);
    });

    it('handles fractional knowledge values', () => {
        const now = new Date();
        const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);

        const result = calculateAging(42.5, tenDaysAgo);
        expect(result).toBeCloseTo(42.5 * Math.exp(-0.01 * 10), 5);
    });
});

describe('calculateNewPercentageOfKnowledge', () => {
    it('returns averageOfArray when no previous knowledge exists', () => {
        const result = calculateNewPercentageOfKnowledge(0, [true, true, true, true]);
        expect(result).toBe(100);
    });

    it('returns 0 when all answers are wrong', () => {
        const result = calculateNewPercentageOfKnowledge(0, [false, false, false, false]);
        expect(result).toBe(0);
    });

    it('returns 50 when half the answers are correct with no previous', () => {
        const result = calculateNewPercentageOfKnowledge(0, [true, false, true, false]);
        expect(result).toBe(50);
    });

    it('weights previous knowledge (50%) and recent performance (87.5%) when previous exists', () => {
        const result = calculateNewPercentageOfKnowledge(100, [true, true, true, true]);
        const expected = (0.5 * 100 + 3.5 * 100) / 4;
        expect(result).toBe(expected);
    });

    it('reduces knowledge when recent performance is worse than history', () => {
        const improved = calculateNewPercentageOfKnowledge(80, [true, true, true, true]);
        const declined = calculateNewPercentageOfKnowledge(80, [false, false, false, false]);

        expect(declined).toBeLessThan(improved);
    });

    it('handles empty array results gracefully', () => {
        const result = calculateNewPercentageOfKnowledge(50, []);
        expect(result).toBe(50);
    });

    it('handles partial array (fewer than 4 records)', () => {
        const result = calculateNewPercentageOfKnowledge(0, [true, false]);
        expect(result).toBe(25);
    });

    it('handles exactly 4 records', () => {
        const r1 = calculateNewPercentageOfKnowledge(0, [true, true, true, true]);
        expect(r1).toBe(100);
    });
});
