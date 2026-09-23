/**
 * Local stub OIDC issuer — OAuth Phase 0 (.dev-context/oauth-login-strategy.md §4).
 *
 * Implements the same discovery/authorize/token/jwks contract a real OIDC
 * provider (Google) exposes, so the backend's OAuth client code (discovery,
 * JWKS fetch + cache, PKCE code exchange, ID-token verification) runs
 * against something that behaves like a real issuer in CI, instead of being
 * mocked away. `/authorize` auto-approves — no consent screen — since there
 * is no honest way to drive a real one from a headless test run; that is
 * the one deliberate place this stub diverges from a real provider.
 *
 * Run standalone: `npm run stub:oidc` from `e2e/` (wired as a third
 * `webServer` entry in `playwright.config.ts`). `OIDC_STUB_PORT` selects the
 * port, letting a second instance run alongside this one if a future
 * provider ever needs its own.
 *
 * Test-only knobs on `/authorize` a real provider has no equivalent for,
 * used by e2e specs to control which identity signs in:
 *   `login_hint` — the email the minted ID token carries (default a fixed
 *                   stub address).
 *   `sub`        — the subject claim (default derived from the email).
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomBytes, createHash } from 'node:crypto';
import { generateKeyPair, exportJWK, calculateJwkThumbprint, SignJWT } from 'jose';

const PORT = Number(process.env.OIDC_STUB_PORT ?? 4400);
const ISSUER = `http://localhost:${PORT}`;
const CODE_TTL_MS = 60_000;
const ID_TOKEN_TTL_S = 600;

type AuthCodeRecord = {
    codeChallenge: string;
    redirectUri: string;
    clientId: string;
    nonce: string | undefined;
    sub: string;
    email: string;
    expiresAt: number;
};

const authCodes = new Map<string, AuthCodeRecord>();

const { publicKey, privateKey } = await generateKeyPair('RS256', { extractable: true });
const publicJwk = await exportJWK(publicKey);
const kid = await calculateJwkThumbprint(publicJwk);
publicJwk.kid = kid;
publicJwk.use = 'sig';
publicJwk.alg = 'RS256';

function sendJson(res: ServerResponse, status: number, body: unknown): void {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage): Promise<string> {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    return Buffer.concat(chunks).toString('utf8');
}

function base64url(input: Buffer): string {
    return input.toString('base64url');
}

function handleDiscovery(res: ServerResponse): void {
    sendJson(res, 200, {
        issuer: ISSUER,
        authorization_endpoint: `${ISSUER}/authorize`,
        token_endpoint: `${ISSUER}/token`,
        jwks_uri: `${ISSUER}/jwks`,
        response_types_supported: ['code'],
        subject_types_supported: ['public'],
        id_token_signing_alg_values_supported: ['RS256'],
        scopes_supported: ['openid', 'email', 'profile'],
        code_challenge_methods_supported: ['S256'],
    });
}

function handleJwks(res: ServerResponse): void {
    sendJson(res, 200, { keys: [publicJwk] });
}

function handleAuthorize(url: URL, res: ServerResponse): void {
    const params = url.searchParams;
    const redirectUri = params.get('redirect_uri');
    const codeChallenge = params.get('code_challenge');
    const clientId = params.get('client_id');
    if (!redirectUri || !codeChallenge || !clientId) {
        sendJson(res, 400, { error: 'invalid_request' });
        return;
    }

    const email = params.get('login_hint') ?? 'stub-user@ladu.test';
    const sub = params.get('sub') ?? `stub-${createHash('sha256').update(email).digest('hex').slice(0, 16)}`;

    const code = base64url(randomBytes(24));
    authCodes.set(code, {
        codeChallenge,
        redirectUri,
        clientId,
        nonce: params.get('nonce') ?? undefined,
        sub,
        email,
        expiresAt: Date.now() + CODE_TTL_MS,
    });

    const redirect = new URL(redirectUri);
    redirect.searchParams.set('code', code);
    const state = params.get('state');
    if (state) redirect.searchParams.set('state', state);
    res.writeHead(302, { Location: redirect.toString() });
    res.end();
}

async function handleToken(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const raw = await readBody(req);
    const form = new URLSearchParams(raw);

    const code = form.get('code');
    const verifier = form.get('code_verifier');
    const record = code ? authCodes.get(code) : undefined;

    if (!code || !verifier || !record) {
        sendJson(res, 400, { error: 'invalid_grant' });
        return;
    }
    authCodes.delete(code); // one-time use, regardless of outcome below

    if (record.expiresAt < Date.now()) {
        sendJson(res, 400, { error: 'invalid_grant', error_description: 'code expired' });
        return;
    }
    if (form.get('redirect_uri') !== record.redirectUri || form.get('client_id') !== record.clientId) {
        sendJson(res, 400, { error: 'invalid_grant', error_description: 'redirect_uri/client_id mismatch' });
        return;
    }
    const expectedChallenge = base64url(createHash('sha256').update(verifier).digest());
    if (expectedChallenge !== record.codeChallenge) {
        sendJson(res, 400, { error: 'invalid_grant', error_description: 'PKCE verification failed' });
        return;
    }

    const now = Math.floor(Date.now() / 1000);
    const idToken = await new SignJWT({
        email: record.email,
        email_verified: true,
        nonce: record.nonce,
    })
        .setProtectedHeader({ alg: 'RS256', kid })
        .setIssuer(ISSUER)
        .setAudience(record.clientId)
        .setSubject(record.sub)
        .setIssuedAt(now)
        .setExpirationTime(now + ID_TOKEN_TTL_S)
        .sign(privateKey);

    sendJson(res, 200, {
        access_token: base64url(randomBytes(18)),
        token_type: 'Bearer',
        expires_in: ID_TOKEN_TTL_S,
        id_token: idToken,
    });
}

const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', ISSUER);

    if (req.method === 'GET' && url.pathname === '/.well-known/openid-configuration') {
        return handleDiscovery(res);
    }
    if (req.method === 'GET' && url.pathname === '/jwks') {
        return handleJwks(res);
    }
    if (req.method === 'GET' && url.pathname === '/authorize') {
        return handleAuthorize(url, res);
    }
    if (req.method === 'POST' && url.pathname === '/token') {
        handleToken(req, res).catch((err) => {
            console.error('OIDC stub /token error:', err);
            sendJson(res, 500, { error: 'server_error' });
        });
        return;
    }

    sendJson(res, 404, { error: 'not_found' });
});

server.listen(PORT, () => {
    console.log(`OIDC stub issuer listening on ${ISSUER}`);
});
