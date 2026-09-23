/**
 * A small in-memory fake of the `userController` auth endpoints, for the
 * Phase-1 integration suite, plus `GET /api/auth/providers` (Phase 2 of
 * oauth-login-strategy.md — `OAuthButtons` queries it on every
 * Login/RegisterPage render, so every caller needs it mocked, not just
 * OAuth-specific tests). Each call to `makeAuthHandlers()` gets its own
 * isolated store, so tests never share state.
 *
 * Responses mirror the live controller **after this slice's `_id` strip**:
 * `id` only, `serializeLoginUser` omits `nativeLanguage` when null, verify
 * returns `{ user, message }` with the token nested on `user`.
 */
import { http, HttpResponse } from 'msw';
import { makeToken } from '@/test/tokens';
import { decodeJwtPayload } from '@/lib/jwt';

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

const SUPPORTED_LANGUAGES = ['English', 'Spanish', 'German', 'Estonian'];
const isSupportedLanguage = (v: unknown): v is string =>
    typeof v === 'string' && SUPPORTED_LANGUAGES.includes(v);

/** `InternalUser.password` has no null variant — this never matches a real login attempt. */
const OAUTH_NO_PASSWORD = '<oauth-account-has-no-password>';

interface OAuthTicketPayload {
    typ?: string;
    provider?: string;
    sub?: string;
    email?: string;
    name?: string;
}

let counter = 0;
const nextId = () => `user-${++counter}`;

