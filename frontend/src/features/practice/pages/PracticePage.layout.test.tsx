import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
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

const reviewWords = [{ id: 'w1', partOfSpeech: PartOfSpeech.noun, label: 'house', languages: ['EN' as const] }];

function setUp(options: Parameters<typeof makePracticeHandlers>[0] = {}) {
    server.use(...makeWordHandlers({ callerId: 'u1', seed: [noun] }).handlers);
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

describe('PracticePage — tabs', () => {
    it('has three tabs in this order, and Ongoing sessions is the one open at first', async () => {
        setUp({ configs: [makeConfig({ name: 'Morning drill' })], sessions: [makeSavedSession({ id: 'ses-1' })] });
        await renderPractice();

        const tabs = await screen.findAllByRole('tab');
        expect(tabs.map((tab) => tab.textContent)).toEqual(['Ongoing sessions', 'Saved configurations', 'New configuration']);
        expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
        expect(await screen.findByRole('button', { name: 'Resume session with 0 of 2 answered' })).toBeInTheDocument();
        // One list at a time.
        expect(screen.queryByRole('button', { name: 'Use configuration Morning drill' })).not.toBeInTheDocument();
    });

    it('switching tabs swaps what is shown', async () => {
        const user = userEvent.setup();
        setUp({ configs: [makeConfig({ name: 'Morning drill' })], sessions: [makeSavedSession({ id: 'ses-1' })] });
        await renderPractice();

        await user.click(await screen.findByRole('tab', { name: 'Saved configurations' }));
        expect(await screen.findByRole('button', { name: 'Use configuration Morning drill' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Resume session with 0 of 2 answered' })).not.toBeInTheDocument();

        await user.click(screen.getByRole('tab', { name: 'New configuration' }));
        expect(await screen.findByRole('button', { name: 'Start session' })).toBeInTheDocument();
    });

    it('keeps the settings when the user looks at another tab and comes back', async () => {
        const user = userEvent.setup();
        setUp();
        await renderPractice();

        await user.click(await screen.findByRole('tab', { name: 'New configuration' }));
        const amount = screen.getByLabelText('Number of exercises');
        await user.clear(amount);
        await user.type(amount, '7');

        await user.click(screen.getByRole('tab', { name: 'Ongoing sessions' }));
        await user.click(screen.getByRole('tab', { name: 'New configuration' }));
        expect(screen.getByLabelText('Number of exercises')).toHaveValue(7);
    });

    it('loading a saved configuration switches to New configuration', async () => {
        const user = userEvent.setup();
        setUp({ configs: [makeConfig({ name: 'Morning drill', params: { ...makeConfig().params, amount: 5 } })] });
        await renderPractice();

        await user.click(await screen.findByRole('tab', { name: 'Saved configurations' }));
        await user.click(await screen.findByRole('button', { name: 'Use configuration Morning drill' }));

        expect(screen.getByRole('tab', { name: 'New configuration' })).toHaveAttribute('aria-selected', 'true');
        expect(await screen.findByLabelText('Number of exercises')).toHaveValue(5);
    });
});

describe('PracticePage — the cards of saved configurations', () => {
    it('shows words and order as two pills in their own column', async () => {
        const user = userEvent.setup();
        setUp({
            configs: [
                makeConfig({ id: 'a', name: 'Selected', wordIds: ['w1', 'w2'], params: { ...makeConfig().params, wordSelection: 'Random' } }),
                makeConfig({ id: 'b', name: 'Everything', wordIds: null, params: { ...makeConfig().params, wordSelection: 'Exercise-Performance' } }),
            ],
        });
        await renderPractice();
        await user.click(await screen.findByRole('tab', { name: 'Saved configurations' }));

        const selected = await screen.findByRole('button', { name: 'Use configuration Selected' });
        expect(within(selected).getByText('2 selected words')).toBeInTheDocument();
        expect(within(selected).getByText('Random order')).toBeInTheDocument();
        const everything = screen.getByRole('button', { name: 'Use configuration Everything' });
        expect(within(everything).getByText('All words')).toBeInTheDocument();
        expect(within(everything).getByText('Weaker first')).toBeInTheDocument();
    });
});

describe('PracticePage — the words sidebar', () => {
    it('is not on the Ongoing sessions tab, even without pre-selected words', async () => {
        setUp();
        await renderPractice();
        await screen.findByRole('tab', { name: 'New configuration' });
        expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    });

    it('with words from Review: opens on New configuration and shows the words in the sidebar', async () => {
        setUp();
        useUiStore.getState().setPracticePreselection(reviewWords);
        await renderPractice();

        const panel = await screen.findByRole('complementary', { name: 'Selected words' });
        expect(within(panel).getByText('house')).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: 'New configuration' })).toHaveAttribute('aria-selected', 'true');
        // The settings are in the main area, not in the sidebar.
        expect(within(panel).queryByRole('button', { name: 'Start session' })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Start session' })).toBeInTheDocument();
    });

    it('follows the settings: a language the user unselects marks the word as not used', async () => {
        const user = userEvent.setup();
        setUp();
        useUiStore.getState().setPracticePreselection(reviewWords);
        await renderPractice();

        const panel = await screen.findByRole('complementary');
        expect(within(panel).getByText('house').closest('li')).toHaveAttribute('data-used', 'true');

        // The word has an English translation only: without English it is not used.
        await user.click(screen.getByRole('button', { name: 'English', pressed: true }));
        expect(within(panel).getByText('house').closest('li')).toHaveAttribute('data-used', 'false');
        expect(within(panel).getByText('0 of 1 words will be used with these settings.')).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'English', pressed: false }));
        expect(within(panel).getByText('house').closest('li')).toHaveAttribute('data-used', 'true');
    });

    it('is only on the New configuration tab', async () => {
        const user = userEvent.setup();
        setUp();
        useUiStore.getState().setPracticePreselection(reviewWords);
        await renderPractice();
        await screen.findByRole('complementary');

        await user.click(screen.getByRole('tab', { name: 'Ongoing sessions' }));
        expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
        await user.click(screen.getByRole('tab', { name: 'New configuration' }));
        expect(await screen.findByRole('complementary')).toBeInTheDocument();
    });

    it('collapses to a rail', async () => {
        const user = userEvent.setup();
        setUp();
        useUiStore.getState().setPracticePreselection(reviewWords);
        await renderPractice();

        await user.click(await screen.findByRole('button', { name: 'Collapse sidebar' }));
        expect(useUiStore.getState().sidebarCollapsed.practice).toBe(true);
        expect(screen.queryByText('house')).not.toBeInTheDocument();
        expect(screen.getByTestId('words-count')).toHaveTextContent('1');
    });
});

describe('PracticePage — phone', () => {
    it('shows no "New session" button; the settings are the New configuration tab', async () => {
        mockMobileViewport();
        const user = userEvent.setup();
        setUp();
        await renderPractice();

        expect(screen.queryByRole('button', { name: 'New session' })).not.toBeInTheDocument();
        await user.click(await screen.findByRole('tab', { name: 'New configuration' }));
        expect(await screen.findByRole('button', { name: 'Start session' })).toBeInTheDocument();
    });

    it('with pre-selected words, a "Selected words (N)" button opens the list in a slide-in', async () => {
        mockMobileViewport();
        const user = userEvent.setup();
        setUp();
        useUiStore.getState().setPracticePreselection(reviewWords);
        await renderPractice();

        expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
        await user.click(await screen.findByRole('button', { name: 'Selected words (1)' }));
        const menu = await screen.findByRole('dialog');
        expect(within(menu).getByText('house')).toBeInTheDocument();
    });

    it('without pre-selected words there is no such button', async () => {
        mockMobileViewport();
        setUp();
        await renderPractice();
        await screen.findByRole('tab', { name: 'New configuration' });
        expect(screen.queryByRole('button', { name: /Selected words/ })).not.toBeInTheDocument();
    });
});
