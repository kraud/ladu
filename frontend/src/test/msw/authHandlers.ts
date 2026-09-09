/**
 * A small in-memory fake of the four `userController` auth endpoints, for the
 * Phase-1 integration suite. Each call to `makeAuthHandlers()` gets its own
 * isolated store, so tests never share state.
 *
 * Responses mirror the live controller **after this slice's `_id` strip**:
 * `id` only, `serializeLoginUser` omits `nativeLanguage` when null, verify
 * returns `{ user, message }` with the token nested on `user`.
 */
import { http, HttpResponse } from 'msw';
import { makeToken } from '@/test/tokens';

export interface SeedUser {
    id?: string;
    name?: string;
    email: string;
    username?: string;
    password: string;
    verified?: boolean;
    languages?: string[];
    uiLanguage?: string;
    nativeLanguage?: string | null;
}

interface InternalUser {
    id: string;
    name: string;
    email: string;
    username: string;
    password: string;
    verified: boolean;
    languages: string[];
    uiLanguage: string;
    nativeLanguage: string | null;
}

const futureExp = () => Math.floor(Date.now() / 1000) + 30 * 24 * 3600;

let counter = 0;
const nextId = () => `user-${++counter}`;

export function makeAuthHandlers(seed: SeedUser[] = []) {
    const byEmail = new Map<string, InternalUser>();
    const verifyTokens = new Map<string, string>(); // token → userId
    const resetTokens = new Map<string, string>(); // token → userId
    const sessions = new Map<string, string>(); // bearer token → userId

    function put(u: SeedUser): InternalUser {
        const full: InternalUser = {
            id: u.id ?? nextId(),
            name: u.name ?? 'Test User',
            email: u.email,
            username: u.username ?? u.email.split('@')[0],
            password: u.password,
            verified: u.verified ?? false,
            languages: u.languages ?? [],
            uiLanguage: u.uiLanguage ?? 'English',
            nativeLanguage: u.nativeLanguage ?? null,
        };
        byEmail.set(full.email.toLowerCase(), full);
        return full;
    }

    for (const s of seed) put(s);

    const find = (email: unknown) =>
        typeof email === 'string' ? byEmail.get(email.toLowerCase()) : undefined;

    const publicUser = (u: InternalUser) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        username: u.username,
        languages: u.languages,
        uiLanguage: u.uiLanguage,
        nativeLanguage: u.nativeLanguage,
        verified: u.verified,
    });

    const issueToken = (u: InternalUser) => {
        const token = makeToken({ exp: futureExp(), sub: u.id });
        sessions.set(token, u.id);
        return token;
    };

    const userFromAuth = (request: Request) => {
        const header = request.headers.get('authorization') ?? '';
        const token = header.startsWith('Bearer ') ? header.slice(7) : '';
        const userId = sessions.get(token);
        if (!userId) return undefined;
        return [...byEmail.values()].find((u) => u.id === userId);
    };

    const handlers = [
        // POST /api/users — register
        http.post('*/api/users', async ({ request }) => {
            const body = (await request.json()) as Record<string, string>;
            if (!body.name || !body.email || !body.username || !body.password) {
                return HttpResponse.json({ message: 'Please add all fields' }, { status: 400 });
            }
            if (find(body.email)) {
                return HttpResponse.json({ message: 'Email already in use' }, { status: 400 });
            }
            if ([...byEmail.values()].some((u) => u.username.toLowerCase() === body.username.toLowerCase())) {
                return HttpResponse.json({ message: 'Username already in use' }, { status: 400 });
            }
            const u = put({ ...body, verified: false } as SeedUser);
            const verifyToken = `vt-${u.id}`;
            verifyTokens.set(verifyToken, u.id);
            return HttpResponse.json(publicUser(u), { status: 201 });
        }),

        // POST /api/users/login
        http.post('*/api/users/login', async ({ request }) => {
            const { email, password } = (await request.json()) as Record<string, string>;
            const u = find(email);
            if (!u || u.password !== password) {
                return HttpResponse.json({ message: 'Invalid credentials' }, { status: 400 });
            }
            const payload: Record<string, unknown> = { ...publicUser(u), token: issueToken(u) };
            if (u.nativeLanguage === null) delete payload.nativeLanguage;
            return HttpResponse.json(payload);
        }),

        // GET /api/users/:userId/verify/:tokenId
        http.get('*/api/users/:userId/verify/:tokenId', ({ params }) => {
            const { userId, tokenId } = params as { userId: string; tokenId: string };
            const u = [...byEmail.values()].find((x) => x.id === userId);
            if (!u) {
                return HttpResponse.json({ message: 'Invalid Link (no user match)' }, { status: 400 });
            }
            if (verifyTokens.get(tokenId) !== userId) {
                return HttpResponse.json({ message: 'Invalid Link (no token match)' }, { status: 400 });
            }
            u.verified = true;
            verifyTokens.delete(tokenId);
            return HttpResponse.json({
                user: { ...publicUser(u), token: issueToken(u) },
                message: 'Email verified successfully',
            });
        }),

        // POST /api/users/requestPasswordReset
        http.post('*/api/users/requestPasswordReset', async ({ request }) => {
            const { email } = (await request.json()) as Record<string, string>;
            const u = find(email);
            if (!u) {
                return HttpResponse.json(
                    { message: 'There is no user registered with the email given.' },
                    { status: 400 },
                );
            }
            const token = `rt-${u.id}-${resetTokens.size}`;
            resetTokens.set(token, u.id);
            return HttpResponse.json({});
        }),

        // PUT /api/users/updatePassword
        http.put('*/api/users/updatePassword', async ({ request }) => {
            const { userId, password, token } = (await request.json()) as Record<string, string>;
            const u = [...byEmail.values()].find((x) => x.id === userId);
            if (!u) {
                return HttpResponse.json({ message: 'Invalid Link (no user match).' }, { status: 400 });
            }
            if (resetTokens.get(token) !== userId) {
                return HttpResponse.json({ message: 'Invalid token.' }, { status: 400 });
            }
            u.password = password;
            resetTokens.delete(token);
            return HttpResponse.json({});
        }),

        // GET /api/users/me
        http.get('*/api/users/me', ({ request }) => {
            const u = userFromAuth(request);
            if (!u) return new HttpResponse(null, { status: 401 });
            return HttpResponse.json(publicUser(u));
        }),

        // PUT /api/users/updateUser
        http.put('*/api/users/updateUser', async ({ request }) => {
            const u = userFromAuth(request);
            if (!u) return new HttpResponse(null, { status: 401 });
            const body = (await request.json()) as Record<string, unknown>;
            if (!body.email || (body.email as string).toLowerCase() !== u.email.toLowerCase()) {
                return HttpResponse.json({ message: 'Invalid credentials' }, { status: 400 });
            }
            if (typeof body.name === 'string') u.name = body.name;
            if (typeof body.username === 'string') u.username = body.username;
            if (Array.isArray(body.languages)) u.languages = body.languages as string[];
            if (typeof body.uiLanguage === 'string') u.uiLanguage = body.uiLanguage;
            u.nativeLanguage = body.nativeLanguage === undefined ? null : (body.nativeLanguage as string | null);
            return HttpResponse.json(publicUser(u));
        }),
    ];

    return {
        handlers,
        /** The verification token minted by the most recent `register` for this email. */
        verifyTokenFor(email: string): string | undefined {
            const u = find(email);
            if (!u) return undefined;
            for (const [token, id] of verifyTokens) if (id === u.id) return token;
            return undefined;
        },
        resetTokenFor(email: string): string | undefined {
            const u = find(email);
            if (!u) return undefined;
            for (const [token, id] of resetTokens) if (id === u.id) return token;
            return undefined;
        },
        userFor(email: string) {
            const u = find(email);
            return u ? { ...u } : undefined;
        },
    };
}
