import { describe, expect, it } from 'vitest';
import { formatAgo, formatBytes, formatUptime } from '@/features/health/format';

describe('formatBytes', () => {
    it('picks the unit and keeps one decimal above bytes', () => {
        expect(formatBytes(0)).toBe('0 B');
        expect(formatBytes(1023)).toBe('1023 B');
        expect(formatBytes(1536)).toBe('1.5 KB');
        expect(formatBytes(15_728_640)).toBe('15.0 MB');
        expect(formatBytes(5 * 1024 ** 3)).toBe('5.0 GB');
    });
});

describe('formatUptime', () => {
    it('shows the largest useful parts', () => {
        expect(formatUptime(5)).toBe('5s');
        expect(formatUptime(59)).toBe('59s');
        expect(formatUptime(60)).toBe('1m');
        expect(formatUptime(3_600)).toBe('1h 0m');
        expect(formatUptime(93_784)).toBe('1d 2h 3m');
        expect(formatUptime(86_400)).toBe('1d 0h 0m');
    });
});

describe('formatAgo', () => {
    const now = Date.parse('2026-10-01T12:00:00Z');
    const ago = (seconds: number) => new Date(now - seconds * 1000).toISOString();

    it('uses the largest unit, with the right plural', () => {
        expect(formatAgo(ago(10), now)).toBe('just now');
        expect(formatAgo(ago(60), now)).toBe('1 minute ago');
        expect(formatAgo(ago(150), now)).toBe('2 minutes ago');
        expect(formatAgo(ago(3_600), now)).toBe('1 hour ago');
        expect(formatAgo(ago(5 * 3_600 + 100), now)).toBe('5 hours ago');
        expect(formatAgo(ago(86_400), now)).toBe('1 day ago');
        expect(formatAgo(ago(3 * 86_400), now)).toBe('3 days ago');
    });

    it('never says a negative time if the clocks differ a little', () => {
        expect(formatAgo(ago(-30), now)).toBe('just now');
    });
});
