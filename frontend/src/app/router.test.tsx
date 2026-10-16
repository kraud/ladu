import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import { makeAccessHandlers } from '@/test/msw/accessHandlers';
import { OPEN_ACCESS } from '@/features/access/types';
import { render, screen } from '@testing-library/react';
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router';
import { I18nextProvider } from 'react-i18next';
import { createAppRouter } from './router';
import { useAuthStore } from '@/stores/authStore';
import { createTestI18n } from '@/test/render';
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

    it('redirects the old /review URL to /words and keeps its filters', async () => {
        useAuthStore.getState().setSession({ id: 'u1', email: 'a@x.com' }, futureToken());
        const router = await loadAt('/review?pos=Noun');
        expect(router.state.location.pathname).toBe('/words');
        expect(router.state.location.search).toMatchObject({ pos: ['Noun'] });
    });

    it('redirects when the persisted token is expired', async () => {
        useAuthStore.getState().setSession({ id: 'u1', email: 'a@x.com' }, expiredToken());
        const router = await loadAt('/practice');
        expect(router.state.location.pathname).toBe('/login');
    });

    it('allows an authenticated visit to a protected route', async () => {
        useAuthStore.getState().setSession({ id: 'u1', email: 'a@x.com' }, futureToken());
        const router = await loadAt('/');
        expect(router.state.location.pathname).toBe('/');
    });
});

describe('onboarding redirect', () => {
    const onboardingOn = { ...OPEN_ACCESS, onboarding: { enabled: true } };
    const signIn = (onboardingStatus?: string) =>
        useAuthStore.getState().setSession({ id: 'u1', email: 'a@x.com', onboardingStatus }, futureToken());

    it('sends a pending account to /onboarding while the switch is on', async () => {
        server.use(...makeAccessHandlers(onboardingOn));
        signIn('pending');
        const router = await loadAt('/words');
        expect(router.state.location.pathname).toBe('/onboarding');
    });

    it('does not redirect a pending account while the switch is off', async () => {
        signIn('pending');
        const router = await loadAt('/');
        expect(router.state.location.pathname).toBe('/');
    });

    it('does not redirect an account without a pending status', async () => {
        server.use(...makeAccessHandlers(onboardingOn));
        signIn('skipped');
        expect((await loadAt('/')).state.location.pathname).toBe('/');
        useAuthStore.getState().clearSession();
        signIn(undefined);
        expect((await loadAt('/')).state.location.pathname).toBe('/');
    });

    it('does not trap the user when the access call fails', async () => {
        server.use(...makeAccessHandlers(onboardingOn));
        server.use(http.get('*/api/access', () => new HttpResponse(null, { status: 500 })));
        signIn('pending');
        expect((await loadAt('/')).state.location.pathname).toBe('/');
    });

    it('opens /onboarding for a pending account while the switch is on', async () => {
        server.use(...makeAccessHandlers(onboardingOn));
        signIn('pending');
        expect((await loadAt('/onboarding')).state.location.pathname).toBe('/onboarding');
    });

    it('sends anyone else who types /onboarding to the dashboard', async () => {
        server.use(...makeAccessHandlers(onboardingOn));
        signIn('done');
        expect((await loadAt('/onboarding')).state.location.pathname).toBe('/');
    });

    it('sends a visitor without a session to /login', async () => {
        useAuthStore.getState().clearSession();
        expect((await loadAt('/onboarding')).state.location.pathname).toBe('/login');
    });
});

describe('not found', () => {
    it('renders the real 404 page for an unknown path', async () => {
        const router = createAppRouter(createMemoryHistory({ initialEntries: ['/no-such-page'] }));
        render(
            <I18nextProvider i18n={createTestI18n()}>
                <RouterProvider router={router} />
            </I18nextProvider>,
        );
        expect(await screen.findByText('404')).toBeInTheDocument();
    });
});
