import { describe, expect, it } from 'vitest';
import { formatCount, formatDayLong, formatDayShort, formatShare, formatWeek } from '@/features/stats/format';

describe('formatDayShort and formatDayLong', () => {
    it('show the UTC day as it is, whatever the reader\'s time zone', () => {
        expect(formatDayShort('2026-09-12')).toBe('12 Sep');
        expect(formatDayShort('2026-01-01')).toBe('1 Jan');
        expect(formatDayLong('2026-09-12')).toBe('Sat, 12 Sep 2026');
    });
});

describe('formatWeek', () => {
    it('names the Monday that starts the week', () => {
        expect(formatWeek('2026-09-07')).toBe('Week of 7 Sep');
    });
});

describe('formatCount', () => {
    it('groups thousands', () => {
        expect(formatCount(0)).toBe('0');
        expect(formatCount(1234)).toBe('1,234');
        expect(formatCount(1234567)).toBe('1,234,567');
    });
});

describe('formatShare', () => {
    it('rounds to a whole percent, and gives a dash instead of dividing by zero', () => {
        expect(formatShare(5, 6)).toBe('83%');
        expect(formatShare(0, 10)).toBe('0%');
        expect(formatShare(10, 10)).toBe('100%');
        expect(formatShare(3, 0)).toBe('–');
    });
});
