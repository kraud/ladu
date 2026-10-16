import { queryClient } from '@/app/query-client';
import * as accessApi from '@/features/access/api';
import { accessKeys } from '@/features/access/keys';
import { authStore } from '@/stores/authStore';

/**
 * Must this session see `/onboarding` now? Yes when the account is `pending` AND the admin switch is
 * on (onboarding.md D21, D26). The switch comes from the public access answer (the same query as the
 * gate banners, so it is usually cached). If that call fails, the answer is no: the server refuses
 * the onboarding routes while the switch is off, so a wrong "yes" would only trap the user.
 */
export async function mustOnboard(): Promise<boolean> {
    if (authStore.getState().user?.onboardingStatus !== 'pending') return false;
    try {
        const access = await queryClient.fetchQuery({
            queryKey: accessKeys.all,
            queryFn: accessApi.getAccess,
            staleTime: 30_000,
        });
        return access.onboarding?.enabled === true;
    } catch {
        return false;
    }
}
