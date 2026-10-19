import { apiClient } from '@/api/client';
import type {
    AccessMode,
    AccessState,
    AddInvitesResult,
    AllowLoginResult,
    DemoSettings,
    DemoStats,
    DemoUsers,
    DisallowManyResult,
    GateName,
} from '@/features/access/types';

export async function fetchAccess(): Promise<AccessState> {
    const { data } = await apiClient.get<AccessState>('/admin/access');
    return data;
}

export async function saveGate(gate: GateName, body: { mode: AccessMode; note: string; reason?: string }): Promise<AccessState> {
    const { data } = await apiClient.put<AccessState>(`/admin/access/${gate}`, body);
    return data;
}

export async function saveDemo(body: DemoSettings & { reason?: string }): Promise<AccessState> {
    const { data } = await apiClient.put<AccessState>('/admin/access/demo', body);
    return data;
}

export async function saveOnboarding(body: { enabled: boolean; reason?: string }): Promise<AccessState> {
    const { data } = await apiClient.put<AccessState>('/admin/access/onboarding', body);
    return data;
}

export async function saveCaptcha(body: { enabled: boolean; reason?: string }): Promise<AccessState> {
    const { data } = await apiClient.put<AccessState>('/admin/access/captcha', body);
    return data;
}

export async function fetchDemoUsers(): Promise<DemoUsers> {
    const { data } = await apiClient.get<DemoUsers>('/admin/access/demo/users');
    return data;
}

export async function fetchDemoStats(): Promise<DemoStats> {
    const { data } = await apiClient.get<DemoStats>('/admin/access/demo/stats');
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

/** Emails the invited address that it can register now. The invite stays on the list. */
export async function sendInvite(id: string): Promise<{ sent: true; email: string }> {
    const { data } = await apiClient.post<{ sent: true; email: string }>(`/admin/access/invites/${encodeURIComponent(id)}/send`, {});
    return data;
}

/** Moves a request to the real list (invite list or allowed accounts). Sends no email. */
export async function approveRequest(body: { id: string; reason?: string }): Promise<AccessState> {
    const { data } = await apiClient.post<AccessState>(`/admin/access/requests/${encodeURIComponent(body.id)}/approve`, { reason: body.reason });
    return data;
}

/** Removes a request without approving it. */
export async function removeRequest(body: { id: string; reason?: string }): Promise<AccessState> {
    const { data } = await apiClient.delete<AccessState>(`/admin/access/requests/${encodeURIComponent(body.id)}`, { data: { reason: body.reason } });
    return data;
}

/** Emails an allowed account that it can sign in now. The account stays on the list. */
export async function sendLoginAllowed(body: { userId: string; reason?: string }): Promise<{ sent: true; email: string }> {
    const { data } = await apiClient.post<{ sent: true; email: string }>(
        `/admin/access/login-allowed/${encodeURIComponent(body.userId)}/send`,
        { reason: body.reason },
    );
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
