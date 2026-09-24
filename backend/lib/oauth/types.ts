/**
 * Shared OAuth types — kept in their own type-only file so they can use
 * plain `export type` without conflicting with the `export =` CJS-interop
 * syntax the runtime-value files in this directory use (TypeScript disallows
 * mixing `export =` with any other export in the same file).
 */

/**
 * The state JWT's payload — see stateToken.ts. `userId` is only present for
 * the protected "connect a second provider from the Account page" start
 * flow (Phase 5) — its absence is exactly what distinguishes that flow from
 * an ordinary public login attempt in the shared `/callback` handler.
 */
export type OAuthStatePayload = {
    typ: 'oauth_state';
    provider: string;
    verifier: string;
    nonce: string;
    jti: string;
    userId?: string;
};

/** What a provider adapter's `mapClaims` reduces a verified ID token down to. */
export type NormalizedIdentity = {
    sub: string;
    email: string;
    emailVerified: boolean;
    /** Falls back to the email's local part on a token that omits it (see providers/google.ts). */
    name: string;
};

/** One provider adapter — see providers/google.ts. */
export type OAuthProvider = {
    name: string;
    clientId: string;
    clientSecret: string;
    issuer: string;
    scope: string;
    mapClaims: (claims: Record<string, unknown>) => NormalizedIdentity;
};

/**
 * The signup/link ticket's payload — a short-lived (10 min), purpose-typed
 * JWT the callback hands the frontend when it can't log the user in directly
 * (oauth-login-strategy.md "Rule": never accepted where a session JWT or the
 * state JWT is expected, and vice versa). `oauth_signup` ships in Phase 3;
 * `oauth_link` is Phase 4's.
 */
export type OAuthTicketPayload = {
    typ: 'oauth_signup' | 'oauth_link';
    provider: string;
    sub: string;
    email: string;
    name: string;
};
