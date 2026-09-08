/**
 * JWT expiry inspection — the *one* seam that decides "is this session still
 * good?". Paired with the router's `_protected.beforeLoad`.
 *
 * Study §8.4 #5: the old `parseJwt` returned `null` on a malformed token and the
 * caller then dereferenced `.exp` and crashed the whole app. Here every helper
 * is total — malformed input yields `null` / `true`, never a throw.
 */

interface JwtPayload {
    /** seconds since epoch, per RFC 7519 */
    exp?: number;
}

/** base64url → JSON, tolerant of missing padding. Returns null on any failure. */
function decodePayload(token: string): JwtPayload | null {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    try {
        const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
        const json = atob(padded);
        const parsed: unknown = JSON.parse(json);
        if (typeof parsed !== 'object' || parsed === null) return null;
        return parsed as JwtPayload;
    } catch {
        return null;
    }
}

/**
 * Expiry of `token` in **milliseconds since epoch**, or `null` if the token is
 * malformed or carries no `exp` claim.
 */
export function getTokenExpiry(token: string): number | null {
    const payload = decodePayload(token);
    if (!payload || typeof payload.exp !== 'number' || !Number.isFinite(payload.exp)) {
        return null;
    }
    return payload.exp * 1000;
}

/**
 * True when there is no usable session: token absent, malformed, or past its
 * `exp`. A malformed token counts as expired — we cannot trust it, so we force
 * re-login rather than let it through.
 */
export function isTokenExpired(token: string | null | undefined, now: number = Date.now()): boolean {
    if (!token) return true;
    const expiry = getTokenExpiry(token);
    if (expiry === null) return true;
    return now >= expiry;
}
