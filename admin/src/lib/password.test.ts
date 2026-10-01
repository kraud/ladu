import { describe, expect, it } from 'vitest';
import { generatePassword, MAX_PASSWORD_BYTES, MIN_PASSWORD_LENGTH, passwordProblem } from '@/lib/password';

describe('passwordProblem', () => {
    it('accepts 12 characters and refuses 11', () => {
        expect(passwordProblem('a'.repeat(MIN_PASSWORD_LENGTH))).toBeNull();
        expect(passwordProblem('a'.repeat(MIN_PASSWORD_LENGTH - 1))).toMatch(/at least 12/);
    });

    it('counts bytes, not characters, for the upper limit', () => {
        expect(passwordProblem('a'.repeat(MAX_PASSWORD_BYTES))).toBeNull();
        expect(passwordProblem('a'.repeat(MAX_PASSWORD_BYTES + 1))).toMatch(/at most 72 bytes/);
        // 37 two-byte characters are 74 bytes, but only 37 characters.
        expect(passwordProblem('é'.repeat(37))).toMatch(/at most 72 bytes/);
    });
});

describe('generatePassword', () => {
    it('makes a password that the rules accept, from letters and digits that are not ambiguous', () => {
        for (let i = 0; i < 50; i += 1) {
            const password = generatePassword();
            expect(password).toHaveLength(20);
            expect(passwordProblem(password)).toBeNull();
            expect(password).toMatch(/^[abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789]+$/);
        }
    });

    it('does not make the same password twice', () => {
        const all = new Set(Array.from({ length: 200 }, generatePassword));
        expect(all.size).toBe(200);
    });
});
