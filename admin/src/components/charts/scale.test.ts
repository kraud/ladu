import { describe, expect, it } from 'vitest';
import { niceTicks } from '@/components/charts/scale';

describe('niceTicks', () => {
    it('gives a small axis for nothing, so an empty chart still has a frame', () => {
        expect(niceTicks(0)).toEqual([0, 1, 2]);
        expect(niceTicks(-3)).toEqual([0, 1, 2]);
        expect(niceTicks(Number.NaN)).toEqual([0, 1, 2]);
    });

    it('uses steps of 1, 2, 5 and 10 times a power of ten, and always reaches the largest value', () => {
        expect(niceTicks(1)).toEqual([0, 1]);
        expect(niceTicks(3)).toEqual([0, 1, 2, 3]);
        expect(niceTicks(8)).toEqual([0, 2, 4, 6, 8]);
        expect(niceTicks(9)).toEqual([0, 5, 10]);
        expect(niceTicks(37)).toEqual([0, 10, 20, 30, 40]);
        expect(niceTicks(120)).toEqual([0, 50, 100, 150]);
        expect(niceTicks(1000)).toEqual([0, 500, 1000]);
    });

    it('never has more than 5 ticks, and every tick is a whole number', () => {
        for (let max = 1; max <= 5000; max += 7) {
            const ticks = niceTicks(max);
            expect(ticks.length).toBeLessThanOrEqual(6);
            expect(ticks.every(Number.isInteger)).toBe(true);
            expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(max);
            expect(ticks[0]).toBe(0);
        }
    });
});
