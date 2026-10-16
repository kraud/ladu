import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { getApiErrorCode } from '@/api/types';
import { metricsKeys } from '@/features/metrics/keys';
import { tagKeys } from '@/features/tags/keys';
import { wordKeys } from '@/features/words/keys';
import { useAuthStore } from '@/stores/authStore';
import * as onboardingApi from './api';
import { saveOnboardingResult } from './resultCard';
import type { CreateOnboardingRequest, OnboardingChoice } from './types';

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

/** How many words the pool can deliver for the levels and topics (the slider maximum, D18). Read when the count step opens. */
export function useCapacity(choice: OnboardingChoice, enabled: boolean) {
    return useQuery({
        queryKey: ['onboarding', 'capacity', choice.levels, choice.topics],
        queryFn: () => onboardingApi.getCapacity(choice),
        enabled,
        staleTime: Infinity,
    });
}

/** How long the "Almost done" screen shows at least, so the user can read it. Tests set `minMs` to 0. */
export const buildTiming = { minMs: 3000 };

/**
 * Create the words and tags. The new words, tags and counts change what the other pages show, so
 * their queries are read again; the account is `done`, and the dashboard opens (D7).
 */
export function useCreateOnboarding() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const setStatus = useAuthStore((s) => s.setOnboardingStatus);

    return useMutation({
        // The request and the minimum display time run together: a fast server does not shorten the screen, a slow one does not add to it.
        mutationFn: async (request: CreateOnboardingRequest) => {
            const [result] = await Promise.all([
                onboardingApi.createOnboarding(request),
                new Promise((resolve) => setTimeout(resolve, buildTiming.minMs)),
            ]);
            return result;
        },
        onSuccess: async (result) => {
            const userId = useAuthStore.getState().user?.id;
            if (userId) saveOnboardingResult(userId, result);
            setStatus('done');
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: wordKeys.all }),
                queryClient.invalidateQueries({ queryKey: tagKeys.all }),
                queryClient.invalidateQueries({ queryKey: metricsKeys.all }),
            ]);
            await navigate({ to: '/' });
        },
    });
}
