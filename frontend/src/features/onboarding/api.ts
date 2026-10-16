import { apiClient } from '@/api/client';

/** `POST /api/onboarding/skip` → 200: the account is `skipped` and starts empty (onboarding.md D6). */
export async function skipOnboarding(): Promise<{ onboardingStatus: 'skipped' }> {
    const { data } = await apiClient.post<{ onboardingStatus: 'skipped' }>('/onboarding/skip');
    return data;
}
