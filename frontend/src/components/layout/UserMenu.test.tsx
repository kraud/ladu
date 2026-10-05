/**
 * The header avatar opens the profile directly; logout lives on the Account
 * page behind a confirmation: `clearSession()` + `queryClient.clear()` +
 * redirect to `/login` (the `useLogout` seam the old `Header` did with three dispatches).
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
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

    it('the avatar opens the profile, and logout (confirmed) clears the session and the query cache, then redirects to /login', async () => {
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

        // The avatar is a plain link to the profile — no menu in between.
        await user.click(screen.getByRole('link', { name: 'Account' }));
        await waitFor(() => expect(router.state.location.pathname).toBe('/user'));

        // Logout asks first; cancelling keeps the session.
        await user.click(await screen.findByRole('button', { name: 'Logout' }));
        const dialog = await screen.findByRole('alertdialog');
        await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
        await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
        expect(useAuthStore.getState().user).not.toBeNull();

        await user.click(screen.getByRole('button', { name: 'Logout' }));
        await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Logout' }));

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
