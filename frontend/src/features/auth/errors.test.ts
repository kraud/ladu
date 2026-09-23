import { describe, expect, it } from 'vitest';
import { authErrorKey, GENERIC_ERROR_KEY, OAuthCallbackError, oauthErrorKey } from './errors';

/** Shape an axios-style error carrying the backend's `{ message }` body. */
const apiError = (message: string) => ({ response: { status: 400, data: { message } } });

describe('authErrorKey', () => {
    it.each([
        ['Invalid credentials', 'loginRegister:apiErrors.invalidCredentials'],
        ['Sign in with Google', 'loginRegister:apiErrors.signInWithGoogle'],
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

describe('oauthErrorKey', () => {
    it.each([
        ['oauth_not_linked', 'loginRegister:apiErrors.oauthNotLinked'],
        ['oauth_failed', 'loginRegister:apiErrors.oauthFailed'],
    ])('maps %j → %j', (code, key) => {
        expect(oauthErrorKey(new OAuthCallbackError(code))).toBe(key);
    });

    it('falls back to the generic key for an unrecognised code', () => {
        expect(oauthErrorKey(new OAuthCallbackError('something_unexpected'))).toBe(GENERIC_ERROR_KEY);
    });

    it('falls back to the generic key for a non-OAuthCallbackError', () => {
        expect(oauthErrorKey(new Error('network down'))).toBe(GENERIC_ERROR_KEY);
        expect(oauthErrorKey(undefined)).toBe(GENERIC_ERROR_KEY);
    });
});
