/**
 * One mutation hook per auth action. All flow sequencing that the old app did
 * with Redux status booleans + chained effects (snapshot `pages-auth-shell.md`)
 * becomes `onSuccess` / `onError` callbacks here:
 *   - toasts fire from the callbacks, never from a `useEffect` on a flag;
 *   - `queryClient.clear()` runs on every session boundary (login / verify /
 *     logout) so no query from a previous user survives;
 *   - `isPending` is the only "loading" signal a component ever reads.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useRouter } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { authStore, useAuthStore } from '@/stores/authStore';
import * as authApi from './api';
import { authErrorKey, OAuthCallbackError, oauthErrorKey } from './errors';
import type {
    LoginRequest,
    OAuthLinkRequest,
    OAuthSignupCompleteRequest,
    RegisterRequest,
    RequestResetRequest,
    SetPasswordRequest,
    UpdateProfileRequest,
} from './types';

/** Shared by `useOAuthIdentities`/`useDisconnectOAuthIdentity` so a disconnect invalidates the same cache entry the list query reads. */
const OAUTH_IDENTITIES_QUERY_KEY = ['auth', 'identities'];

/**
 * @param redirectTo where to land after a verified login — the `redirect`
 * search param the `_protected` guard stashed, or `/`.
 */
export function useLogin(redirectTo = '/') {
    const { t } = useTranslation();
    const router = useRouter();
    const queryClient = useQueryClient();
    const setSession = useAuthStore((s) => s.setSession);

    return useMutation({
        mutationFn: (body: LoginRequest) => authApi.login(body),
        onSuccess: (user) => {
            // Decision 1: an unverified account may not enter. Warn, write no
            // session, stay on /login.
            if (user.verified !== true) {
                toast.warning(t('loginRegister:unverifiedWarning'));
                return;
            }
            queryClient.clear();
            setSession(user); // token rides on `user.token`
            // `redirectTo` is an arbitrary in-app path, not a statically known
            // route — `history.push` is the string-path escape hatch.
            router.history.push(redirectTo);
        },
        onError: (error) => toast.error(t(authErrorKey(error))),
    });
}

export function useRegister() {
    const { t } = useTranslation();
    const navigate = useNavigate();

    return useMutation({
        mutationFn: (body: RegisterRequest) => authApi.register(body),
        onSuccess: (_data, variables) => {
            // Decision 1: register returns no token; send them to /login to sign
            // in once the emailed link has verified the account.
            toast.info(t('loginRegister:register.emailSentToast', { email: variables.email }));
            void navigate({ to: '/login' });
        },
        onError: (error) => toast.error(t(authErrorKey(error))),
    });
}

/**
 * The one auth response carrying both a profile and a token — verifying the
 * email *is* the sign-in. Navigation (the countdown) is the page's job.
 */
export function useVerifyEmail() {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const setSession = useAuthStore((s) => s.setSession);

    return useMutation({
        mutationFn: authApi.verifyEmail,
        onSuccess: ({ user }) => {
            queryClient.clear();
            setSession(user);
        },
        onError: (error) => toast.error(t(authErrorKey(error))),
    });
}

export function useRequestReset() {
    const { t } = useTranslation();
    const navigate = useNavigate();

    return useMutation({
        mutationFn: (body: RequestResetRequest) => authApi.requestPasswordReset(body),
        onSuccess: () => {
            toast.success(t('loginRegister:toastMessages.emailSent'));
            void navigate({ to: '/login' });
        },
        onError: (error) => toast.error(t(authErrorKey(error))),
    });
}

export function useSetPassword() {
    const { t } = useTranslation();
    const navigate = useNavigate();

    return useMutation({
        mutationFn: (body: SetPasswordRequest) => authApi.setPassword(body),
        onSuccess: () => {
            toast.success(t('loginRegister:toastMessages.passwordUpdated'));
            void navigate({ to: '/login' });
        },
        onError: (error) => toast.error(t(authErrorKey(error))),
    });
}

/**
 * Persist a profile change (`PUT /api/users/updateUser`) and fold the fresh row
 * back into the session. The response carries no token — `setSession` keeps the
 * current one. Callers MUST send a complete `UpdateProfileRequest`: the endpoint
 * clears `nativeLanguage` whenever the key is absent (`types.ts`).
 */
export function useUpdateProfile() {
    const { t } = useTranslation();
    const setSession = useAuthStore((s) => s.setSession);

    return useMutation({
        mutationFn: (body: UpdateProfileRequest) => authApi.updateProfile(body),
        onSuccess: (user) => setSession(user),
        onError: (error) => toast.error(t(authErrorKey(error))),
    });
}

/** Clear the session + all cached server state, then return to /login. */
export function useLogout() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const clearSession = useAuthStore((s) => s.clearSession);

    return () => {
        clearSession();
        queryClient.clear();
        void navigate({ to: '/login' });
    };
}

/**
 * Which OAuth providers are configured server-side — drives which buttons
 * `OAuthButtons` renders. Static for the life of a deploy (env vars don't
 * change at runtime), so an effectively-infinite `staleTime` is correct, not
 * just an optimization.
 */
