import { apiClient } from '@/api/client';
import type { CreateOnboardingRequest, CreateOnboardingResponse, OnboardingChoice } from './types';

/** `POST /api/onboarding/skip` → 200: the account is `skipped` and starts empty (onboarding.md D6). */
export async function skipOnboarding(): Promise<{ onboardingStatus: 'skipped' }> {
    const { data } = await apiClient.post<{ onboardingStatus: 'skipped' }>('/onboarding/skip');
    return data;
}

/** `POST /api/onboarding/capacity` → how many words the pool can deliver for this choice (D18). */
export async function getCapacity(body: OnboardingChoice): Promise<number> {
    const { data } = await apiClient.post<{ capacity: number }>('/onboarding/capacity', body);
    return data.capacity;
}

export async function createOnboarding(body: CreateOnboardingRequest): Promise<CreateOnboardingResponse> {
    const { data } = await apiClient.post<CreateOnboardingResponse>('/onboarding', body);
    return data;
}
