import { apiClient } from '@/api/client';
import type { StatsResponse } from '@/features/stats/types';

export async function fetchStats(): Promise<StatsResponse> {
    const { data } = await apiClient.get<StatsResponse>('/admin/stats');
    return data;
}