export function useOAuthProviders() {
    return useQuery({
        queryKey: ['auth', 'providers'],
        queryFn: authApi.getOAuthProviders,
        staleTime: Infinity,
    });
}

/**
 * Finishes the OAuth flow `/auth/callback` lands on for the two fragment
 * shapes this hook handles: `token=<jwt>` (outcome (a), an already-linked
 * identity) or `error=<code>` (a technical failure — the only code the
 * callback still produces now that outcomes (b)/(c) both issue tickets
 * instead). The other two shapes, `ticket=<jwt>&mode=signup` (outcome (b))
 * and `ticket=<jwt>&mode=link` (outcome (c)), never reach this hook at all
 * — `OAuthCallbackPage` renders `OAuthSignupForm`/`OAuthLinkForm` instead of
 * firing this mutation. A token alone isn't a full session: `getMe` has to
 * be called with it before `setSession` can fold in a real profile, which
 * is why this needs its own hook instead of reusing `useLogin`.
 */
export function useOAuthCallback() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const setSession = useAuthStore((s) => s.setSession);

    return useMutation({
        mutationFn: async (fragment: string) => {
            const params = new URLSearchParams(fragment);
            const error = params.get('error');
            if (error) throw new OAuthCallbackError(error);

            const token = params.get('token');
            if (!token) throw new OAuthCallbackError('oauth_failed');

            // getMe reads the token from the store via apiClient's request
            // interceptor, not a parameter — it has to land there first.
            authStore.setState({ token });
            const user = await authApi.getMe();
            return { user, token };
        },
        onSuccess: ({ user, token }) => {
            queryClient.clear();
            setSession(user, token);
            void navigate({ to: '/' });
        },
        onError: (error) => {
            authStore.getState().clearSession();
            toast.error(t(oauthErrorKey(error)));
            void navigate({ to: '/login' });
        },
    });
}

/**
 * Finishes outcome (b) — a brand-new Google identity — by POSTing the
 * signup ticket `OAuthSignupForm` collected a username and languages for.
 * The response carries a full profile + token already (`serializeLoginUser`
 * on the backend), so this can call `setSession` directly, unlike
 * `useOAuthCallback`'s bare `token=` case.
 */
export function useOAuthSignupComplete() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const setSession = useAuthStore((s) => s.setSession);

    return useMutation({
        mutationFn: (body: OAuthSignupCompleteRequest) => authApi.completeOAuthSignup(body),
        onSuccess: (user) => {
            queryClient.clear();
            setSession(user);
            void navigate({ to: '/' });
        },
        onError: (error) => toast.error(t(authErrorKey(error))),
    });
}

/**
 * Finishes outcome (c) — a Google identity whose email matches an existing
 * password account — by POSTing the link ticket `OAuthLinkForm` collected
 * one password for. A wrong password's error toasts and the form stays up
 * for a retry (`onError` doesn't navigate away, unlike `useOAuthCallback`'s)
 * — the ticket isn't consumed by a failed attempt, so there's nothing to
 * re-fetch or restart.
 */
export function useOAuthLinkComplete() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const setSession = useAuthStore((s) => s.setSession);

    return useMutation({
        mutationFn: (body: OAuthLinkRequest) => authApi.linkOAuthAccount(body),
        onSuccess: (user) => {
            queryClient.clear();
            setSession(user);
            void navigate({ to: '/' });
        },
        onError: (error) => toast.error(t(authErrorKey(error))),
    });
}

/**
 * The Account page's "Sign-in methods" row (Phase 5) — which providers are
 * connected, and whether the account also has a password. No `staleTime`
 * override: unlike `useOAuthProviders` (env-configured, never changes at
 * runtime), this changes whenever the user connects/disconnects, so the
 * default "refetch on mount" behavior is what's wanted here.
 */
export function useOAuthIdentities() {
    return useQuery({
        queryKey: OAUTH_IDENTITIES_QUERY_KEY,
        queryFn: authApi.getOAuthIdentities,
    });
}

/**
 * "Connect" in the profile edit view — POSTs to the protected start
 * endpoint (needs an Authorization header, so unlike the public login
 * button this can't be a plain `<a href>`) and then does the real top-level
 * navigation itself with the authorize URL the response carries.
 */
export function useConnectOAuthProvider() {
    const { t } = useTranslation();

    return useMutation({
        mutationFn: (provider: string) => authApi.startOAuthLink(provider),
        onSuccess: ({ url }) => {
            window.location.href = url;
        },
        onError: (error) => toast.error(t(authErrorKey(error))),
    });
}

/** "Disconnect" in the profile edit view. The backend refuses (400) to remove the account's last sign-in method. */
export function useDisconnectOAuthIdentity() {
    const { t } = useTranslation();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => authApi.deleteOAuthIdentity(id),
        onSuccess: () => {
            toast.success(t('account:signInMethods.disconnectSuccess'));
            void queryClient.invalidateQueries({ queryKey: OAUTH_IDENTITIES_QUERY_KEY });
        },
        onError: (error) => toast.error(t(authErrorKey(error))),
    });
}
