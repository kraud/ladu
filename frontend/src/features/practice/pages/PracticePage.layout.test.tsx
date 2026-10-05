import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from '@/test/render';
import { server } from '@/test/msw/server';
import { makeWordHandlers, type SeedWord } from '@/test/msw/wordHandlers';
import { makeConfig, makeExercise, makePracticeHandlers, makeSavedSession } from '@/test/msw/practiceHandlers';
import { mockMobileViewport } from '@/test/viewport';
import { futureToken } from '@/test/tokens';
import { chooseChangeSettingsFirst, leaveNewConfiguration, openNewConfigurationTab } from '@/test/practiceTabs';
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

describe('PracticePage — list badges', () => {
    it('has two badges in this order, and Ongoing sessions is the one open at first', async () => {
        setUp({ configs: [makeConfig({ name: 'Morning drill' })], sessions: [makeSavedSession({ id: 'ses-1' })] });
        await renderPractice();

        const group = await screen.findByRole('group', { name: 'Lists' });
        const tabs = within(group).getAllByRole('button');
        expect(tabs.map((tab) => tab.textContent)).toEqual(['Ongoing sessions', 'Saved configurations']);
        // New configuration is a button on the title row, not a badge.
        expect(screen.getByRole('button', { name: 'New configuration' })).toBeInTheDocument();
        expect(tabs[0]).toHaveAttribute('aria-pressed', 'true');
        expect(await screen.findByRole('button', { name: 'Resume session with 0 of 2 answered' })).toBeInTheDocument();
        // One list at a time.
        expect(screen.queryByRole('button', { name: 'Use configuration Morning drill' })).not.toBeInTheDocument();
    });

    it('switching badges swaps what is shown', async () => {
        const user = userEvent.setup();
        setUp({ configs: [makeConfig({ name: 'Morning drill' })], sessions: [makeSavedSession({ id: 'ses-1' })] });
        await renderPractice();

        await user.click(await screen.findByRole('button', { name: 'Saved configurations' }));
        expect(await screen.findByRole('button', { name: 'Use configuration Morning drill' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Resume session with 0 of 2 answered' })).not.toBeInTheDocument();

        await openNewConfigurationTab();
        expect(await screen.findByRole('button', { name: 'Start session' })).toBeInTheDocument();
        // The view replaces the badges and the button, and has its own title and a way back.
        expect(screen.getByRole('heading', { name: 'New configuration' })).toBeInTheDocument();
        expect(screen.queryByRole('group', { name: 'Lists' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'New configuration' })).not.toBeInTheDocument();

        await leaveNewConfiguration();
        expect(screen.getByRole('heading', { name: 'Practice' })).toBeInTheDocument();
        expect(screen.getByRole('group', { name: 'Lists' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Start session' })).not.toBeInTheDocument();
    });

    it('keeps the settings when the user goes back to the tabs and returns', async () => {
        const user = userEvent.setup();
        setUp();
        await renderPractice();

        await openNewConfigurationTab();
        const amount = screen.getByLabelText('Number of exercises');
        await user.clear(amount);
        await user.type(amount, '7');

        await leaveNewConfiguration();
        await openNewConfigurationTab();
        expect(screen.getByLabelText('Number of exercises')).toHaveValue(7);
    });

    it('loading a saved configuration switches to New configuration', async () => {
        const user = userEvent.setup();
        setUp({ configs: [makeConfig({ name: 'Morning drill', params: { ...makeConfig().params, amount: 5 } })] });
        await renderPractice();

        await user.click(await screen.findByRole('button', { name: 'Saved configurations' }));
        await user.click(await screen.findByRole('button', { name: 'Use configuration Morning drill' }));
        await chooseChangeSettingsFirst();

        expect(screen.getByRole('heading', { name: 'New configuration' })).toBeInTheDocument();
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
        await user.click(await screen.findByRole('button', { name: 'Saved configurations' }));

        const selected = await screen.findByRole('button', { name: 'Use configuration Selected' });
        expect(within(selected).getByText('2 selected words')).toBeInTheDocument();
        expect(within(selected).getByText('Random order')).toBeInTheDocument();
        const everything = screen.getByRole('button', { name: 'Use configuration Everything' });
        expect(within(everything).getByText('All words')).toBeInTheDocument();
        expect(within(everything).getByText('Weaker first')).toBeInTheDocument();
    });
});

describe('PracticePage — the bottom bar', () => {
    it('on desktop: full labels, and the bar starts after the panel so it lines up with the page', async () => {
        const user = userEvent.setup();
        setUp();
        useUiStore.getState().setPracticePreselection(reviewWords);
        await renderPractice();

        const start = await screen.findByRole('button', { name: 'Start session' });
        expect(screen.getByRole('button', { name: 'Save configuration' })).toBeInTheDocument();
        // Fixed to the window (the layout's footer), with a spacer the width of the panel in front of the column.
        const footer = start.closest('.fixed') as HTMLElement;
        expect(footer).toHaveClass('bottom-0');
        const spacer = footer.querySelector('[aria-hidden="true"]') as HTMLElement;
        expect(spacer).toHaveClass('w-96');

        await user.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
        expect(spacer).toHaveClass('w-14');
    });
});

describe('PracticePage — the words sidebar', () => {
    it('is not on the tabs, even without pre-selected words', async () => {
        setUp();
        await renderPractice();
        await screen.findByRole('button', { name: 'New configuration' });
        expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    });

    it('opens expanded when the user opens New configuration, even if it was collapsed before', async () => {
        setUp();
        useUiStore.getState().setSidebarCollapsed('practice', true);
        await renderPractice();

        await openNewConfigurationTab();
        const panel = await screen.findByRole('complementary', { name: 'Selected words' });
        expect(panel).not.toHaveAttribute('data-collapsed');
        expect(useUiStore.getState().sidebarCollapsed.practice).toBe(false);
        // The panel title has no icon.
        expect(panel.querySelector('h2 svg')).toBeNull();
    });

    it('with words from Review: opens in New configuration and shows the words in the sidebar', async () => {
        setUp();
        useUiStore.getState().setPracticePreselection(reviewWords);
        await renderPractice();

        const panel = await screen.findByRole('complementary', { name: 'Selected words' });
        expect(within(panel).getByText('house')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'New configuration' })).toBeInTheDocument();
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

    it('is only in the New configuration view', async () => {
        setUp();
        useUiStore.getState().setPracticePreselection(reviewWords);
        await renderPractice();
        await screen.findByRole('complementary');

        await leaveNewConfiguration();
        expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
        await openNewConfigurationTab();
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
    it('shows no "New session" button; the settings are in the New configuration view', async () => {
        mockMobileViewport();
        setUp();
        await renderPractice();

        expect(screen.queryByRole('button', { name: 'New session' })).not.toBeInTheDocument();
        await openNewConfigurationTab();
        // Small buttons with short labels, so the bar stays on one row.
        expect(await screen.findByRole('button', { name: 'Start' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Start session' })).not.toBeInTheDocument();
    });

    it('with pre-selected words, the settings card has "All" and "Selected" badges; "Selected" opens the list', async () => {
        mockMobileViewport();
        const user = userEvent.setup();
        setUp();
        useUiStore.getState().setPracticePreselection(reviewWords);
        await renderPractice();

        expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
        const all = await screen.findByRole('button', { name: 'All', pressed: false });
        expect(all.closest('.card')).not.toBeNull();
        const selected = screen.getByRole('button', { name: 'Selected words (1)' });
        expect(selected).toHaveAttribute('data-active', 'true');
        expect(selected).toHaveTextContent('1');
        await user.click(selected);
        const menu = await screen.findByRole('dialog');
        expect(within(menu).getByText('house')).toBeInTheDocument();
    });

    it('with no words selected, "All" is the active badge and "Selected" still opens the list', async () => {
        mockMobileViewport();
        const user = userEvent.setup();
        setUp();
        await renderPractice();
        expect(screen.queryByRole('button', { name: /Selected words/ })).not.toBeInTheDocument();

        await openNewConfigurationTab();
        expect(await screen.findByRole('button', { name: 'All', pressed: true })).toBeInTheDocument();
        const selected = screen.getByRole('button', { name: 'Selected words (0)' });
        expect(selected).not.toHaveAttribute('data-active');
        await user.click(selected);
        expect(await screen.findByRole('dialog')).toBeInTheDocument();
    });

    it('"All" clears the words that came from Review', async () => {
        mockMobileViewport();
        const user = userEvent.setup();
        setUp();
        useUiStore.getState().setPracticePreselection(reviewWords);
        await renderPractice();

        await user.click(await screen.findByRole('button', { name: 'All' }));
        expect(await screen.findByRole('button', { name: 'All', pressed: true })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Selected words (0)' })).toBeInTheDocument();
    });
});
