/**
 * UserMenu logout: `clearSession()` + `queryClient.clear()` + redirect to
 * `/login` (the `useLogout` seam the old `Header` did with three dispatches).
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from '@/test/render';
import { server } from '@/test/msw/server';
import { makeMetricsHandlers } from '@/test/msw/metricsHandlers';
import { useAuthStore } from '@/stores/authStore';
import { futureToken } from '@/test/tokens';

describe('UserMenu', () => {
    beforeEach(() => {
        // Both tests mount `/` (the Dashboard), which now fires `useUserMetrics()`.
        server.use(...makeMetricsHandlers().handlers);
    });

    it('logout clears the session and the query cache, then redirects to /login', async () => {
        const user = userEvent.setup();
        const { router, queryClient } = await renderApp({
            session: {
                id: 'u1',
                name: 'Kai Rebane',
                email: 'kai@example.com',
                username: 'kai',
                languages: ['English', 'Spanish'],
                uiLanguage: 'English',
                nativeLanguage: null,
                verified: true,
                token: futureToken(),
            },
        });
        queryClient.setQueryData(['probe'], 'cached');

        await user.click(screen.getByRole('button', { name: 'Open settings' }));
        await user.click(await screen.findByRole('menuitem', { name: 'Logout' }));

        await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
        expect(useAuthStore.getState().user).toBeNull();
        expect(useAuthStore.getState().token).toBeNull();
        expect(queryClient.getQueryData(['probe'])).toBeUndefined();
    });

    it('renders deterministic initials on the avatar', async () => {
        const { getByText } = await renderApp({
            session: {
                id: 'u2',
                name: 'Ada Márquez Lovelace',
                email: 'ada@example.com',
                username: 'ada',
                languages: ['English', 'Spanish'],
                uiLanguage: 'English',
                nativeLanguage: null,
                verified: true,
                token: futureToken(),
            },
        });
        expect(getByText('AML')).toBeInTheDocument();
    });
});
