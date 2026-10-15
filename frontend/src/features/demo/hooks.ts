import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import * as accessApi from '@/features/access/api';
import { accessKeys } from '@/features/access/keys';
import { useAuthStore } from '@/stores/authStore';
import * as demoApi from './api';
import type { StartDemoRequest } from './types';

export type DemoStatus = 'loading' | 'on' | 'off';

/**
 * Is the demo on? Reads the public `GET /api/access` (the same query as the gate banners). Unlike
 * `useAccess`, it tells "loading" apart, so `/demo` does not show "the demo is off" for a moment.
 * A failed call reads as off: the server refuses a start anyway (demo-access.md).
 */
export function useDemoStatus(): DemoStatus {
    const { data, isPending, isError } = useQuery({
        queryKey: accessKeys.all,
        queryFn: accessApi.getAccess,
        staleTime: 30_000,
        refetchOnWindowFocus: true,
    });
    if (isPending) return 'loading';
    if (isError) return 'off';
    return data.demo.enabled ? 'on' : 'off';
}

/**
 * Starts a demo, like a login: a new session replaces any open one (the `/demo` page warns about
 * that first, D12), no query from the previous user survives, and the app opens on the dashboard.
 */
export function useStartDemo() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const setSession = useAuthStore((s) => s.setSession);

    return useMutation({
        mutationFn: (body: StartDemoRequest) => demoApi.startDemo(body),
        onSuccess: (user) => {
            queryClient.clear();
            setSession(user);
            void navigate({ to: '/' });
        },
    });
}
