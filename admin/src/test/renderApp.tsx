import { render } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router';
import { createQueryClient } from '@/app/query-client';
import { createAppRouter } from '@/app/router';
import { onUnauthorized } from '@/api/client';
import { useAuthStore, type StaffUser } from '@/stores/authStore';
import { fakeToken } from '@/test/token';
import { staffFixture } from '@/test/msw/handlers';

/**
 * Mounts the real route tree on an in-memory history, inside a fresh query
 * client. `session: true` starts signed in. The 401 redirect that
 * `app/Providers.tsx` wires is wired here too, so a test can cover it.
 */
export async function renderApp(options: { initialEntry?: string; session?: boolean | { staff?: StaffUser; token?: string } } = {}) {
    const { initialEntry = '/', session = false } = options;

    useAuthStore.getState().clearSession();
    if (session) {
        const custom = typeof session === 'object' ? session : {};
        useAuthStore.getState().setSession(custom.staff ?? staffFixture, custom.token ?? fakeToken());
    }

    const queryClient = createQueryClient();
    const router = createAppRouter(createMemoryHistory({ initialEntries: [initialEntry] }));
    const unsubscribe = onUnauthorized(() => void router.navigate({ to: '/login' }));
    await router.load();

    const utils = render(
        <QueryClientProvider client={queryClient}>
            <RouterProvider router={router} />
        </QueryClientProvider>,
    );

    return { router, queryClient, unsubscribe, ...utils };
}
