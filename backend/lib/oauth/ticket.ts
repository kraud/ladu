/**
 * Signup/link tickets — short-lived (10 min), purpose-typed JWTs the
 * callback hands the frontend when it can't log the user in directly (see
 * `OAuthTicketPayload` in ./types). Signed with the same `JWT_SECRET` as the
 * state JWT and the 30-day session JWT; the `typ` claim is what stops one
 * being accepted where another is expected, not a separate secret — same
 * design as stateToken.ts.
 *
 * Unlike the state JWT, a ticket carries no server-side binding (no cookie,
 * no `jti` check) — it's a self-contained bearer credential the browser
 * round-trips verbatim in a POST body, exactly as documented.
 */
import type { OAuthTicketPayload } from './types';

const jwt = require('jsonwebtoken');

const TICKET_TTL = '10m';

function issueTicket(payload: OAuthTicketPayload): string {
    return jwt.sign(payload, process.env.JWT_SECRET as string, {
        expiresIn: TICKET_TTL,
        algorithm: 'HS256',
    });
}

/** Throws (jsonwebtoken's own error, or ours for a wrong `typ`) on anything invalid, expired, or forged. */
function verifyTicket(token: string, expectedTyp: OAuthTicketPayload['typ']): OAuthTicketPayload {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string, {
        algorithms: ['HS256'],
    }) as OAuthTicketPayload;
    if (decoded.typ !== expectedTyp) {
        throw new Error('Invalid ticket type');
    }
    return decoded;
}

export = { issueTicket, verifyTicket };
