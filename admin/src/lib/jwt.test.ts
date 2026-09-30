import { describe, expect, it } from 'vitest';
import { isTokenExpired } from '@/lib/jwt';
import { fakeToken } from '@/test/token';

describe('isTokenExpired', () => {
    it('is false for a token with time left', () => {
        expect(isTokenExpired(fakeToken(60))).toBe(false);
    });

    it('is true once the exp has passed', () => {
        expect(isTokenExpired(fakeToken(-1))).toBe(true);
    });

    it('treats a missing or malformed token as expired, without throwing', () => {
        expect(isTokenExpired(null)).toBe(true);
        expect(isTokenExpired('')).toBe(true);
        expect(isTokenExpired('not-a-jwt')).toBe(true);
        expect(isTokenExpired('a.%%%.c')).toBe(true);
        expect(isTokenExpired(`a.${btoa('{}')}.c`)).toBe(true);
    });
});
