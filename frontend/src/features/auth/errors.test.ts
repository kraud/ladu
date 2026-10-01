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
        ['Invalid or expired ticket', 'loginRegister:apiErrors.oauthInvalidTicket'],
        [
            'This Google account is already linked to an account',
            'loginRegister:apiErrors.oauthAlreadyLinked',
        ],
        ['Internal Server Error', GENERIC_ERROR_KEY],
    ])('maps %j → %j', (message, key) => {
        expect(authErrorKey(apiError(message))).toBe(key);
    });

    it('maps a machine-readable code from the access gates, whatever the message says', () => {
        const coded = (code: string, message = 'whatever') => ({ response: { status: 403, data: { message, code } } });
        expect(authErrorKey(coded('registration_closed'))).toBe('loginRegister:access.registrationClosed');
        expect(authErrorKey(coded('registration_not_invited'))).toBe('loginRegister:access.registrationNotInvited');
        // A code wins over a message that would map to something else.
        expect(authErrorKey(coded('registration_closed', 'Email already in use'))).toBe(
            'loginRegister:access.registrationClosed',
        );
    });

    it('ignores an unknown code and falls back to the message', () => {
        const error = { response: { status: 400, data: { message: 'Email already in use', code: 'new_code' } } };
        expect(authErrorKey(error)).toBe('loginRegister:apiErrors.emailInUse');
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
    it('maps oauth_failed', () => {
        expect(oauthErrorKey(new OAuthCallbackError('oauth_failed'))).toBe('loginRegister:apiErrors.oauthFailed');
    });

    it('falls back to the generic key for an unrecognised code', () => {
        expect(oauthErrorKey(new OAuthCallbackError('something_unexpected'))).toBe(GENERIC_ERROR_KEY);
    });

    it('falls back to the generic key for a non-OAuthCallbackError', () => {
        expect(oauthErrorKey(new Error('network down'))).toBe(GENERIC_ERROR_KEY);
        expect(oauthErrorKey(undefined)).toBe(GENERIC_ERROR_KEY);
    });
});
