/**
 * Header nav gating (`pages-auth-shell.md:205`): Add Word and Review need ≥2
 * configured languages; Practice never does. Walked through the real shell on
 * `/` via `renderApp`.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from '@/test/render';
import { futureToken } from '@/test/tokens';
import { server } from '@/test/msw/server';
import { makeWordHandlers } from '@/test/msw/wordHandlers';
import { makeMetricsHandlers } from '@/test/msw/metricsHandlers';

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
    beforeEach(() => {
        // Every test here starts on `/` (the Dashboard), which fires `useUserMetrics()`.
        server.use(...makeMetricsHandlers().handlers);
    });

    it('blocks Words with <2 languages and offers a route to Account', async () => {
        const user = userEvent.setup();
        const { router } = await renderApp({
            session: { ...baseSession, languages: ['English'] },
        });

        await user.click(screen.getByRole('link', { name: 'words' }));

        expect(router.state.location.pathname).toBe('/');
        expect(
            await screen.findByText('Please select at least 2 languages.'),
        ).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Go to Account' }));
        await waitFor(() => expect(router.state.location.pathname).toBe('/user'));
    });

    it('lists Words, Tags and Practice in that order, with no Add word link', async () => {
        await renderApp({ session: { ...baseSession, languages: ['English', 'Spanish'] } });

        const names = screen
            .getAllByRole('link')
            .map((link) => link.textContent)
            .filter((text) => ['words', 'tags', 'practice'].includes(text ?? ''));
        expect(names.slice(0, 3)).toEqual(['words', 'tags', 'practice']);
        expect(screen.queryByRole('link', { name: 'add word' })).not.toBeInTheDocument();
    });

    it('lets Practice through regardless of language count', async () => {
        const user = userEvent.setup();
        const { router } = await renderApp({
            session: { ...baseSession, languages: ['English'] },
        });

        await user.click(screen.getByRole('link', { name: 'practice' }));
        await waitFor(() => expect(router.state.location.pathname).toBe('/practice'));
    });

    it('lets Words through with ≥2 languages', async () => {
        // The real ReviewPage (Slice 6) fires GET /api/words/simple on mount.
        server.use(...makeWordHandlers({ callerId: baseSession.id }).handlers);

        const user = userEvent.setup();
        const { router } = await renderApp({
            session: { ...baseSession, languages: ['English', 'Spanish'] },
        });

        await user.click(screen.getByRole('link', { name: 'words' }));
        await waitFor(() => expect(router.state.location.pathname).toBe('/words'));
    });
});
