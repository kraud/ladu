import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from '@/test/render';
import { server } from '@/test/msw/server';
import { makeWordHandlers, type SeedWord } from '@/test/msw/wordHandlers';
import { makeConfig, makeConfigWord, makeExercise, makePracticeHandlers } from '@/test/msw/practiceHandlers';
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
});

const renderPractice = () => renderApp({ initialEntry: '/practice', session: SESSION });

describe('PracticePage — saved configurations', () => {
    it('says so when there are none', async () => {
        setUp();
        await renderPractice();
        expect(await screen.findByText(/You have no saved configurations/)).toBeInTheDocument();
    });

    it('lists the saved configurations with their description and the same three facts as a session', async () => {
        setUp({
            configs: [
                makeConfig({ id: 'a', name: 'Morning drill', description: 'Quick nouns', wordIds: ['w1', 'w2'] }),
                makeConfig({ id: 'b', name: 'Evening' }),
            ],
        });
        await renderPractice();

        const first = await screen.findByRole('button', { name: 'Use configuration Morning drill' });
        expect(within(first).getByText('Quick nouns')).toBeInTheDocument();
        expect(within(first).getByText('12')).toBeInTheDocument();
        expect(within(first).getByText('exercises')).toBeInTheDocument();
        expect(within(first).getByTestId('card-type-grid')).toBeInTheDocument();
        expect(within(first).getByTestId('flag-grid')).toBeInTheDocument();
        expect(within(first).getByText('languages')).toBeInTheDocument();
        expect(within(first).getByText('types of words')).toBeInTheDocument();
        expect(within(first).getByText('2 selected words')).toBeInTheDocument();
        const second = screen.getByRole('button', { name: 'Use configuration Evening' });
        expect(within(second).getByText('All words')).toBeInTheDocument();
        expect(within(second).getByText(/Weaker first|Random order/)).toBeInTheDocument();
    });

    it('shows both answer styles for a "Mixed" configuration', async () => {
        setUp({ configs: [makeConfig({ params: { ...makeConfig().params, type: 'Random' } })] });
        await renderPractice();

        const row = await screen.findByRole('button', { name: 'Use configuration Morning drill' });
        expect(row.querySelector('[data-testid="card-type-grid"]')?.children).toHaveLength(2);
    });

    it('marks a configuration row as clickable: pointer cursor and a highlight on hover', async () => {
        setUp({ configs: [makeConfig()] });
        await renderPractice();

        const row = await screen.findByRole('button', { name: 'Use configuration Morning drill' });
        expect(row).toHaveClass('cursor-pointer');
        expect(row.className).toMatch(/hover:bg-\(--accent-soft\)/);
    });

    it('flags a configuration whose words are gone', async () => {
        setUp({ configs: [makeConfig({ wordIds: ['w1'], missingCount: 1 })] });
        await renderPractice();
        expect(await screen.findByText('Some words are missing')).toBeInTheDocument();
    });

    describe('save', () => {
        it('saves the settings on screen under a name and description, and lists it', async () => {
            const fake = setUp();
            const user = userEvent.setup();
            await renderPractice();

            const amount = await screen.findByLabelText('Number of exercises');
            await user.clear(amount);
            await user.type(amount, '7');
            await user.click(screen.getByRole('button', { name: 'Choose the answer' }));
            await user.click(screen.getByRole('button', { name: 'Save configuration' }));

            const dialog = await screen.findByRole('dialog');
            await user.type(within(dialog).getByLabelText(/Name/), '  Short MC  ');
            await user.type(within(dialog).getByLabelText('Description (optional)'), 'Seven cards');
            await user.click(within(dialog).getByRole('button', { name: 'Save' }));

            await waitFor(() => expect(fake.state.configBodies).toHaveLength(1));
            const { method, body } = fake.state.configBodies[0];
            expect(method).toBe('POST');
            expect(body).toMatchObject({
                name: 'Short MC',
                description: 'Seven cards',
                wordIds: null,
                params: { amount: 7, type: 'Multiple-Choice', languages: ['English', 'Spanish'], strictnessTI: 2 },
            });
            expect(await screen.findByRole('button', { name: 'Use configuration Short MC' })).toBeInTheDocument();
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
            expect(await screen.findByText('Configuration saved.')).toBeInTheDocument();
            // Saving never starts a session.
            expect(fake.state.generateBodies).toHaveLength(0);
        });

        it('saves the pre-selected words', async () => {
            const fake = setUp();
            useUiStore
                .getState()
                .setPracticePreselection([{ id: 'w1', partOfSpeech: PartOfSpeech.noun, label: 'house', languages: ['EN'] }]);
            const user = userEvent.setup();
            await renderPractice();

            await user.click(await screen.findByRole('button', { name: 'Save configuration' }));
            const dialog = await screen.findByRole('dialog');
            expect(within(dialog).getByText('This configuration includes 1 selected word.')).toBeInTheDocument();
            await user.type(within(dialog).getByLabelText(/Name/), 'With house');
            await user.click(within(dialog).getByRole('button', { name: 'Save' }));

            await waitFor(() => expect(fake.state.configBodies[0]?.body.wordIds).toEqual(['w1']));
        });

        it('needs a name', async () => {
            const fake = setUp();
            const user = userEvent.setup();
            await renderPractice();

            await user.click(await screen.findByRole('button', { name: 'Save configuration' }));
            const dialog = await screen.findByRole('dialog');
            await user.click(within(dialog).getByRole('button', { name: 'Save' }));

            expect(within(dialog).getByText('Enter a name.')).toBeInTheDocument();
            expect(fake.state.configBodies).toHaveLength(0);
        });

        it('keeps the dialog open and names the problem when the name is taken', async () => {
            const fake = setUp({ configs: [makeConfig({ name: 'Morning drill' })] });
            const user = userEvent.setup();
            await renderPractice();

            await user.click(await screen.findByRole('button', { name: 'Save configuration' }));
            const dialog = await screen.findByRole('dialog');
            await user.type(within(dialog).getByLabelText(/Name/), 'MORNING DRILL');
            await user.click(within(dialog).getByRole('button', { name: 'Save' }));

            expect(await within(dialog).findByText('You already have a configuration with this name.')).toBeInTheDocument();
            expect(screen.getByRole('dialog')).toBeInTheDocument();
            expect(fake.state.configs).toHaveLength(1);
        });

        it('does not start a session when Enter is pressed in the name field', async () => {
            const fake = setUp();
            const user = userEvent.setup();
            await renderPractice();

            await user.click(await screen.findByRole('button', { name: 'Save configuration' }));
            const dialog = await screen.findByRole('dialog');
            await user.type(within(dialog).getByLabelText(/Name/), 'Enter test{Enter}');

            await waitFor(() => expect(fake.state.configBodies).toHaveLength(1));
            expect(fake.state.generateBodies).toHaveLength(0);
        });

        it('is blocked while the settings are not valid', async () => {
            setUp();
            const user = userEvent.setup();
            await renderPractice();

            await user.clear(await screen.findByLabelText('Number of exercises'));
            expect(screen.getByRole('button', { name: 'Save configuration' })).toBeDisabled();
        });
    });

    describe('load', () => {
        it('fills the form with the saved settings', async () => {
            setUp({
                configs: [
                    makeConfig({
                        params: { ...makeConfig().params, languages: [Lang.ES], amount: 5, multiLang: 'Single-Language', type: 'Text-Input' },
                    }),
                ],
            });
            const user = userEvent.setup();
            const { router } = await renderPractice();

            await user.click(await screen.findByRole('button', { name: 'Use configuration Morning drill' }));

            await waitFor(() => expect(screen.getByLabelText('Number of exercises')).toHaveValue(5));
            expect(screen.getByRole('button', { name: 'Español', pressed: true })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'English', pressed: false })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Same language', pressed: true })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Type the answer', pressed: true })).toBeInTheDocument();
            expect(router.state.location.search).toMatchObject({ n: 5, mode: 'same' });
            expect(await screen.findByText('Configuration "Morning drill" is loaded.')).toBeInTheDocument();
            expect(screen.queryByRole('status')).not.toBeInTheDocument();
        });

        it('starts the loaded settings and words with one tap on Start', async () => {
            const fake = setUp({
                configs: [makeConfig({ wordIds: ['w1'], params: { ...makeConfig().params, amount: 3 } })],
                configWords: [makeConfigWord('w1', 'house')],
            });
            const user = userEvent.setup();
            await renderPractice();

            await user.click(await screen.findByRole('button', { name: 'Use configuration Morning drill' }));
            expect(await screen.findByText('Practice with 1 selected word')).toBeInTheDocument();
            await user.click(screen.getByRole('button', { name: 'Start session' }));

            await waitFor(() => expect(fake.state.generateBodies).toHaveLength(1));
            expect(fake.state.generateBodies[0]).toMatchObject({ amount: 3, wordIds: ['w1'], type: 'Multiple-Choice' });
        });

        it('shows the small banner when some saved words are gone, and still loads the rest', async () => {
            setUp({
                configs: [makeConfig({ wordIds: ['w1', 'w-gone'], missingCount: 1 })],
                configWords: [makeConfigWord('w1', 'house')],
            });
            const user = userEvent.setup();
            await renderPractice();

            await user.click(await screen.findByRole('button', { name: 'Use configuration Morning drill' }));

            expect(await screen.findByText('Some words of this configuration are not available now.')).toBeInTheDocument();
            expect(screen.getByText('Practice with 1 selected word')).toBeInTheDocument();
        });

        it('loads the settings and shows the banner when every saved word is gone', async () => {
            setUp({
                configs: [makeConfig({ wordIds: ['w-gone'], missingCount: 1, params: { ...makeConfig().params, amount: 4 } })],
                configWords: [],
            });
            const user = userEvent.setup();
            await renderPractice();

            await user.click(await screen.findByRole('button', { name: 'Use configuration Morning drill' }));

            expect(await screen.findByText('Some words of this configuration are not available now.')).toBeInTheDocument();
            expect(screen.getByLabelText('Number of exercises')).toHaveValue(4);
            expect(screen.queryByText(/Practice with \d+ selected word/)).not.toBeInTheDocument();
        });

        it('drops the banner when the words are cleared', async () => {
            setUp({
                configs: [makeConfig({ wordIds: ['w1', 'w-gone'], missingCount: 1 })],
                configWords: [makeConfigWord('w1', 'house')],
            });
            const user = userEvent.setup();
            await renderPractice();

            await user.click(await screen.findByRole('button', { name: 'Use configuration Morning drill' }));
            await screen.findByText('Some words of this configuration are not available now.');
            await user.click(screen.getByRole('button', { name: 'Remove pre-selection' }));
            await user.click(await screen.findByRole('button', { name: 'Remove' }));

            await waitFor(() =>
                expect(screen.queryByText('Some words of this configuration are not available now.')).not.toBeInTheDocument(),
            );
        });

        it('replaces words that came from Review', async () => {
            setUp({ configs: [makeConfig({ name: 'No words' })] });
            useUiStore
                .getState()
                .setPracticePreselection([{ id: 'w1', partOfSpeech: PartOfSpeech.noun, label: 'house', languages: ['EN'] }]);
            const user = userEvent.setup();
            await renderPractice();

            expect(await screen.findByText('Practice with 1 selected word')).toBeInTheDocument();
            await user.click(await screen.findByRole('button', { name: 'Use configuration No words' }));
            await waitFor(() => expect(screen.queryByText('Practice with 1 selected word')).not.toBeInTheDocument());
        });

        it('says so when the words cannot be loaded, and changes nothing', async () => {
            const fake = setUp({
                configs: [makeConfig({ wordIds: ['w1'], params: { ...makeConfig().params, amount: 3 } })],
                configWords: [makeConfigWord('w1', 'house')],
            });
            fake.state.failNextConfigWords = true;
            const user = userEvent.setup();
            await renderPractice();

            await user.click(await screen.findByRole('button', { name: 'Use configuration Morning drill' }));

            expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong');
            expect(screen.getByLabelText('Number of exercises')).toHaveValue(10);
        });
    });

    describe('edit', () => {
        it('changes name and description and keeps the settings and words', async () => {
            const config = makeConfig({ wordIds: ['w1'], description: 'Old text' });
            const fake = setUp({ configs: [config], configWords: [makeConfigWord('w1', 'house')] });
            const user = userEvent.setup();
            await renderPractice();

            await user.click(await screen.findByRole('button', { name: 'Edit configuration Morning drill' }));
            const dialog = await screen.findByRole('dialog');
            expect(within(dialog).getByLabelText(/Name/)).toHaveValue('Morning drill');
            expect(within(dialog).getByLabelText('Description (optional)')).toHaveValue('Old text');

            await user.clear(within(dialog).getByLabelText(/Name/));
            await user.type(within(dialog).getByLabelText(/Name/), 'Renamed');
            await user.clear(within(dialog).getByLabelText('Description (optional)'));
            await user.click(within(dialog).getByRole('button', { name: 'Save' }));

            await waitFor(() => expect(fake.state.configBodies).toHaveLength(1));
            expect(fake.state.configBodies[0]).toEqual({
                method: 'PUT',
                id: 'cfg-seed',
                body: { name: 'Renamed', description: null, params: config.params, wordIds: ['w1'] },
            });
            expect(await screen.findByRole('button', { name: 'Use configuration Renamed' })).toBeInTheDocument();
            expect(screen.getByText('Configuration updated.')).toBeInTheDocument();
        });

        it('names the problem when the new name is taken', async () => {
            setUp({ configs: [makeConfig({ id: 'a', name: 'One' }), makeConfig({ id: 'b', name: 'Two' })] });
            const user = userEvent.setup();
            await renderPractice();

            await user.click(await screen.findByRole('button', { name: 'Edit configuration Two' }));
            const dialog = await screen.findByRole('dialog');
            await user.clear(within(dialog).getByLabelText(/Name/));
            await user.type(within(dialog).getByLabelText(/Name/), 'one');
            await user.click(within(dialog).getByRole('button', { name: 'Save' }));

            expect(await within(dialog).findByText('You already have a configuration with this name.')).toBeInTheDocument();
        });
    });

    describe('delete', () => {
        it('asks first, then deletes', async () => {
            const fake = setUp({ configs: [makeConfig({ id: 'a', name: 'One' }), makeConfig({ id: 'b', name: 'Two' })] });
            const user = userEvent.setup();
            await renderPractice();

            await user.click(await screen.findByRole('button', { name: 'Delete configuration One' }));
            expect(await screen.findByText('Delete "One"?')).toBeInTheDocument();
            expect(fake.state.deletedConfigIds).toEqual([]);

            await user.click(screen.getByRole('button', { name: 'Delete' }));

            await waitFor(() => expect(fake.state.deletedConfigIds).toEqual(['a']));
            await waitFor(() =>
                expect(screen.queryByRole('button', { name: 'Use configuration One' })).not.toBeInTheDocument(),
            );
            expect(screen.getByRole('button', { name: 'Use configuration Two' })).toBeInTheDocument();
        });

        it('keeps the configuration when the user cancels', async () => {
            const fake = setUp({ configs: [makeConfig()] });
            const user = userEvent.setup();
            await renderPractice();

            await user.click(await screen.findByRole('button', { name: 'Delete configuration Morning drill' }));
            await user.click(await screen.findByRole('button', { name: 'Cancel' }));

            expect(fake.state.deletedConfigIds).toEqual([]);
            expect(screen.getByRole('button', { name: 'Use configuration Morning drill' })).toBeInTheDocument();
        });
    });
});
