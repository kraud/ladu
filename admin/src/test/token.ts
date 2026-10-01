/** An unsigned token with the given lifetime. The UI only reads `exp`; the server does the real check. */
export function fakeToken(expiresInSeconds = 8 * 60 * 60): string {
    const encode = (value: object) => btoa(JSON.stringify(value)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
    const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
    return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ id: 'staff-1', exp })}.signature`;
}
