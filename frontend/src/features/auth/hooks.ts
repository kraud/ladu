/**
 * One mutation hook per auth action. All flow sequencing that the old app did
 * with Redux status booleans + chained effects (snapshot `pages-auth-shell.md`)
 * becomes `onSuccess` / `onError` callbacks here:
 *   - toasts fire from the callbacks, never from a `useEffect` on a flag;
 *   - `queryClient.clear()` runs on every session boundary (login / verify /
 *     logout) so no query from a previous user survives;
 *   - `isPending` is the only "loading" signal a component ever reads.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useRouter } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { useAuthStore } from '@/stores/authStore';
import * as authApi from './api';
import { authErrorKey } from './errors';
import type {
    LoginRequest,
    RegisterRequest,
    RequestResetRequest,
    SetPasswordRequest,
    UpdateProfileRequest,
} from './types';

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
