/**
 * Header nav gating (`pages-auth-shell.md:205`): Add Word and Review need ≥2
 * configured languages; Practice never does. Walked through the real shell on
 * `/` via `renderApp`.
 */
import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from '@/test/render';
import { futureToken } from '@/test/tokens';

const baseSession = {
    id: 'u1',
    name: 'Kai Rebane',
    email: 'kai@example.com',
    username: 'kai',
    uiLanguage: 'English',
    nativeLanguage: null,
    verified: true,
    token: futureToken(),
};

describe('AppHeader nav gating', () => {
    it('blocks Add Word with <2 languages and offers a route to Account', async () => {
        const user = userEvent.setup();
        const { router } = await renderApp({
            session: { ...baseSession, languages: ['English'] },
        });

        await user.click(screen.getByRole('link', { name: 'add word' }));

        expect(router.state.location.pathname).toBe('/');
        expect(
            await screen.findByText('Please select at least 2 languages.'),
        ).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Go to Account' }));
        await waitFor(() => expect(router.state.location.pathname).toBe('/user'));
    });

    it('lets Practice through regardless of language count', async () => {
        const user = userEvent.setup();
        const { router } = await renderApp({
            session: { ...baseSession, languages: ['English'] },
        });

        await user.click(screen.getByRole('link', { name: 'practice' }));
        await waitFor(() => expect(router.state.location.pathname).toBe('/practice'));
    });

    it('lets Review through with ≥2 languages', async () => {
        const user = userEvent.setup();
        const { router } = await renderApp({
            session: { ...baseSession, languages: ['English', 'Spanish'] },
        });

        await user.click(screen.getByRole('link', { name: 'review' }));
        await waitFor(() => expect(router.state.location.pathname).toBe('/review'));
    });
});
