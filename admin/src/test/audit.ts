import { http, HttpResponse } from 'msw';
import type { AuditEntry, AuditFilters, AuditListResponse } from '@/features/audit/types';

export function makeEntry(overrides: Partial<AuditEntry> = {}): AuditEntry {
    return {
        id: 'a1',
        createdAt: '2026-10-01T10:15:00.000Z',
        action: 'user.ban',
        staffId: 'staff-1',
        staffName: 'Sam Staff',
        targetType: 'user',
        targetId: 'u1',
        targetStaffName: null,
        reason: 'spam links',
        metadata: { email: 'kaja@example.test', username: 'kaja' },
        ...overrides,
    };
}

export const FILTERS: AuditFilters = {
    actions: ['staff.create', 'user.ban', 'user.purge'],
    staff: [
        { id: '3c177fb8-235b-4259-9d77-40176ae26e77', name: 'Alice Admin' },
        { id: '8d2f1c3e-1111-4222-8333-444455556666', name: 'Bob Owner' },
    ],
};

/** Serves the audit list and the filter values, and records the query string of every list request. */
export function auditHandlers(
    respond: (params: URLSearchParams) => Partial<AuditListResponse> | Response = () => ({}),
    requests: URLSearchParams[] = [],
    filters: AuditFilters | Response = FILTERS,
) {
    return [
        http.get('/api/admin/audit/filters', () => (filters instanceof Response ? filters : HttpResponse.json(filters))),
        http.get('/api/admin/audit', ({ request }) => {
            const params = new URL(request.url).searchParams;
            requests.push(params);
            const result = respond(params);
            if (result instanceof Response) return result;
            const items = result.items ?? [makeEntry()];
            return HttpResponse.json({ items, total: items.length, page: 1, pageSize: 25, ...result });
        }),
    ];
}
