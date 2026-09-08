/** Minimal unsigned JWT builder for tests — only the `exp` claim matters here. */
function base64url(input: string): string {
    return btoa(input).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function makeToken(payload: Record<string, unknown>): string {
    const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const body = base64url(JSON.stringify(payload));
    return `${header}.${body}.testsignature`;
}

/** Token that expired an hour ago. */
export const expiredToken = (): string => makeToken({ exp: Math.floor(Date.now() / 1000) - 3600 });

/** Token valid for another 30 days (mirrors the backend's `expiresIn`). */
export const futureToken = (): string => makeToken({ exp: Math.floor(Date.now() / 1000) + 30 * 24 * 3600 });
