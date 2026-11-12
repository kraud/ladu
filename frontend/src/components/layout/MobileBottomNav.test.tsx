/**
 * Phone bottom nav: five items (Words, Tags, Home, Practice, More), the More drawer with the quick
 * actions, and no hamburger in the header. Walked through the real shell via `renderApp` with a
 * phone-width window.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from '@/test/render';
import { mockMobileViewport, restoreViewport } from '@/test/viewport';
import { futureToken } from '@/test/tokens';
import { server } from '@/test/msw/server';
import { makeWordHandlers } from '@/test/msw/wordHandlers';
import { makeMetricsHandlers } from '@/test/msw/metricsHandlers';
import { makeExercise, makePracticeHandlers } from '@/test/msw/practiceHandlers';
import { defaultParams } from '@/features/practice/params';
import { usePracticeSessionStore } from '@/features/practice/sessionStore';

const session = {
    id: 'u1',
    name: 'Kai Rebane',
    email: 'kai@example.com',
    username: 'kai',
    uiLanguage: 'English',
    nativeLanguage: null,
    verified: true,
    token: futureToken(),
    languages: ['English', 'Spanish'],
};

const nav = () => screen.getByRole('navigation', { name: 'Main navigation' });

describe('MobileBottomNav', () => {
    beforeEach(() => {
        mockMobileViewport();
        server.use(...makeMetricsHandlers().handlers);
    });

    it('shows Words, Tags, Home, Practice and More in that order, and no menu button in the header', async () => {
        await renderApp({ session });

        const labels = within(nav())
            .getAllByRole('link')
            .map((link) => link.textContent);
        expect(labels).toEqual(['words', 'tags', 'Home', 'practice']);
        const items = Array.from(nav().children).map((child) => child.textContent);
        expect(items).toEqual(['words', 'tags', 'Home', 'practice', 'More']);
        expect(screen.queryByRole('button', { name: 'Menu' })).not.toBeInTheDocument();
    });

    it('is not shown on a desktop-width window', async () => {
        restoreViewport();
        await renderApp({ session });
        expect(screen.queryByRole('navigation', { name: 'Main navigation' })).not.toBeInTheDocument();
    });

    it('marks the current page, and Home goes to the Dashboard', async () => {
        server.use(...makeWordHandlers({ callerId: session.id }).handlers);
        const user = userEvent.setup();
        const { router } = await renderApp({ initialEntry: '/words', session });

        expect(within(nav()).getByRole('link', { name: 'words' })).toHaveAttribute('aria-current', 'page');
        expect(within(nav()).getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current');

        await user.click(within(nav()).getByRole('link', { name: 'Home' }));
        await waitFor(() => expect(router.state.location.pathname).toBe('/'));
        expect(within(nav()).getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
    });

    it('blocks Words with <2 languages', async () => {
        const user = userEvent.setup();
        const { router } = await renderApp({ session: { ...session, languages: ['English'] } });

        await user.click(within(nav()).getByRole('link', { name: 'words' }));
        expect(router.state.location.pathname).toBe('/');
        expect(await screen.findByText('Please select at least 2 languages.')).toBeInTheDocument();
    });

    describe('More drawer', () => {
        it('holds the two quick actions, the theme switch and the language picker, and closes with the X', async () => {
            const user = userEvent.setup();
            await renderApp({ session });

            await user.click(within(nav()).getByRole('button', { name: 'More' }));
            const dialog = await screen.findByRole('dialog');
            expect(within(dialog).getByRole('button', { name: 'Random practice' })).toBeInTheDocument();
            expect(within(dialog).getByRole('button', { name: 'New word' })).toBeInTheDocument();
            expect(within(dialog).getByRole('button', { name: /theme/i })).toBeInTheDocument();
            expect(within(dialog).getByRole('button', { name: /language/i })).toBeInTheDocument();

            await user.click(within(dialog).getByRole('button', { name: 'Close' }));
            await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        });

        it('opens the Add word page from New word, and closes the drawer', async () => {
            const user = userEvent.setup();
            const { router } = await renderApp({ session });

            await user.click(within(nav()).getByRole('button', { name: 'More' }));
            await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'New word' }));

            await waitFor(() => expect(router.state.location.pathname).toBe('/addWord'));
            await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        });

        it('starts a session with the default settings from Random practice', async () => {
            usePracticeSessionStore.getState().clear();
            const fake = makePracticeHandlers({ exercises: [makeExercise()] });
            server.use(...fake.handlers);

            const user = userEvent.setup();
            const { router } = await renderApp({ session });

            await user.click(within(nav()).getByRole('button', { name: 'More' }));
            await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Random practice' }));

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
            await renderApp({ session });

            await user.click(within(nav()).getByRole('button', { name: 'More' }));
            await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Random practice' }));

            const leave = await screen.findByRole('button', { name: 'Leave session and delete' });
            expect(fake.state.generateBodies).toHaveLength(0);

            await user.click(leave);
            await waitFor(() => expect(usePracticeSessionStore.getState().session?.exercises[0]?.key).toBe('new'));
            expect(fake.state.generateBodies).toHaveLength(1);
        });
    });
});
