import { describe, expect, it } from 'vitest';
import { getTokenExpiry, isTokenExpired } from './jwt';
import { makeToken, expiredToken, futureToken } from '@/test/tokens';

describe('getTokenExpiry', () => {
    it('returns the exp claim in milliseconds', () => {
        const token = makeToken({ exp: 1_700_000_000 });
        expect(getTokenExpiry(token)).toBe(1_700_000_000_000);
    });

    it('decodes a base64url payload containing - and _ characters', () => {
        // `~~~` base64-encodes to `fn5+` → base64url `fn5-`, forcing the +/- branch.
        const token = makeToken({ exp: 1_700_000_000, note: '~~~???' });
        expect(getTokenExpiry(token)).toBe(1_700_000_000_000);
    });

    it('returns null when the token has no exp claim', () => {
        expect(getTokenExpiry(makeToken({ sub: 'u1' }))).toBeNull();
    });

    it('returns null for a token that is not three segments', () => {
        expect(getTokenExpiry('not-a-jwt')).toBeNull();
        expect(getTokenExpiry('only.two')).toBeNull();
    });

    it('returns null when the payload segment is not valid base64/JSON', () => {
        expect(getTokenExpiry('aaa.!!!not-base64!!!.bbb')).toBeNull();
    });

    it('returns null for an empty string', () => {
        expect(getTokenExpiry('')).toBeNull();
    });
});

describe('isTokenExpired', () => {
    it('is true for a null or undefined token', () => {
        expect(isTokenExpired(null)).toBe(true);
        expect(isTokenExpired(undefined)).toBe(true);
    });

    it('is true for a malformed token (cannot be trusted)', () => {
        expect(isTokenExpired('garbage')).toBe(true);
    });

    it('is true for an expired token', () => {
        expect(isTokenExpired(expiredToken())).toBe(true);
    });

    it('is false for a token still within its exp', () => {
        expect(isTokenExpired(futureToken())).toBe(false);
    });

    it('treats the exact expiry instant as expired', () => {
        const exp = 1_700_000_000;
        expect(isTokenExpired(makeToken({ exp }), exp * 1000)).toBe(true);
    });
});
