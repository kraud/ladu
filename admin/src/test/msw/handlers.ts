import { http, HttpResponse } from 'msw';
import { fakeToken } from '@/test/token';

export const staffFixture = {
    id: 'staff-1',
    email: 'staff@example.com',
    name: 'Sam Staff',
    role: 'support' as const,
};

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
];
