import { http, HttpResponse } from 'msw';
import type { ActivityPoint, StatsResponse } from '@/features/stats/types';

const DAY = 24 * 60 * 60 * 1000;
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** The same rule as the server: a window is partial if it reaches back to (or past) the first tracked day. */
function activity(todayMs: number, since: string | null, counts: { daily: number; weekly: number; monthly: number }): ActivityPoint[] {
    return Array.from({ length: 30 }, (_, i) => {
        const dayMs = todayMs - (29 - i) * DAY;
        const day = iso(dayMs);
        const point = (value: number, windowDays: number) => {
            if (since === null || day < since) return { count: null, partial: false };
            return { count: value, partial: dayMs - (windowDays - 1) * DAY <= Date.parse(`${since}T00:00:00Z`) };
        };
        return { day, daily: point(counts.daily, 1), weekly: point(counts.weekly, 7), monthly: point(counts.monthly, 30) };
    });
}

/** A Wednesday, so the current week has started on Monday 12 Oct. */
export const TODAY = '2026-10-14';

export function makeStats(overrides: Partial<StatsResponse> = {}): StatsResponse {
    const todayMs = Date.parse(`${TODAY}T00:00:00Z`);
    return {
        generatedAt: '2026-10-14T09:30:00.000Z',
        today: TODAY,
        totals: {
            users: 1234,
            verified: 1000,
            unverified: 234,
            banned: 3,
            pendingDeletion: 2,
            words: 50_000,
            translations: 120_000,
            tags: 40,
            savedSessions: 7,
            practisedTranslations: 900,
        },
        signups: {
            // 0, 1, 2, 3, 0, 1, ... : the newest 7 days (indices 23..29) add up to 12 (3+0+1+2+3+0+... see the test)
            daily: Array.from({ length: 30 }, (_, i) => ({ day: iso(todayMs - (29 - i) * DAY), count: i % 4 })),
            weekly: Array.from({ length: 12 }, (_, i) => ({ weekStart: iso(Date.parse('2026-10-12T00:00:00Z') - (11 - i) * 7 * DAY), count: 10 + i })),
        },
        active: {
            since: '2026-10-05',
            points: activity(todayMs, '2026-10-05', { daily: 20, weekly: 80, monthly: 300 }),
        },
        languages: [
            { language: 'English', users: 900 },
            { language: 'Spanish', users: 450 },
            { language: 'German', users: 120 },
            { language: 'Estonian', users: 30 },
        ],
        ...overrides,
    };
}

export { activity as makeActivity };

export const statsHandler = (respond: () => StatsResponse | Response = () => makeStats()) =>
    http.get('/api/admin/stats', () => {
        const result = respond();
        return result instanceof Response ? result : HttpResponse.json(result);
    });
