/**
 * The Google provider adapter — the one provider-specific piece the
 * generic `oauthController.ts` flow depends on (issuer, scope, and how to
 * read the normalized identity off a verified ID token).
 */
import type { NormalizedIdentity, OAuthProvider } from '../types';

function mapGoogleClaims(claims: Record<string, unknown>): NormalizedIdentity {
    const { sub, email, email_verified: emailVerified, name } = claims;
    if (typeof sub !== 'string' || typeof email !== 'string') {
        throw new Error('Google ID token missing sub/email');
    }
    return {
        sub,
        email,
        emailVerified: emailVerified === true,
        // Google includes `name` under the `profile` scope this app requests
        // (see `scope` below); fall back to the email's local part on the
        // rare token that omits it — same fallback the signup-completion
        // screen uses for the username prefill (Phase 3).
        name: typeof name === 'string' && name.trim() !== '' ? name : email.split('@')[0],
    };
}

/** `undefined` when GOOGLE_CLIENT_ID/SECRET aren't set — the caller treats that as "not configured". */
function getGoogleProvider(): OAuthProvider | undefined {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) return undefined;

    // OAUTH_ISSUER_GOOGLE points discovery at the Phase 0 stub instead of the
    // real provider — accepted only outside production (oauth-login-strategy.md
    // Phase 0), so a misconfigured env var can never redirect a real deploy's
    // login flow at an attacker-controlled issuer.
    const issuer =
        process.env.NODE_ENV !== 'production' && process.env.OAUTH_ISSUER_GOOGLE
            ? process.env.OAUTH_ISSUER_GOOGLE
            : 'https://accounts.google.com';

    return {
        name: 'google',
        clientId,
        clientSecret,
        issuer,
        scope: 'openid email profile',
        mapClaims: mapGoogleClaims,
    };
}

export = { getGoogleProvider };
