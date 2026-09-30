/**
 * Reads the `exp` claim of a staff token so the UI can drop an expired
 * session without a round trip. The signature is never checked here: the
 * server re-checks every request (middleware/staffAuth.ts). Total: a
 * malformed token counts as expired, never a throw.
 */
export function isTokenExpired(token: string | null | undefined, now: number = Date.now()): boolean {
    if (!token) return true;
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    try {
        const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
        const payload: unknown = JSON.parse(atob(padded));
        if (typeof payload !== 'object' || payload === null) return true;
        const exp = (payload as { exp?: unknown }).exp;
        if (typeof exp !== 'number' || !Number.isFinite(exp)) return true;
        return now >= exp * 1000;
    } catch {
        return true;
    }
}
