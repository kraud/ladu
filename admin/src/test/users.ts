import { http, HttpResponse } from 'msw';
import type { UserDetail, UserListItem, UserListResponse } from '@/features/users/types';

export function makeListItem(overrides: Partial<UserListItem> = {}): UserListItem {
    return {
        id: 'u1',
        name: 'Kaja Tamm',
        email: 'kaja@example.com',
        username: 'kaja',
        verified: true,
        status: 'active',
        createdAt: '2026-03-03T10:15:00.000Z',
        lastLoginAt: '2026-09-29T08:30:00.000Z',
        lastLoginCountry: 'EE',
        lastSeenAt: '2026-09-29T09:00:00.000Z',
        bannedAt: null,
        deletedAt: null,
        hasPassword: true,
        hasGoogle: false,
        // `null`: this staff role may not see it (only a role with access.manage does).
        loginAllowed: null,
        ...overrides,
    };
}

export function makeDetail(overrides: Partial<UserDetail> = {}): UserDetail {
    return {
        id: 'u1',
        name: 'Kaja Tamm',
        email: 'kaja@example.com',
        username: 'kaja',
        languages: ['English', 'Estonian'],
        uiLanguage: 'English',
        nativeLanguage: 'Estonian',
        theme: 'dark',
        verified: true,
        status: 'active',
        createdAt: '2026-03-03T10:15:00.000Z',
        updatedAt: '2026-03-04T10:15:00.000Z',
        lastLoginAt: '2026-09-29T08:30:00.000Z',
        lastLoginCountry: 'EE',
        lastSeenAt: '2026-09-29T09:00:00.000Z',
        bannedAt: null,
        banReason: null,
        deletedAt: null,
        deletedByStaffName: null,
        hasPassword: true,
        loginAllowed: null,
        identities: [{ provider: 'google', emailAtLink: 'kaja@gmail.com', linkedAt: '2026-04-01T10:00:00.000Z' }],
        counts: { words: 12, translations: 30, tags: 2, friends: 1, practiceSessions: 3 },
        recentLogins: [{ id: 'l1', method: 'password', country: 'EE', createdAt: '2026-09-29T08:30:00.000Z' }],
        audit: null,
        ...overrides,
    };
}

/** Serves the users list, and records every request's query string. */
export function usersListHandler(
    respond: (params: URLSearchParams) => Partial<UserListResponse> | Response = () => ({}),
    requests: URLSearchParams[] = [],
) {
    return http.get('/api/admin/users', ({ request }) => {
        const params = new URL(request.url).searchParams;
        requests.push(params);
        const result = respond(params);
        if (result instanceof Response) return result;
        const items = result.items ?? [makeListItem()];
        return HttpResponse.json({ items, total: items.length, page: 1, pageSize: 25, ...result });
    });
}
