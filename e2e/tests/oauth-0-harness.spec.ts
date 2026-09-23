import { test, expect } from '@playwright/test';
import { createHash, randomBytes } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify } from 'jose';

/**
 * OAuth Phase 0 — local OIDC stub harness (.dev-context/oauth-login-strategy.md §4).
 *
 * Proves the stub issuer (e2e/fixtures/oidc-stub/server.ts) implements enough
 * of the real discovery/authorize/token/jwks contract to stand in for Google
 * and Microsoft in later phases, and that the backend boots cleanly with
 * `OAUTH_ISSUER_GOOGLE`/`OAUTH_ISSUER_MICROSOFT` pointed at it — before any
 * OAuth code exists to consume those vars. No real Google/Microsoft account
 * is used or required anywhere in this suite.
 */

const OIDC_STUB_URL = process.env.OIDC_STUB_URL ?? 'http://localhost:4400';
const API_URL = process.env.E2E_API_URL ?? 'http://localhost:5001';

function base64url(input: Buffer): string {
    return input.toString('base64url');
}

test.describe('OAuth Phase 0 — stub issuer harness', () => {
    test('discovery document exposes the endpoints a real OIDC client needs', async ({ request }) => {
        const res = await request.get(`${OIDC_STUB_URL}/.well-known/openid-configuration`);
        expect(res.ok()).toBeTruthy();
        const body = await res.json();
        expect(body.issuer).toBe(OIDC_STUB_URL);
        expect(body.authorization_endpoint).toBe(`${OIDC_STUB_URL}/authorize`);
        expect(body.token_endpoint).toBe(`${OIDC_STUB_URL}/token`);
        expect(body.jwks_uri).toBe(`${OIDC_STUB_URL}/jwks`);
        expect(body.id_token_signing_alg_values_supported).toContain('RS256');
        expect(body.code_challenge_methods_supported).toContain('S256');
    });

    test('JWKS endpoint publishes a usable RSA signing key', async ({ request }) => {
        const res = await request.get(`${OIDC_STUB_URL}/jwks`);
        expect(res.ok()).toBeTruthy();
        const body = await res.json();
        expect(Array.isArray(body.keys)).toBe(true);
        expect(body.keys.length).toBeGreaterThan(0);
        const [key] = body.keys;
        expect(key.kty).toBe('RSA');
        expect(key.alg).toBe('RS256');
        expect(key.kid).toBeTruthy();
    });

    test('backend boots with OAUTH_ISSUER_GOOGLE/OAUTH_ISSUER_MICROSOFT set', async ({ request }) => {
        const res = await request.get(`${API_URL}/`);
        expect(res.ok()).toBeTruthy();
    });

    test('self-test: full authorize -> token round trip yields a verifiable ID token', async ({ request }) => {
        // Exercises the stub's own PKCE + signing logic directly (bypassing the
        // backend, which has no OAuth client code yet) — Phase 2 depends on this
        // exact contract, so a bug here should surface now, not mid-Phase-2.
        const verifier = base64url(randomBytes(32));
        const challenge = base64url(createHash('sha256').update(verifier).digest());
        const redirectUri = 'http://localhost:5173/auth/callback';
        const clientId = 'phase-0-self-test';
        const nonce = base64url(randomBytes(8));
        const email = 'oauth-phase0@ladu.test';

        const authorizeUrl = new URL(`${OIDC_STUB_URL}/authorize`);
        authorizeUrl.searchParams.set('client_id', clientId);
        authorizeUrl.searchParams.set('redirect_uri', redirectUri);
        authorizeUrl.searchParams.set('response_type', 'code');
        authorizeUrl.searchParams.set('scope', 'openid email profile');
        authorizeUrl.searchParams.set('state', 'phase0-state');
        authorizeUrl.searchParams.set('nonce', nonce);
        authorizeUrl.searchParams.set('code_challenge', challenge);
        authorizeUrl.searchParams.set('code_challenge_method', 'S256');
        authorizeUrl.searchParams.set('login_hint', email);

        const authorizeRes = await request.get(authorizeUrl.toString(), { maxRedirects: 0 });
        expect(authorizeRes.status()).toBe(302);
        const location = new URL(authorizeRes.headers()['location']);
        expect(location.searchParams.get('state')).toBe('phase0-state');
        const code = location.searchParams.get('code');
        expect(code).toBeTruthy();

        const tokenRes = await request.post(`${OIDC_STUB_URL}/token`, {
            form: {
                grant_type: 'authorization_code',
                code: code!,
                redirect_uri: redirectUri,
                client_id: clientId,
                code_verifier: verifier,
            },
        });
        expect(tokenRes.ok()).toBeTruthy();
        const tokenBody = await tokenRes.json();
        expect(tokenBody.token_type).toBe('Bearer');
        expect(typeof tokenBody.id_token).toBe('string');

        const jwks = createRemoteJWKSet(new URL(`${OIDC_STUB_URL}/jwks`));
        const { payload } = await jwtVerify(tokenBody.id_token, jwks, {
            issuer: OIDC_STUB_URL,
            audience: clientId,
        });
        expect(payload.email).toBe(email);
        expect(payload.email_verified).toBe(true);
        expect(payload.nonce).toBe(nonce);
        expect(payload.sub).toBeTruthy();
    });

    test('token exchange rejects a mismatched PKCE verifier', async ({ request }) => {
        const challenge = base64url(createHash('sha256').update('correct-verifier').digest());
        const redirectUri = 'http://localhost:5173/auth/callback';
        const clientId = 'phase-0-self-test';

        const authorizeUrl = new URL(`${OIDC_STUB_URL}/authorize`);
        authorizeUrl.searchParams.set('client_id', clientId);
        authorizeUrl.searchParams.set('redirect_uri', redirectUri);
        authorizeUrl.searchParams.set('code_challenge', challenge);
        authorizeUrl.searchParams.set('code_challenge_method', 'S256');

        const authorizeRes = await request.get(authorizeUrl.toString(), { maxRedirects: 0 });
        const location = new URL(authorizeRes.headers()['location']);
        const code = location.searchParams.get('code')!;

        const tokenRes = await request.post(`${OIDC_STUB_URL}/token`, {
            form: {
                grant_type: 'authorization_code',
                code,
                redirect_uri: redirectUri,
                client_id: clientId,
                code_verifier: 'wrong-verifier',
            },
        });
        expect(tokenRes.status()).toBe(400);
    });
});
