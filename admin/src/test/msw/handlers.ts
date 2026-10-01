import { http, HttpResponse } from 'msw';
import { fakeToken } from '@/test/token';
import { makeStats } from '@/test/stats';

import type { StaffRole, StaffUser } from '@/stores/authStore';

// Mirrors backend/lib/adminPermissions.ts. The UI reads the list from the
// server, so this is only test data, not a second source of truth.
const PERMISSIONS_BY_ROLE: Record<StaffRole, string[]> = {
    owner: ['users.read', 'users.ban', 'users.email', 'users.delete', 'users.purge', 'health.read', 'audit.read', 'staff.manage'],
    admin: ['users.read', 'users.ban', 'users.email', 'users.delete', 'health.read', 'audit.read'],
    support: ['users.read', 'users.ban', 'users.email', 'health.read'],
    viewer: ['users.read', 'health.read'],
};

export function makeStaff(role: StaffRole, overrides: Partial<StaffUser> = {}): StaffUser {
    return {
        id: 'staff-1',
        email: 'staff@example.com',
        name: 'Sam Staff',
        role,
        permissions: PERMISSIONS_BY_ROLE[role],
        mustChangePassword: false,
        ...overrides,
    };
}

export const staffFixture = makeStaff('support');

/** Default happy-path handlers. A test overrides one with `server.use(...)`. */
export const handlers = [
    http.post('/api/admin/auth/login', async ({ request }) => {
        const body = (await request.json()) as { email?: string; password?: string };
        if (body.email === staffFixture.email && body.password === 'correct-password') {
            return HttpResponse.json({ ...staffFixture, token: fakeToken() });
        }
        return HttpResponse.json({ message: 'Invalid credentials' }, { status: 400 });
    }),
    http.get('/api/admin/auth/me', () => HttpResponse.json(staffFixture)),
    // The home page loads the statistics; a test that cares about them overrides this.
    http.get('/api/admin/stats', () => HttpResponse.json(makeStats())),
];
