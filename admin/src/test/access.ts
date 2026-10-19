import { http, HttpResponse } from 'msw';
import type { AccessMode, AccessState, AllowedAccount, DemoSettings, DemoStats, DemoUserRow, DemoUsers, Invite } from '@/features/access/types';

export function makeInvite(overrides: Partial<Invite> = {}): Invite {
    return { id: 'invite-1', email: 'friend@example.test', createdAt: '2026-10-01T08:00:00.000Z', addedBy: 'Sam Staff', ...overrides };
}

export function makeAllowed(overrides: Partial<AllowedAccount> = {}): AllowedAccount {
    return {
        userId: 'u1',
        name: 'Kaja Tamm',
        email: 'kaja@example.com',
        status: 'active',
        addedAt: '2026-10-02T08:00:00.000Z',
        addedBy: 'Sam Staff',
        ...overrides,
    };
}

export function makeDemoStats(overrides: Partial<DemoStats> = {}): DemoStats {
    return {
        starts: { last24h: 0, last7d: 0, last30d: 0, total: 0 },
        runningNow: 0,
        windowDays: 30,
        engagement: { demos: 0, avgWordsAdded: 0, avgTagsAdded: 0, avgTranslationsPractised: 0, addedAWord: 0 },
        caps: { wordCapDemos: 0, reachedWordCap: 0, tagCapDemos: 0, reachedTagCap: 0 },
        refusalWindowDays: 7,
        refusals: { demo_disabled: 0, demo_rate_limited: 0, demo_busy: 0, demo_unavailable: 0, captcha_failed: 0 },
        languages: [],
        uiLanguages: [],
        ...overrides,
    };
}

export function makeDemoUser(overrides: Partial<DemoUserRow> = {}): DemoUserRow {
    return {
        id: 'demo-1',
        status: 'live',
        startedAt: '2026-10-15T10:00:00.000Z',
        expiresAt: '2026-10-15T10:15:00.000Z',
        languages: ['English', 'German'],
        uiLanguage: 'English',
        wordsAdded: 0,
        tagsAdded: 0,
        configsAdded: 0,
        translationsPractised: 0,
        maxWords: 30,
        maxTags: 5,
        ...overrides,
    };
}

export function makeAccess(overrides: Partial<AccessState> = {}): AccessState {
    const invites = overrides.invites ?? [];
    const loginAllowed = overrides.loginAllowed ?? [];
    return {
        registration: { mode: 'open', note: '' },
        login: { mode: 'open', note: '' },
        demo: { enabled: false, durationMinutes: 15, maxWords: 30, maxTags: 5, maxLive: 200 },
        onboarding: { enabled: false },
        onboardingCounts: { pending: 0, done: 0, skipped: 0 },
        captcha: { enabled: false, configured: true },
        updatedAt: null,
        updatedBy: null,
        invites,
        loginAllowed,
        counts: { invites: invites.length, loginAllowed: loginAllowed.length, liveDemos: 0 },
        ...overrides,
    };
}

export interface AccessWrite {
    method: string;
    path: string;
    body: Record<string, unknown>;
}

/**
 * A small fake of the access endpoints. `state` is read on each request, so a test can change it, and
 * every write is recorded. A PUT and a DELETE change `state` the way the server does.
 */
