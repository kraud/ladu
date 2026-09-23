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
    nativeLanguage?: string | null;
    verified: boolean;
    token?: string;
}

/** `POST /api/users/login` → 200. Carries `token`. */
export type LoginResponse = AuthUser;

/** `POST /api/users` → 201. No `token` (verification email pending). */
export type RegisterResponse = Omit<AuthUser, 'token'>;

/** `GET /api/users/:userId/verify/:tokenId` → 200. `user` carries `token`. */
export interface VerifyEmailResponse {
    user: AuthUser;
    message: string;
}

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
}

/** `POST /api/auth/link` body. A wrong password is rejected without consuming the ticket — safe to retry. */
export interface OAuthLinkRequest {
    ticket: string;
    password: string;
}
