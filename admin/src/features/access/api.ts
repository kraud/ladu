import { apiClient } from '@/api/client';
import type { AccessMode, AccessState, AddInvitesResult, AllowLoginResult, DisallowManyResult, GateName } from '@/features/access/types';

export async function fetchAccess(): Promise<AccessState> {
    const { data } = await apiClient.get<AccessState>('/admin/access');
    return data;
}

export async function saveGate(gate: GateName, body: { mode: AccessMode; note: string; reason?: string }): Promise<AccessState> {
    const { data } = await apiClient.put<AccessState>(`/admin/access/${gate}`, body);
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

export async function allowLogin(body: { userIds?: string[]; emails?: string[]; reason?: string }): Promise<AllowLoginResult> {
    const { data } = await apiClient.post<AllowLoginResult>('/admin/access/login-allowed', body);
    return data;
}

export async function disallowLoginMany(body: { userIds: string[]; reason?: string }): Promise<DisallowManyResult> {
    const { data } = await apiClient.post<DisallowManyResult>('/admin/access/login-allowed/remove', body);
    return data;
}

export async function disallowLogin(userId: string): Promise<AccessState> {
    const { data } = await apiClient.delete<AccessState>(`/admin/access/login-allowed/${encodeURIComponent(userId)}`);
    return data;
}

export async function signOutEveryone(body: { confirm: string; reason: string }): Promise<{ signedOut: number }> {
    const { data } = await apiClient.post<{ signedOut: number }>('/admin/access/sign-out-everyone', body);
    return data;
}
