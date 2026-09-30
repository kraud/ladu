import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { fetchUser, fetchUsers } from '@/features/users/api';
import type { UsersSearch } from '@/features/users/search';

export const userKeys = {
    all: ['users'] as const,
    list: (search: UsersSearch) => ['users', 'list', search] as const,
    detail: (id: string) => ['users', 'detail', id] as const,
};

export function useUsers(search: UsersSearch) {
    return useQuery({
        queryKey: userKeys.list(search),
        queryFn: () => fetchUsers(search),
        // Keep the old rows on screen while the next page or search loads.
        placeholderData: keepPreviousData,
    });
}

export function useUser(id: string) {
    return useQuery({ queryKey: userKeys.detail(id), queryFn: () => fetchUser(id) });
}
