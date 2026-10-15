import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import * as accessApi from '@/features/access/api';
import { accessKeys } from '@/features/access/keys';
import { useAuthStore } from '@/stores/authStore';
import * as demoApi from './api';
import { demoMsLeft } from './session';
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

/**
 * Ends the demo on this device: drops the session and every cached query, then shows
 * `/demo/ended` (D13). The server already refuses the token after the expiry; this only
 * makes the app follow without waiting for a 401.
 */
export function useEndDemo() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const clearSession = useAuthStore((s) => s.clearSession);

    return useCallback(() => {
        clearSession();
        queryClient.clear();
        void navigate({ to: '/demo/ended' });
    }, [clearSession, navigate, queryClient]);
}

/** Milliseconds left in the demo, updated every second; null when the session is not a demo. */
export function useDemoTimeLeft(): number | null {
    const user = useAuthStore((s) => s.user);
    const [now, setNow] = useState(() => Date.now());
    const isDemo = user?.isDemo === true;

    useEffect(() => {
        if (!isDemo) return;
        setNow(Date.now());
        const id = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(id);
    }, [isDemo]);

    return demoMsLeft(user, now);
}

/**
 * Ends the demo when its time is over: one timer, set to the expiry instant (at once if it has
 * passed already, for example after a reload). Mounted once, in the app header.
 */
export function useDemoExpiry(): void {
    const expiresAt = useAuthStore((s) => (s.user?.isDemo ? (s.user.demoExpiresAt ?? null) : null));
    const endDemo = useEndDemo();

    useEffect(() => {
        if (!expiresAt) return;
        const end = Date.parse(expiresAt);
        if (Number.isNaN(end)) return;
        const id = setTimeout(endDemo, Math.max(0, end - Date.now()));
        return () => clearTimeout(id);
    }, [expiresAt, endDemo]);
}
