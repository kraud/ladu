import { useMutation } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { getApiErrorCode } from '@/api/types';
import { useAuthStore } from '@/stores/authStore';
import * as onboardingApi from './api';

/**
 * Skip the onboarding: the account starts empty (D6) and the dashboard opens. If the server says the
 * account is not `pending` any more (409) or the switch is off (403), the onboarding is over for this
 * session anyway, so the app also goes on to the dashboard.
 */
export function useSkipOnboarding() {
    const navigate = useNavigate();
    const setStatus = useAuthStore((s) => s.setOnboardingStatus);

    return useMutation({
        mutationFn: onboardingApi.skipOnboarding,
        onSuccess: async () => {
            setStatus('skipped');
            await navigate({ to: '/' });
        },
        onError: async (error) => {
            const code = getApiErrorCode(error);
            if (code === 'onboarding_not_pending' || code === 'onboarding_disabled') {
                await navigate({ to: '/' });
            }
        },
    });
}
