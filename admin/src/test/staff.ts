import { http, HttpResponse } from 'msw';
import type { StaffMember } from '@/features/staff/types';

export function makeMember(overrides: Partial<StaffMember> = {}): StaffMember {
    return {
        id: 'staff-2',
        email: 'robin@example.test',
        name: 'Robin Support',
        role: 'support',
        status: 'active',
        mustChangePassword: false,
        lastLoginAt: '2026-09-30T08:00:00.000Z',
        passwordChangedAt: null,
        createdAt: '2026-09-01T08:00:00.000Z',
        ...overrides,
    };
}

/** Serves the staff list (from `members()`, so a test can change it) and records every write. */
export function staffHandlers(
    members: () => StaffMember[],
    writes: { method: string; path: string; body: Record<string, unknown> }[] = [],
    respond?: (path: string, body: Record<string, unknown>) => Response | StaffMember | undefined,
) {
    return [
        http.get('/api/admin/staff', () => HttpResponse.json({ items: members() })),
        http.post('/api/admin/staff', async ({ request }) => {
            const body = (await request.json()) as Record<string, unknown>;
            writes.push({ method: 'POST', path: '/api/admin/staff', body });
            const result = respond?.('/api/admin/staff', body);
            if (result instanceof Response) return result;
            return HttpResponse.json(result ?? makeMember({ id: 'staff-new', name: String(body.name), email: String(body.email), mustChangePassword: true }), { status: 201 });
        }),
        http.post('/api/admin/staff/:id/:action', async ({ request, params }) => {
            const body = (await request.json()) as Record<string, unknown>;
            const path = `/api/admin/staff/${String(params.id)}/${String(params.action)}`;
            writes.push({ method: 'POST', path, body });
            const result = respond?.(path, body);
            if (result instanceof Response) return result;
            return HttpResponse.json(result ?? makeMember({ id: String(params.id) }));
        }),
    ];
}
