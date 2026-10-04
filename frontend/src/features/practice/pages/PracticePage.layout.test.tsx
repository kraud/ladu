import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from '@/test/render';
import { server } from '@/test/msw/server';
import { makeWordHandlers, type SeedWord } from '@/test/msw/wordHandlers';
import { makeConfig, makeExercise, makePracticeHandlers, makeSavedSession } from '@/test/msw/practiceHandlers';
import { mockMobileViewport } from '@/test/viewport';
import { futureToken } from '@/test/tokens';
import { useAuthStore } from '@/stores/authStore';
import { useUiStore } from '@/stores/uiStore';
import { Lang, PartOfSpeech } from '@/ts/enums';
import { usePracticeSessionStore } from '../sessionStore';

const SESSION = {
    id: 'u1',
    name: 'Kai Rebane',
    email: 'kai@example.com',
    username: 'kai',
    languages: ['English', 'Spanish'],
    uiLanguage: 'English',
    nativeLanguage: null,
    verified: true,
    token: futureToken(),
};

const noun: SeedWord = {
    id: 'w1',
    user: 'u1',
    partOfSpeech: PartOfSpeech.noun,
    translations: [{ language: Lang.EN, cases: [{ caseName: 'singularEN', word: 'house' }] }],
};

function setUp(options: Parameters<typeof makePracticeHandlers>[0] = {}, words: SeedWord[] = [noun]) {
    server.use(...makeWordHandlers({ callerId: 'u1', seed: words }).handlers);
    const fake = makePracticeHandlers({ exercises: [makeExercise()], ...options });
    server.use(...fake.handlers);
    return fake;
}

beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
});

afterEach(() => {
    useAuthStore.getState().clearSession();
    usePracticeSessionStore.getState().clear();
    useUiStore.getState().setPracticePreselection(null);
    useUiStore.getState().setSidebarCollapsed('practice', false);
});

const renderPractice = () => renderApp({ initialEntry: '/practice', session: SESSION });

describe('PracticePage — desktop: settings in the docked sidebar, lists in tabs', () => {
    it('shows the settings in the wide sidebar and the saved lists as tabs, configurations first', async () => {
        setUp({ configs: [makeConfig({ name: 'Morning drill' })], sessions: [makeSavedSession({ id: 'ses-1' })] });
        await renderPractice();

        const panel = await screen.findByRole('complementary', { name: 'Practice settings' });
        expect(within(panel).getByRole('button', { name: 'Start session' })).toBeInTheDocument();
        // The slide-in trigger is a phone control.
        expect(screen.queryByRole('button', { name: 'New session' })).not.toBeInTheDocument();

        expect(screen.getByRole('tab', { name: 'Saved configurations' })).toHaveAttribute('aria-selected', 'true');
        expect(await screen.findByRole('button', { name: 'Use configuration Morning drill' })).toBeInTheDocument();
        // Not at the same time.
        expect(screen.queryByRole('button', { name: 'Resume session with 0 of 2 answered' })).not.toBeInTheDocument();
    });

    it('switching tabs swaps the visible list', async () => {
        const user = userEvent.setup();
        setUp({ configs: [makeConfig({ name: 'Morning drill' })], sessions: [makeSavedSession({ id: 'ses-1' })] });
        await renderPractice();

        await user.click(await screen.findByRole('tab', { name: 'Saved sessions' }));
        expect(await screen.findByRole('button', { name: 'Resume session with 0 of 2 answered' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Use configuration Morning drill' })).not.toBeInTheDocument();

        await user.click(screen.getByRole('tab', { name: 'Saved configurations' }));
        expect(await screen.findByRole('button', { name: 'Use configuration Morning drill' })).toBeInTheDocument();
    });

    it('collapsed, the sidebar is a rail and the settings form is gone from the page', async () => {
        const user = userEvent.setup();
        setUp();
        await renderPractice();

        await user.click(await screen.findByRole('button', { name: 'Collapse sidebar' }));
        expect(useUiStore.getState().sidebarCollapsed.practice).toBe(true);
        expect(screen.queryByRole('button', { name: 'Start session' })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Practice settings' })).toBeInTheDocument();
    });
});

describe('PracticePage — phone: settings in a slide-in menu', () => {
    it('shows a New session button above the tabs, and it opens the settings', async () => {
        mockMobileViewport();
        const user = userEvent.setup();
        setUp();
        await renderPractice();

        expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Start session' })).not.toBeInTheDocument();
        expect(await screen.findByRole('tab', { name: 'Saved configurations' })).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'New session' }));
        const menu = await screen.findByRole('dialog');
        expect(within(menu).getByRole('button', { name: 'Start session' })).toBeInTheDocument();
    });

    it('keeps the settings the user chose when the menu is closed and opened again', async () => {
        mockMobileViewport();
        const user = userEvent.setup();
        setUp();
        await renderPractice();

        await user.click(await screen.findByRole('button', { name: 'New session' }));
        let menu = await screen.findByRole('dialog');
        const amount = within(menu).getByLabelText('Number of exercises');
        await user.clear(amount);
        await user.type(amount, '7');
        await user.click(within(menu).getByRole('button', { name: 'Close menu' }));
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

        await user.click(screen.getByRole('button', { name: 'New session' }));
        menu = await screen.findByRole('dialog');
        expect(within(menu).getByLabelText('Number of exercises')).toHaveValue(7);
    });

    it('loading a saved configuration opens the menu, so the loaded settings are in view', async () => {
        mockMobileViewport();
        const user = userEvent.setup();
        setUp({ configs: [makeConfig({ name: 'Morning drill' })] });
        await renderPractice();

        await user.click(await screen.findByRole('button', { name: 'Use configuration Morning drill' }));
        const menu = await screen.findByRole('dialog');
        expect(within(menu).getByRole('button', { name: 'Start session' })).toBeInTheDocument();
    });
});
