import { apiClient } from '@/api/client';
import type { AccessStatus } from './types';

export async function getAccess(): Promise<AccessStatus> {
    const { data } = await apiClient.get<AccessStatus>('/access');
    return data;
}
