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
    // POST /api/auth/signup/complete (Phase 3) and POST /api/auth/link
    // (Phase 4) — both throw the same two messages for the same reasons.
    'Invalid or expired ticket': 'loginRegister:apiErrors.oauthInvalidTicket',
    'This Google account is already linked to an account': 'loginRegister:apiErrors.oauthAlreadyLinked',
    // DELETE /api/auth/identities/:id (Phase 5)
    'Cannot remove your only sign-in method': 'loginRegister:apiErrors.oauthLastMethod',
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
    // `oauth_not_linked` (Phase 2's placeholder for outcome (c)) is gone —
    // as of Phase 4, outcome (c) issues a real `oauth_link` ticket instead
    // of an error fragment. `oauth_failed` is a technical failure; this map
    // also covers the `#link-error=` fragment Phase 5's connect flow uses
    // (a distinct fragment key from `#error=`, but the same short codes and
    // the same lookup here — see oauthController.ts).
    oauth_failed: 'loginRegister:apiErrors.oauthFailed',
    // Connect-flow only — this identity is already linked, just not to the
    // account that started the connect attempt. Same user-facing meaning as
    // the ticket-based message above, so it reuses that key.
    oauth_already_linked: 'loginRegister:apiErrors.oauthAlreadyLinked',
};

/** The i18n key for an `OAuthCallbackError` (or any other failure, generically). Never throws. */
export function oauthErrorKey(error: unknown): string {
    if (error instanceof OAuthCallbackError && error.code in OAUTH_ERROR_CODE_TO_KEY) {
        return OAUTH_ERROR_CODE_TO_KEY[error.code];
    }
    return GENERIC_ERROR_KEY;
}
