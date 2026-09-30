import { apiClient } from '@/api/client';
import type { UsersSearch } from '@/features/users/search';
import type { UserDetail, UserListResponse } from '@/features/users/types';

export const PAGE_SIZE = 25;

export async function fetchUsers(search: UsersSearch): Promise<UserListResponse> {
    const { q, page, sort, order, verified, status, method } = search;
    const { data } = await apiClient.get<UserListResponse>('/admin/users', {
        // axios drops undefined params.
        params: { search: q, page, pageSize: PAGE_SIZE, sort, order, verified, status, method },
    });
    return data;
}

export async function fetchUser(id: string): Promise<UserDetail> {
    const { data } = await apiClient.get<UserDetail>(`/admin/users/${encodeURIComponent(id)}`);
    return data;
}
