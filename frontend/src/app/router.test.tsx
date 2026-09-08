import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router';
import { createAppRouter } from './router';
import { useAuthStore } from '@/stores/authStore';
import { expiredToken, futureToken } from '@/test/tokens';

async function loadAt(path: string) {
    const router = createAppRouter(createMemoryHistory({ initialEntries: [path] }));
    await router.load();
    return router;
}

describe('_protected.beforeLoad guard', () => {
    it('redirects an unauthenticated visit to a protected route to /login', async () => {
        useAuthStore.getState().clearSession();
        const router = await loadAt('/');
        expect(router.state.location.pathname).toBe('/login');
    });

    it('carries the attempted URL in the redirect search param', async () => {
        useAuthStore.getState().clearSession();
        const router = await loadAt('/review');
        expect(router.state.location.pathname).toBe('/login');
        expect(router.state.location.search).toMatchObject({ redirect: expect.stringContaining('/review') });
    });

    it('redirects when the persisted token is expired', async () => {
        useAuthStore.getState().setSession({ _id: 'u1', email: 'a@x.com' }, expiredToken());
        const router = await loadAt('/practice');
        expect(router.state.location.pathname).toBe('/login');
    });

    it('allows an authenticated visit to a protected route', async () => {
        useAuthStore.getState().setSession({ _id: 'u1', email: 'a@x.com' }, futureToken());
        const router = await loadAt('/');
        expect(router.state.location.pathname).toBe('/');
    });
});

describe('not found', () => {
    it('renders the real 404 page for an unknown path', async () => {
        const router = createAppRouter(createMemoryHistory({ initialEntries: ['/no-such-page'] }));
        render(<RouterProvider router={router} />);
        expect(await screen.findByText('404')).toBeInTheDocument();
    });
});
