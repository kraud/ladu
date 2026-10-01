import type { Theme } from '@/lib/theme';

/**
 * Auth request/response contracts — re-pinned against the live
 * `backend/controllers/userController.ts` (2026-09-08), not the snapshot.
 *
 * `id` only. The `_id` MongoDB alias was stripped from every auth serializer
 * in this slice (`serializeLoginUser` / `publicUserResponse` / `serializeUser`
 * and `authMiddleware`), so nothing here reads or falls back to `_id`
 * (.context/plans/new-repo-build-plan.md §4).
 */

/** `POST /api/users/login` body. */
export interface LoginRequest {
    email: string;
    password: string;
    /**
     * The UI language chosen on the login screen. Persisted to the user row so
     * the app opens in that language (`userController.loginUser`). Optional —
     * omitted, the stored preference is left untouched.
     */
    uiLanguage?: string;
    /**
     * The theme, sent ONLY when the user chose one on this browser
     * (`themeForRequest()`). Saved to the row; omitted, the stored theme is kept
     * and returned.
     */
    theme?: Theme;
}

/** `POST /api/users` body — `password2` is validated client-side and never sent. */
export interface RegisterRequest {
    name: string;
    username: string;
    email: string;
    password: string;
    /** Language labels the user manages — >= 2 required, selection order preserved. */
    languages: string[];
    /** The UI language chosen on the register screen; stored on the new row. */
    uiLanguage: string;
    /** The theme chosen on the register screen, if any; stored on the new row. */
    theme?: Theme;
}

/** `GET /api/users/:userId/verify/:tokenId` path params. */
export interface VerifyEmailParams {
    userId: string;
    tokenId: string;
}

/** `POST /api/users/requestPasswordReset` body. */
export interface RequestResetRequest {
    email: string;
}

/**
 * `PUT /api/users/updatePassword` body. The key is **`token`**, not `tokenId`
 * — a contract the old app carried and the controller still reads verbatim
 * (`userController.ts` `updatePassword`: `const { userId, password, token }`).
 */
export interface SetPasswordRequest {
    userId: string;
    password: string;
    token: string;
}

/**
 * `PUT /api/users/updateUser` body. `email` is a self-confirmation field the
 * endpoint checks but never writes; `nativeLanguage` MUST be sent explicitly
 * on every call — the controller does `nativeLanguage === undefined ? null`,
 * so omitting the key silently clears it.
 */
export interface UpdateProfileRequest {
    email: string;
    name: string;
    username: string;
    languages: string[];
    uiLanguage: string;
    nativeLanguage: string | null;
    /** Optional: an edit that omits it keeps the stored theme (unlike `nativeLanguage`). */
    theme?: Theme;
}

/**
 * The user object shared by the login / verify / getMe / updateUser responses.
 * `nativeLanguage` is optional because `serializeLoginUser` omits the key when
 * it is null; `token` rides only on login and verify.
 */
export interface AuthUser {
    id: string;
    name: string;
    email: string;
    username: string;
    languages: string[];
    uiLanguage: string;
    /** `null` until the user chooses a theme. */
    theme?: Theme | null;
    nativeLanguage?: string | null;
    verified: boolean;
    token?: string;
}

/** `POST /api/users/login` → 200. Carries `token`. */
export type LoginResponse = AuthUser;

/** `POST /api/users` → 201. No `token` (verification email pending). */
export type RegisterResponse = Omit<AuthUser, 'token'>;

/** `GET /api/users/:userId/verify/:tokenId` → 200, signed in. `user` carries `token`. */
export interface VerifyEmailSignedIn {
    user: AuthUser;
    message: string;
}

/**
 * The same route while the login gate refuses this account (access-gates.md): the email IS verified
 * and the link is used up, but there is no profile and no token.
 */
export interface VerifyEmailLoginBlocked {
    message: string;
    verified: true;
    loginBlocked: LoginBlockCode;
}

export type VerifyEmailResponse = VerifyEmailSignedIn | VerifyEmailLoginBlocked;

/** What the login gate answers with when it blocks an account (the code the server also sends as `code`). */
export type LoginBlockCode = 'login_closed' | 'login_not_allowed';

/**
 * `POST /api/auth/signup/complete` → 201 while the login gate refuses the new account: it exists,
 * but there is no token.
 */
export interface OAuthSignupLoginBlocked {
    loginBlocked: LoginBlockCode;
    message: string;
}

export type OAuthSignupCompleteResponse = AuthUser | OAuthSignupLoginBlocked;

/**
 * `GET /api/auth/providers` → 200. Which OAuth providers are configured
 * server-side (env vars set) — the frontend never holds a client ID itself,
 * so this is what decides which buttons `OAuthButtons` renders.
 */
export type OAuthProvidersResponse = Record<string, boolean>;

/**
 * The shape decoded (client-side, unverified — see `decodeJwtPayload`) out
 * of an `oauth_signup` or `oauth_link` ticket — `OAuthSignupForm` uses it to
 * prefill the username field with the email's local part, `OAuthLinkForm`
 * to show which account's password it's asking for. The server
 * independently re-derives everything from its own verified copy of the
 * ticket; nothing here is trusted.
 */
export interface OAuthTicketPreview {
    email?: string;
}

/** `POST /api/auth/signup/complete` body. */
export interface OAuthSignupCompleteRequest {
    ticket: string;
    username: string;
    /** Language labels the user manages — >= 2 required, selection order preserved. */
    languages: string[];
    uiLanguage: string;
    theme?: Theme;
}

/** `POST /api/auth/link` body. A wrong password is rejected without consuming the ticket — safe to retry. */
export interface OAuthLinkRequest {
    ticket: string;
    password: string;
}

/** One row of `GET /api/auth/identities`'s `identities` array. */
export interface OAuthIdentity {
    id: string;
    provider: string;
}

/**
 * `GET /api/auth/identities` → 200 (protected). Feeds the Account page's
 * "Sign-in methods" row. `hasPassword` isn't derivable from `identities`
 * alone — a password-less account never gets less than one identity, but an
 * account with both a password *and* a linked identity needs `hasPassword`
 * spelled out to show the "Password" chip at all.
 */
export interface OAuthIdentitiesResponse {
    hasPassword: boolean;
    identities: OAuthIdentity[];
}

/** `POST /api/auth/:provider/link` (protected) → 200. The frontend does the actual navigation — see `useConnectOAuthProvider`. */
export interface OAuthStartLinkResponse {
    url: string;
}
