/**
 * Header nav gating (`pages-auth-shell.md:205`): Add Word and Review need ≥2
 * configured languages; Practice never does. Walked through the real shell on
 * `/` via `renderApp`.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fireEvent } from '@testing-library/react';
import { renderApp } from '@/test/render';
import { mockMobileViewport } from '@/test/viewport';
import { futureToken } from '@/test/tokens';
import { server } from '@/test/msw/server';
import { makeWordHandlers } from '@/test/msw/wordHandlers';
import { makeMetricsHandlers } from '@/test/msw/metricsHandlers';
import { makeExercise, makePracticeHandlers } from '@/test/msw/practiceHandlers';
import { defaultParams } from '@/features/practice/params';
import { usePracticeSessionStore } from '@/features/practice/sessionStore';

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

    it('makes the logo in the menu drawer a link to the Dashboard, and closes the drawer', async () => {
        server.use(...makeWordHandlers({ callerId: baseSession.id }).handlers);

        const user = userEvent.setup();
        const { router } = await renderApp({
            initialEntry: '/words',
            session: { ...baseSession, languages: ['English', 'Spanish'] },
        });

        await user.click(screen.getByRole('button', { name: 'Menu' }));
        const dialog = await screen.findByRole('dialog');
        await user.click(within(dialog).getByRole('link', { name: 'Ladu' }));

        await waitFor(() => expect(router.state.location.pathname).toBe('/'));
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });

    describe('phone menu swipes', () => {
        it('opens with a swipe from the left edge, and closes with a swipe to the left', async () => {
            mockMobileViewport();
            await renderApp({ session: { ...baseSession, languages: ['English', 'Spanish'] } });
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

            fireEvent.touchStart(document.body, { touches: [{ clientX: 6, clientY: 300 }] });
            fireEvent.touchEnd(document.body, { changedTouches: [{ clientX: 180, clientY: 310 }] });
            const dialog = await screen.findByRole('dialog');

            fireEvent.touchStart(dialog, { touches: [{ clientX: 200, clientY: 300 }] });
            fireEvent.touchEnd(dialog, { changedTouches: [{ clientX: 60, clientY: 305 }] });
            await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        });

        it('does not open on a desktop-width window', async () => {
            await renderApp({ session: { ...baseSession, languages: ['English', 'Spanish'] } });

            fireEvent.touchStart(document.body, { touches: [{ clientX: 6, clientY: 300 }] });
            fireEvent.touchEnd(document.body, { changedTouches: [{ clientX: 180, clientY: 300 }] });
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });
    });

    describe('phone menu', () => {
        it('puts an icon on the left of each link', async () => {
            const user = userEvent.setup();
            await renderApp({ session: { ...baseSession, languages: ['English', 'Spanish'] } });

            await user.click(screen.getByRole('button', { name: 'Menu' }));
            const dialog = await screen.findByRole('dialog');
            for (const name of ['words', 'tags', 'practice']) {
                const link = within(dialog).getByRole('link', { name });
                expect(link.querySelector('svg')).not.toBeNull();
            }
        });

        it('opens the Add word page from the New word button, and closes the menu', async () => {
            const user = userEvent.setup();
            const { router } = await renderApp({ session: { ...baseSession, languages: ['English', 'Spanish'] } });

            await user.click(screen.getByRole('button', { name: 'Menu' }));
            const dialog = await screen.findByRole('dialog');
            await user.click(within(dialog).getByRole('button', { name: 'New word' }));

            await waitFor(() => expect(router.state.location.pathname).toBe('/addWord'));
            await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        });

        it('starts a session with the default settings from the Random practice button', async () => {
            usePracticeSessionStore.getState().clear();
            const fake = makePracticeHandlers({ exercises: [makeExercise()] });
            server.use(...fake.handlers);

            const user = userEvent.setup();
            const { router } = await renderApp({ session: { ...baseSession, languages: ['English', 'Spanish'] } });

            await user.click(screen.getByRole('button', { name: 'Menu' }));
            const dialog = await screen.findByRole('dialog');
            await user.click(within(dialog).getByRole('button', { name: 'Random practice' }));

            await waitFor(() => expect(router.state.location.pathname).toBe('/practice'));
            expect(fake.state.generateBodies).toHaveLength(1);
            expect(usePracticeSessionStore.getState().session?.exercises).toHaveLength(1);
        });

        it('asks first when a session is open, and starts the random one only after the user leaves it', async () => {
            const fake = makePracticeHandlers({ exercises: [makeExercise({ key: 'new' })] });
            server.use(...fake.handlers);
            usePracticeSessionStore.getState().start({
                userId: 'u1',
                params: defaultParams(['English', 'Spanish']),
                wordIds: null,
                exercises: [makeExercise({ key: 'old' })],
            });

            const user = userEvent.setup();
            await renderApp({ session: { ...baseSession, languages: ['English', 'Spanish'] } });

            await user.click(screen.getByRole('button', { name: 'Menu' }));
            await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Random practice' }));

            // The leave dialog, not a new session yet.
            const leave = await screen.findByRole('button', { name: 'Leave session and delete' });
            expect(fake.state.generateBodies).toHaveLength(0);

            await user.click(leave);
            await waitFor(() => expect(usePracticeSessionStore.getState().session?.exercises[0]?.key).toBe('new'));
            expect(fake.state.generateBodies).toHaveLength(1);
        });
    });
});
