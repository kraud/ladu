import { apiClient } from '@/api/client';
import type { UsersSearch } from '@/features/users/search';
import type { UserDetail, UserListResponse } from '@/features/users/types';

export const PAGE_SIZE = 25;

export async function fetchUsers(search: UsersSearch): Promise<UserListResponse> {
    const { q, page, sort, order, verified, status, method, loginAllowed } = search;
    const { data } = await apiClient.get<UserListResponse>('/admin/users', {
        // axios drops undefined params.
        params: { search: q, page, pageSize: PAGE_SIZE, sort, order, verified, status, method, loginAllowed },
    });
    return data;
}

export async function fetchUser(id: string): Promise<UserDetail> {
    const { data } = await apiClient.get<UserDetail>(`/admin/users/${encodeURIComponent(id)}`);
    return data;
}

export type UserActionName = 'ban' | 'unban' | 'force-logout' | 'delete' | 'restore' | 'purge' | 'resend-verification' | 'send-password-reset';

export interface UserActionBody {
    reason?: string;
    confirmUsername?: string;
}

/** Both badge calls return the fresh user detail. A reason is required. */
export async function grantBadge(id: string, body: { type: string; reason: string }): Promise<UserDetail> {
    const { data } = await apiClient.post<UserDetail>(`/admin/users/${encodeURIComponent(id)}/badges`, body);
    return data;
}

export async function revokeBadge(id: string, type: string, body: { reason: string }): Promise<UserDetail> {
    const { data } = await apiClient.post<UserDetail>(
        `/admin/users/${encodeURIComponent(id)}/badges/${encodeURIComponent(type)}/revoke`,
        body,
    );
    return data;
}

/** Every action except `purge` returns the fresh user detail; `purge` returns `{ purged: true }`. */
export async function runUserAction(id: string, action: UserActionName, body: UserActionBody): Promise<UserDetail | { purged: true }> {
    const { data } = await apiClient.post<UserDetail | { purged: true }>(`/admin/users/${encodeURIComponent(id)}/${action}`, body);
    return data;
}
