import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchMe, loginStaff } from '@/features/auth/api';
import { useAuthStore } from '@/stores/authStore';

export const staffKeys = { me: ['staff', 'me'] as const };

export function useLogin() {
    const queryClient = useQueryClient();
    const setSession = useAuthStore((s) => s.setSession);

    return useMutation({
        mutationFn: (vars: { email: string; password: string }) => loginStaff(vars.email, vars.password),
        onSuccess: ({ token, ...staff }) => {
            // Wipe anything a previous staff member's session cached.
            queryClient.clear();
            setSession(staff, token);
        },
    });
}

export function useLogout() {
    const queryClient = useQueryClient();
    const clearSession = useAuthStore((s) => s.clearSession);

    // The token is stateless and lasts 8 hours; there is no server call to make.
    return () => {
        clearSession();
        queryClient.clear();
    };
}

/**
 * Checks the saved token against the server on every app start, and keeps the
 * stored name and role current (a role can change while a session is open). A
 * 401 is handled by the axios interceptor, which clears the session.
 */
export function useStaffSession() {
    const setSession = useAuthStore((s) => s.setSession);
    const hasToken = useAuthStore((s) => s.token !== null);
    // `enabled`: signing out clears the cache while the layout is still
    // mounted, and the query would otherwise refetch with no token (a 401).
    const query = useQuery({ queryKey: staffKeys.me, queryFn: fetchMe, enabled: hasToken });

    useEffect(() => {
        if (query.data) setSession(query.data);
    }, [query.data, setSession]);

    return query;
}
