import { describe, expect, it } from 'vitest';
import { environmentMark } from './environment';

describe('environmentMark', () => {
    it('marks the two deployed names', () => {
        expect(environmentMark('staging')).toBe('staging');
        expect(environmentMark('prod')).toBe('production');
        expect(environmentMark('production')).toBe('production');
    });

    it('leaves development and unknown values unmarked', () => {
        expect(environmentMark('local')).toBeNull();
        expect(environmentMark('development')).toBeNull();
        expect(environmentMark('')).toBeNull();
        expect(environmentMark('STAGING')).toBeNull();
    });
});
