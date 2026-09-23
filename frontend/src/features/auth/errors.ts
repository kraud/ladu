/**
 * Backend error → i18n key.
 *
 * `backend/middleware/errorMiddleware.js` only ever emits `{ message: string }`
 * — no code, no field. So matching the message string is the only option
 * available. Keeping that string-matching in one file stops it leaking into
 * every hook, and gives one place to update when a controller message changes.
 *
 * Every message below is a verbatim `throw new Error(...)` from
 * `userController.ts` (login / register / verify / requestPasswordReset /
 * updatePassword). Anything unrecognised falls back to the generic key.
 */
import { getApiErrorMessage } from '@/api/types';

export const GENERIC_ERROR_KEY = 'common:errors.somethingWrong';

const MESSAGE_TO_KEY: Record<string, string> = {
    // login
    'Invalid credentials': 'loginRegister:apiErrors.invalidCredentials',
    'Sign in with Google': 'loginRegister:apiErrors.signInWithGoogle',
    // register
    'Please add all fields': 'loginRegister:apiErrors.missingFields',
    'Email already in use': 'loginRegister:apiErrors.emailInUse',
    'Username already in use': 'loginRegister:apiErrors.usernameInUse',
    'Username already in use!': 'loginRegister:apiErrors.usernameInUse',
    // language selection (defence-in-depth — the UI already gates both rules)
    'Please select at least 2 languages': 'loginRegister:apiErrors.notEnoughLanguages',
    'Invalid language selection': 'loginRegister:apiErrors.invalidLanguage',
    // verify email
    'Invalid Link (no user match)': 'loginRegister:apiErrors.invalidLink',
    'Invalid Link (no token match)': 'loginRegister:apiErrors.invalidLink',
    // request password reset
    'There is no user registered with the email given.': 'loginRegister:apiErrors.noUserForEmail',
    // set new password
    'Invalid format for UserId': 'loginRegister:apiErrors.invalidLink',
    'Invalid Link (no user match).': 'loginRegister:apiErrors.invalidLink',
    'Invalid token.': 'loginRegister:apiErrors.invalidToken',
    // server-side catch-alls
    'Internal Server Error': GENERIC_ERROR_KEY,
};

/** The i18n key for whatever the backend threw. Never throws; always returns a key. */
export function authErrorKey(error: unknown): string {
    const message = getApiErrorMessage(error);
    if (message && message in MESSAGE_TO_KEY) return MESSAGE_TO_KEY[message];
    return GENERIC_ERROR_KEY;
}

/**
 * Thrown by `useOAuthCallback` for the codes `oauthController.ts` puts on the
 * `/auth/callback#error=<code>` fragment — a short code, not a message, since
 * this one never passes through `errorMiddleware.js`'s `{ message }` shape at
 * all (it arrives via a URL fragment from a browser redirect, not a JSON
 * error response).
 */
export class OAuthCallbackError extends Error {
    constructor(public readonly code: string) {
        super(code);
        this.name = 'OAuthCallbackError';
    }
}

const OAUTH_ERROR_CODE_TO_KEY: Record<string, string> = {
    // Phase 2's own scope limit (oauth-login-strategy.md) — a real, expected
    // outcome until Phases 3/4 ship signup and linking.
    oauth_not_linked: 'loginRegister:apiErrors.oauthNotLinked',
    oauth_failed: 'loginRegister:apiErrors.oauthFailed',
};

/** The i18n key for an `OAuthCallbackError` (or any other failure, generically). Never throws. */
export function oauthErrorKey(error: unknown): string {
    if (error instanceof OAuthCallbackError && error.code in OAUTH_ERROR_CODE_TO_KEY) {
        return OAUTH_ERROR_CODE_TO_KEY[error.code];
    }
    return GENERIC_ERROR_KEY;
}
