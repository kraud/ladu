import { describe, expect, it } from 'vitest';
import { authErrorKey, GENERIC_ERROR_KEY } from './errors';

/** Shape an axios-style error carrying the backend's `{ message }` body. */
const apiError = (message: string) => ({ response: { status: 400, data: { message } } });

describe('authErrorKey', () => {
    it.each([
        ['Invalid credentials', 'loginRegister:apiErrors.invalidCredentials'],
        ['Please add all fields', 'loginRegister:apiErrors.missingFields'],
        ['Email already in use', 'loginRegister:apiErrors.emailInUse'],
        ['Username already in use', 'loginRegister:apiErrors.usernameInUse'],
        ['Username already in use!', 'loginRegister:apiErrors.usernameInUse'],
        ['Invalid Link (no user match)', 'loginRegister:apiErrors.invalidLink'],
        ['Invalid Link (no token match)', 'loginRegister:apiErrors.invalidLink'],
        ['Invalid Link (no user match).', 'loginRegister:apiErrors.invalidLink'],
        ['Invalid format for UserId', 'loginRegister:apiErrors.invalidLink'],
        ['Invalid token.', 'loginRegister:apiErrors.invalidToken'],
        [
            'There is no user registered with the email given.',
            'loginRegister:apiErrors.noUserForEmail',
        ],
        ['Internal Server Error', GENERIC_ERROR_KEY],
    ])('maps %j → %j', (message, key) => {
        expect(authErrorKey(apiError(message))).toBe(key);
    });

    it('falls back to the generic key for an unrecognised message', () => {
        expect(authErrorKey(apiError('some brand new backend message'))).toBe(GENERIC_ERROR_KEY);
    });

    it('falls back to the generic key when there is no api error body', () => {
        expect(authErrorKey(new Error('network down'))).toBe(GENERIC_ERROR_KEY);
        expect(authErrorKey(undefined)).toBe(GENERIC_ERROR_KEY);
    });
});
