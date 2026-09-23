/**
 * The OAuth state JWT — a short-lived, purpose-typed token (`typ: 'oauth_state'`)
 * carrying the PKCE verifier, nonce, and provider between `/start` and
 * `/callback`, without a server-side session store. Issued into an
 * `HttpOnly` cookie at `/start`; only its `jti` is ever sent to the provider
 * as the OAuth `state` parameter (oauth-login-strategy.md "State, not
 * sessions").
 *
 * Signed with the same `JWT_SECRET` as the 30-day session JWT
 * (`userController.generateToken`) — the `typ` claim is what stops one being
 * accepted where the other is expected, not a separate secret.
 */
import type { OAuthStatePayload } from './types';

const jwt = require('jsonwebtoken');

const STATE_TTL = '10m';

function issueStateToken(payload: Omit<OAuthStatePayload, 'typ'>): string {
    return jwt.sign({ ...payload, typ: 'oauth_state' }, process.env.JWT_SECRET as string, {
        expiresIn: STATE_TTL,
        algorithm: 'HS256',
    });
}

/** Throws (jsonwebtoken's own error, or ours for a wrong `typ`) on anything invalid, expired, or forged. */
function verifyStateToken(token: string): OAuthStatePayload {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string, {
        algorithms: ['HS256'],
    }) as OAuthStatePayload;
    if (decoded.typ !== 'oauth_state') {
        throw new Error('Invalid token type');
    }
    return decoded;
}

export = { issueStateToken, verifyStateToken };
