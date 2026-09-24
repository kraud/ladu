/**
 * OIDC discovery + JWKS, cached in memory per issuer — both Google and the
 * Phase 0 stub implement the same `.well-known/openid-configuration`
 * contract, so this file is provider-agnostic.
 *
 * `getJwks` wraps `jose`'s `createRemoteJWKSet`, which already handles its
 * own JWKS caching/refresh internally; the wrapper just avoids constructing
 * a new one (and its own fetch) per request for the same `jwks_uri`.
 */
const { createRemoteJWKSet } = require('jose');

type DiscoveryDocument = {
    issuer: string;
    authorization_endpoint: string;
    token_endpoint: string;
    jwks_uri: string;
};

const discoveryCache = new Map<string, Promise<DiscoveryDocument>>();
const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

async function getDiscoveryDocument(issuer: string): Promise<DiscoveryDocument> {
    const existing = discoveryCache.get(issuer);
    if (existing) return existing;

    const fetched: Promise<DiscoveryDocument> = fetch(`${issuer}/.well-known/openid-configuration`).then(
        async (res: Response) => {
            if (!res.ok) {
                throw new Error(`OIDC discovery failed for ${issuer}: ${res.status}`);
            }
            return (await res.json()) as DiscoveryDocument;
        },
    );
    // A rejected fetch must not poison every later login attempt until restart.
    fetched.catch(() => discoveryCache.delete(issuer));
    discoveryCache.set(issuer, fetched);
    return fetched;
}

function getJwks(jwksUri: string) {
    const existing = jwksCache.get(jwksUri);
    if (existing) return existing;

    const jwks = createRemoteJWKSet(new URL(jwksUri));
    jwksCache.set(jwksUri, jwks);
    return jwks;
}

export = { getDiscoveryDocument, getJwks };
