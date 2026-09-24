/**
 * PKCE (Proof Key for Code Exchange, RFC 7636) helpers — the extra proof an
 * OAuth client presents alongside the authorization code so an intercepted
 * code alone can't be replayed by someone else. `start` generates a verifier
 * and sends only its SHA-256 challenge to the provider; `callback` sends the
 * original verifier back at token-exchange time, and the provider checks it
 * hashes to the challenge it was given.
 */
const { randomBytes, createHash } = require('crypto');

function generateCodeVerifier(): string {
    return randomBytes(32).toString('base64url');
}

function generateCodeChallenge(verifier: string): string {
    return createHash('sha256').update(verifier).digest('base64url');
}

/** Also used for the OIDC `nonce` param — same shape, different purpose (replay protection on the ID token itself). */
function generateNonce(): string {
    return randomBytes(16).toString('base64url');
}

export = { generateCodeVerifier, generateCodeChallenge, generateNonce };
