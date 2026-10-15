import { apiClient } from '@/api/client';
import type { StartDemoRequest, StartDemoResponse } from './types';

export async function startDemo(body: StartDemoRequest): Promise<StartDemoResponse> {
    const { data } = await apiClient.post<StartDemoResponse>('/demo', body);
    return data;
}
