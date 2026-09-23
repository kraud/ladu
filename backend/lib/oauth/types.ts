/**
 * Shared OAuth types — kept in their own type-only file so they can use
 * plain `export type` without conflicting with the `export =` CJS-interop
 * syntax the runtime-value files in this directory use (TypeScript disallows
 * mixing `export =` with any other export in the same file).
 */

/** The state JWT's payload — see stateToken.ts. */
export type OAuthStatePayload = {
    typ: 'oauth_state';
    provider: string;
    verifier: string;
    nonce: string;
    jti: string;
};

/** What a provider adapter's `mapClaims` reduces a verified ID token down to. */
export type NormalizedIdentity = {
    sub: string;
    email: string;
    emailVerified: boolean;
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