export function makeAuthHandlers(
    seed: SeedUser[] = [],
    options: { oauthProviders?: Record<string, boolean> } = {},
) {
    const oauthProviders = options.oauthProviders ?? { google: true };
    const byEmail = new Map<string, InternalUser>();
    const verifyTokens = new Map<string, string>(); // token → userId
    const resetTokens = new Map<string, string>(); // token → userId
    const sessions = new Map<string, string>(); // bearer token → userId
    const linkedIdentities = new Map<string, string>(); // `${provider}:${sub}` → userId

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
        // GET /api/auth/providers
        http.get('*/api/auth/providers', () => HttpResponse.json(oauthProviders)),

        // POST /api/auth/signup/complete (oauth-login-strategy.md Phase 3)
        http.post('*/api/auth/signup/complete', async ({ request }) => {
            const body = (await request.json()) as Record<string, unknown>;
            const ticket = typeof body.ticket === 'string' ? body.ticket : '';
            const payload = decodeJwtPayload<OAuthTicketPayload>(ticket);
            if (
                !payload ||
                payload.typ !== 'oauth_signup' ||
                typeof payload.email !== 'string' ||
                typeof payload.provider !== 'string' ||
                typeof payload.sub !== 'string'
            ) {
                return HttpResponse.json({ message: 'Invalid or expired ticket' }, { status: 400 });
            }

            if (!body.username) {
                return HttpResponse.json({ message: 'Please add all fields' }, { status: 400 });
            }
            const langs = body.languages;
            if (!Array.isArray(langs)) {
                return HttpResponse.json({ message: 'Please select at least 2 languages' }, { status: 400 });
            }
            if (!langs.every(isSupportedLanguage)) {
                return HttpResponse.json({ message: 'Invalid language selection' }, { status: 400 });
            }
            if (new Set(langs).size < 2) {
                return HttpResponse.json({ message: 'Please select at least 2 languages' }, { status: 400 });
            }
            if (
                body.uiLanguage !== undefined &&
                body.uiLanguage !== '' &&
                !isSupportedLanguage(body.uiLanguage)
            ) {
                return HttpResponse.json({ message: 'Invalid language selection' }, { status: 400 });
            }

            if (find(payload.email)) {
                return HttpResponse.json({ message: 'Email already in use' }, { status: 400 });
            }
            const username = body.username as string;
            if ([...byEmail.values()].some((u) => u.username.toLowerCase() === username.toLowerCase())) {
                return HttpResponse.json({ message: 'Username already in use' }, { status: 400 });
            }

            const u = put({
                name: payload.name ?? username,
                email: payload.email,
                username,
                password: OAUTH_NO_PASSWORD,
                verified: true,
                languages: [...new Set(langs as string[])],
                uiLanguage: isSupportedLanguage(body.uiLanguage) ? body.uiLanguage : 'English',
            });
            linkedIdentities.set(`${payload.provider}:${payload.sub}`, u.id);
            return HttpResponse.json({ ...publicUser(u), token: issueToken(u) }, { status: 201 });
        }),

        // POST /api/auth/link (oauth-login-strategy.md Phase 4)
        http.post('*/api/auth/link', async ({ request }) => {
            const body = (await request.json()) as Record<string, unknown>;
            const ticket = typeof body.ticket === 'string' ? body.ticket : '';
            const payload = decodeJwtPayload<OAuthTicketPayload>(ticket);
            if (
                !payload ||
                payload.typ !== 'oauth_link' ||
                typeof payload.email !== 'string' ||
                typeof payload.provider !== 'string' ||
                typeof payload.sub !== 'string'
            ) {
                return HttpResponse.json({ message: 'Invalid or expired ticket' }, { status: 400 });
            }

            const u = find(payload.email);
            if (!u || u.password === OAUTH_NO_PASSWORD) {
                return HttpResponse.json({ message: 'Invalid or expired ticket' }, { status: 400 });
            }
            if (u.password !== body.password) {
                return HttpResponse.json({ message: 'Invalid credentials' }, { status: 400 });
            }

            const key = `${payload.provider}:${payload.sub}`;
            if (linkedIdentities.has(key)) {
                return HttpResponse.json(
                    { message: 'This Google account is already linked to an account' },
                    { status: 400 },
                );
            }

            linkedIdentities.set(key, u.id);
            return HttpResponse.json({ ...publicUser(u), token: issueToken(u) });
        }),

        // POST /api/users — register
        http.post('*/api/users', async ({ request }) => {
            const body = (await request.json()) as Record<string, unknown>;
            if (!body.name || !body.email || !body.username || !body.password) {
                return HttpResponse.json({ message: 'Please add all fields' }, { status: 400 });
            }
            // Same language gate as `userController.registerUser`.
            const langs = body.languages;
            if (!Array.isArray(langs)) {
                return HttpResponse.json({ message: 'Please select at least 2 languages' }, { status: 400 });
            }
            if (!langs.every(isSupportedLanguage)) {
                return HttpResponse.json({ message: 'Invalid language selection' }, { status: 400 });
            }
            if (new Set(langs).size < 2) {
                return HttpResponse.json({ message: 'Please select at least 2 languages' }, { status: 400 });
            }
            if (
                body.uiLanguage !== undefined &&
                body.uiLanguage !== '' &&
                !isSupportedLanguage(body.uiLanguage)
            ) {
                return HttpResponse.json({ message: 'Invalid language selection' }, { status: 400 });
            }
            const email = body.email as string;
            if (find(email)) {
                return HttpResponse.json({ message: 'Email already in use' }, { status: 400 });
            }
            const username = body.username as string;
            if ([...byEmail.values()].some((u) => u.username.toLowerCase() === username.toLowerCase())) {
                return HttpResponse.json({ message: 'Username already in use' }, { status: 400 });
            }
            const u = put({
                name: body.name as string,
                email,
                username,
                password: body.password as string,
                verified: false,
                languages: [...new Set(langs as string[])],
                uiLanguage: isSupportedLanguage(body.uiLanguage) ? body.uiLanguage : 'English',
            });
            const verifyToken = `vt-${u.id}`;
            verifyTokens.set(verifyToken, u.id);
            return HttpResponse.json(publicUser(u), { status: 201 });
        }),

        // POST /api/users/login
        http.post('*/api/users/login', async ({ request }) => {
            const { email, password, uiLanguage } = (await request.json()) as Record<string, unknown>;
            const u = find(email);
            if (!u || u.password !== password) {
                return HttpResponse.json({ message: 'Invalid credentials' }, { status: 400 });
            }
            if (uiLanguage !== undefined && uiLanguage !== '' && !isSupportedLanguage(uiLanguage)) {
                return HttpResponse.json({ message: 'Invalid language selection' }, { status: 400 });
            }
            if (isSupportedLanguage(uiLanguage)) u.uiLanguage = uiLanguage;
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
            // Same language gate as `userController.updateUser`: when `languages`
            // is sent it must be >= 2 supported entries; omitting it keeps the
            // stored selection.
            if (body.languages !== undefined) {
                const langs = body.languages;
                if (!Array.isArray(langs) || !langs.every(isSupportedLanguage)) {
                    return HttpResponse.json(
                        { message: 'Invalid language selection' },
                        { status: 400 },
                    );
                }
                if (new Set(langs).size < 2) {
                    return HttpResponse.json(
                        { message: 'Please select at least 2 languages' },
                        { status: 400 },
                    );
                }
                u.languages = [...new Set(langs as string[])];
            }
            if (typeof body.name === 'string') u.name = body.name;
            if (typeof body.username === 'string') u.username = body.username;
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
