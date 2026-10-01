import { render } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router';
import { createQueryClient } from '@/app/query-client';
import { createAppRouter } from '@/app/router';
import { onPasswordChangeRequired, onUnauthorized } from '@/api/client';
import { useAuthStore, type StaffRole, type StaffUser } from '@/stores/authStore';
import { fakeToken } from '@/test/token';
import { http, HttpResponse } from 'msw';
import { makeStaff, staffFixture } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';

// Handlers that a test registered on the shared API client. They are removed after
// each test (test/setup.ts), so a router from an earlier test never reacts to a later one.
const cleanups: (() => void)[] = [];
export function cleanupRenderedApps() {
    for (const cleanup of cleanups.splice(0)) cleanup();
}

/**
 * Mounts the real route tree on an in-memory history, inside a fresh query
 * client. `session: true` starts signed in. The 401 redirect that
 * `app/Providers.tsx` wires is wired here too, so a test can cover it.
 */
export async function renderApp(
    options: { initialEntry?: string; session?: boolean | { staff?: StaffUser; token?: string }; role?: StaffRole } = {},
) {
    const { initialEntry = '/', role } = options;
    // `role` means "signed in as this role": the session and `/auth/me` agree.
    const session = role ? { staff: makeStaff(role) } : (options.session ?? false);
    if (role) server.use(http.get('/api/admin/auth/me', () => HttpResponse.json(makeStaff(role))));

    useAuthStore.getState().clearSession();
    if (session) {
        const custom = typeof session === 'object' ? session : {};
        useAuthStore.getState().setSession(custom.staff ?? staffFixture, custom.token ?? fakeToken());
    }

    const queryClient = createQueryClient();
    const router = createAppRouter(createMemoryHistory({ initialEntries: [initialEntry] }));
    const unsubscribeUnauthorized = onUnauthorized(() => void router.navigate({ to: '/login' }));
    const unsubscribePasswordChange = onPasswordChangeRequired(() => void router.navigate({ to: '/account/password' }));
    const unsubscribe = () => {
        unsubscribeUnauthorized();
        unsubscribePasswordChange();
    };
    cleanups.push(unsubscribe);
    await router.load();

    const utils = render(
        <QueryClientProvider client={queryClient}>
            <RouterProvider router={router} />
        </QueryClientProvider>,
    );

    return { router, queryClient, unsubscribe, ...utils };
}
