import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import { getApiErrorCode } from '@/api/types';
import * as accessApi from './api';
import { accessKeys } from './keys';
import { authErrorKey } from '@/features/auth/errors';
import { OPEN_ACCESS, type AccessStatus, type RequestAccessBody } from './types';

/**
 * The state of the registration and login gates, for the banners. The server always enforces
 * the gate, so a banner is a courtesy: while loading, or if the call fails, the app acts as
 * if everything is open and shows no banner. Short `staleTime` and a refetch on focus, so a
 * change by the owner shows soon (the app-wide default turns focus refetch off).
 */
export function useAccess(): AccessStatus {
    const { data } = useQuery({
        queryKey: accessKeys.all,
        queryFn: accessApi.getAccess,
        staleTime: 30_000,
        refetchOnWindowFocus: true,
    });
    return data ?? OPEN_ACCESS;
}

// The captcha codes are here too: the owner may have turned the switch on since the page loaded, and the form needs the widget.
const GATE_CODES = new Set([
    'registration_closed',
    'registration_not_invited',
    'login_closed',
    'login_not_allowed',
    'captcha_failed',
    // The owner opened the gate since the page loaded: the request page shows "open" instead of the form.
    'access_not_needed',
]);

/**
 * A gate refused the request, so the state changed since the page loaded: read it again, so
 * the banner and the form match. Call it from a mutation's `onError` (registration, login and captcha codes).
 */
export function refreshAccessOnGateError(queryClient: QueryClient, error: unknown): void {
    const code = getApiErrorCode(error);
    if (code && GATE_CODES.has(code)) refreshAccess(queryClient);
}

/** Read the gate state again (a banner may be out of date). */
export function refreshAccess(queryClient: QueryClient): void {
    void queryClient.invalidateQueries({ queryKey: accessKeys.all });
}

/**
 * The request-access form (access-requests.md). No success toast: the page replaces the form with
 * its own message. A refusal shows a toast, and reads the gate state again when a gate code came back.
 */
export function useRequestAccess() {
    const { t } = useTranslation();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (body: RequestAccessBody) => accessApi.requestAccess(body),
        onError: (error) => {
            toast.error(t(authErrorKey(error)));
            refreshAccessOnGateError(queryClient, error);
        },
    });
}
