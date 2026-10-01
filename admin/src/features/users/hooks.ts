import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchUser, fetchUsers, runUserAction, type UserActionBody, type UserActionName } from '@/features/users/api';
import type { UserDetail } from '@/features/users/types';
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

/**
 * Runs one action on one user. On success the detail cache takes the fresh
 * user the server returned (status, dates and audit history update at once),
 * and every cached list is marked stale, because a status filter or a count may
 * now be wrong. A purge removes the user, so its detail is dropped instead.
 */
export function useUserAction(userId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (vars: { action: UserActionName } & UserActionBody) => {
            const { action, ...body } = vars;
            return runUserAction(userId, action, body);
        },
        onSuccess: (result) => {
            if ('purged' in result) queryClient.removeQueries({ queryKey: userKeys.detail(userId) });
            else queryClient.setQueryData<UserDetail>(userKeys.detail(userId), result);
            void queryClient.invalidateQueries({ queryKey: ['users', 'list'] });
        },
    });
}
