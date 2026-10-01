import { http, HttpResponse } from 'msw';
import type { AccessState, Invite } from '@/features/access/types';

export function makeInvite(overrides: Partial<Invite> = {}): Invite {
    return { id: 'invite-1', email: 'friend@example.test', createdAt: '2026-10-01T08:00:00.000Z', addedBy: 'Sam Staff', ...overrides };
}

export function makeAccess(overrides: Partial<AccessState> = {}): AccessState {
    const invites = overrides.invites ?? [];
    return {
        registration: { mode: 'open', note: '' },
        login: { mode: 'open', note: '' },
        updatedAt: null,
        updatedBy: null,
        invites,
        counts: { invites: invites.length },
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
export function accessHandlers(state: { current: AccessState }, writes: AccessWrite[] = []) {
    const withCounts = (next: AccessState): AccessState => ({ ...next, counts: { invites: next.invites.length } });
    return [
        http.get('/api/admin/access', () => HttpResponse.json(state.current)),
        http.put('/api/admin/access/registration', async ({ request }) => {
            const body = (await request.json()) as { mode: 'open' | 'closed' | 'limited'; note?: string };
            writes.push({ method: 'PUT', path: '/api/admin/access/registration', body });
            state.current = withCounts({
                ...state.current,
                registration: { mode: body.mode, note: body.note ?? state.current.registration.note },
                updatedAt: '2026-10-02T09:00:00.000Z',
                updatedBy: 'Sam Staff',
            });
            return HttpResponse.json(state.current);
        }),
        http.post('/api/admin/access/invites', async ({ request }) => {
            const body = (await request.json()) as { emails: string[] };
            writes.push({ method: 'POST', path: '/api/admin/access/invites', body });
            return HttpResponse.json({ ...state.current, added: [], skipped: [] });
        }),
        http.delete('/api/admin/access/invites/:id', ({ params }) => {
            writes.push({ method: 'DELETE', path: `/api/admin/access/invites/${String(params.id)}`, body: {} });
            state.current = withCounts({ ...state.current, invites: state.current.invites.filter((i) => i.id !== params.id) });
            return HttpResponse.json(state.current);
        }),
    ];
}
