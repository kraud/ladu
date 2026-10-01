import { apiClient } from '@/api/client';
import type { HealthResponse } from '@/features/health/types';

export async function fetchHealth(): Promise<HealthResponse> {
    const { data } = await apiClient.get<HealthResponse>('/admin/health');
    return data;
}
