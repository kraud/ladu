import { apiClient } from '@/api/client';
import type { AccessStatus, RequestAccessBody } from './types';

export async function getAccess(): Promise<AccessStatus> {
    const { data } = await apiClient.get<AccessStatus>('/access');
    return data;
}

/** Always answers 202 `{ received: true }`, whatever the email (the server never tells if it has an account or is listed). */
export async function requestAccess(body: RequestAccessBody): Promise<void> {
    await apiClient.post('/access/request', body);
}
