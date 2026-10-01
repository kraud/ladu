import { apiClient } from '@/api/client';
import type { AccessMode, AccessState, AddInvitesResult } from '@/features/access/types';

export async function fetchAccess(): Promise<AccessState> {
    const { data } = await apiClient.get<AccessState>('/admin/access');
    return data;
}

export async function saveRegistration(body: { mode: AccessMode; note: string; reason?: string }): Promise<AccessState> {
    const { data } = await apiClient.put<AccessState>('/admin/access/registration', body);
    return data;
}

export async function addInvites(body: { emails: string[] }): Promise<AddInvitesResult> {
    const { data } = await apiClient.post<AddInvitesResult>('/admin/access/invites', body);
    return data;
}

export async function removeInvite(id: string): Promise<AccessState> {
    const { data } = await apiClient.delete<AccessState>(`/admin/access/invites/${encodeURIComponent(id)}`);
    return data;
}