export function accessHandlers(
    state: { current: AccessState },
    writes: AccessWrite[] = [],
    demo: { users?: DemoUsers; stats?: DemoStats } = {},
) {
    const withCounts = (next: AccessState): AccessState => ({
        ...next,
        counts: { ...next.counts, invites: next.invites.length, loginAllowed: next.loginAllowed.length },
    });
    const putGate = (gate: 'registration' | 'login') =>
        http.put(`/api/admin/access/${gate}`, async ({ request }) => {
            const body = (await request.json()) as { mode: AccessMode; note?: string };
            writes.push({ method: 'PUT', path: `/api/admin/access/${gate}`, body });
            state.current = withCounts({
                ...state.current,
                [gate]: { mode: body.mode, note: body.note ?? state.current[gate].note },
                updatedAt: '2026-10-02T09:00:00.000Z',
                updatedBy: 'Sam Staff',
            });
            return HttpResponse.json(state.current);
        });

    return [
        http.get('/api/admin/access', () => HttpResponse.json(state.current)),
        // The Demo tab's read-only parts (demo-access.md D19, D20): empty unless a test gives them.
        http.get('/api/admin/access/demo/users', () => HttpResponse.json(demo.users ?? { total: 0, rows: [] })),
        http.get('/api/admin/access/demo/stats', () => HttpResponse.json(demo.stats ?? makeDemoStats())),
        putGate('registration'),
        putGate('login'),
        http.put('/api/admin/access/onboarding', async ({ request }) => {
            const body = (await request.json()) as { enabled: boolean; reason?: string };
            writes.push({ method: 'PUT', path: '/api/admin/access/onboarding', body });
            state.current = withCounts({
                ...state.current,
                onboarding: { enabled: body.enabled },
                updatedAt: '2026-10-02T09:00:00.000Z',
                updatedBy: 'Sam Staff',
            });
            return HttpResponse.json(state.current);
        }),
        http.put('/api/admin/access/captcha', async ({ request }) => {
            const body = (await request.json()) as { enabled: boolean; reason?: string };
            writes.push({ method: 'PUT', path: '/api/admin/access/captcha', body });
            state.current = withCounts({
                ...state.current,
                captcha: { enabled: body.enabled, configured: state.current.captcha.configured },
                updatedAt: '2026-10-02T09:00:00.000Z',
                updatedBy: 'Sam Staff',
            });
            return HttpResponse.json(state.current);
        }),
        http.put('/api/admin/access/demo', async ({ request }) => {
            const body = (await request.json()) as Record<string, unknown> & DemoSettings;
            writes.push({ method: 'PUT', path: '/api/admin/access/demo', body });
            const demo: DemoSettings = {
                enabled: body.enabled,
                durationMinutes: body.durationMinutes,
                maxWords: body.maxWords,
                maxTags: body.maxTags,
                maxLive: body.maxLive,
            };
            state.current = withCounts({ ...state.current, demo, updatedAt: '2026-10-02T09:00:00.000Z', updatedBy: 'Sam Staff' });
            return HttpResponse.json(state.current);
        }),
        http.post('/api/admin/access/invites', async ({ request }) => {
            const body = (await request.json()) as { emails: string[] };
            writes.push({ method: 'POST', path: '/api/admin/access/invites', body });
            return HttpResponse.json({ ...state.current, added: [], skipped: [] });
        }),
        http.post('/api/admin/access/invites/:id/send', ({ params }) => {
            writes.push({ method: 'POST', path: `/api/admin/access/invites/${String(params.id)}/send`, body: {} });
            const invite = state.current.invites.find((i) => i.id === params.id);
            if (!invite) return HttpResponse.json({ message: 'Invite not found' }, { status: 404 });
            return HttpResponse.json({ sent: true, email: invite.email });
        }),
        http.delete('/api/admin/access/invites/:id', ({ params }) => {
            writes.push({ method: 'DELETE', path: `/api/admin/access/invites/${String(params.id)}`, body: {} });
            state.current = withCounts({ ...state.current, invites: state.current.invites.filter((i) => i.id !== params.id) });
            return HttpResponse.json(state.current);
        }),
        http.post('/api/admin/access/login-allowed/remove', async ({ request }) => {
            const body = (await request.json()) as { userIds: string[] };
            writes.push({ method: 'POST', path: '/api/admin/access/login-allowed/remove', body });
            const before = state.current.loginAllowed.length;
            state.current = withCounts({ ...state.current, loginAllowed: state.current.loginAllowed.filter((a) => !body.userIds.includes(a.userId)) });
            const removed = before - state.current.loginAllowed.length;
            return HttpResponse.json({ ...state.current, removed, skipped: body.userIds.length - removed });
        }),
        http.post('/api/admin/access/login-allowed', async ({ request }) => {
            const body = (await request.json()) as { userIds?: string[]; emails?: string[] };
            writes.push({ method: 'POST', path: '/api/admin/access/login-allowed', body });
            return HttpResponse.json({ ...state.current, added: [], skipped: [] });
        }),
        http.delete('/api/admin/access/login-allowed/:userId', ({ params }) => {
            writes.push({ method: 'DELETE', path: `/api/admin/access/login-allowed/${String(params.userId)}`, body: {} });
            state.current = withCounts({ ...state.current, loginAllowed: state.current.loginAllowed.filter((a) => a.userId !== params.userId) });
            return HttpResponse.json(state.current);
        }),
        http.post('/api/admin/access/sign-out-everyone', async ({ request }) => {
            const body = (await request.json()) as Record<string, unknown>;
            writes.push({ method: 'POST', path: '/api/admin/access/sign-out-everyone', body });
            return HttpResponse.json({ signedOut: 7 });
        }),
    ];
}
