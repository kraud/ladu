import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from '@/test/render';
import { server } from '@/test/msw/server';
import { makeWordHandlers, type SeedWord } from '@/test/msw/wordHandlers';
import { makeExercise, makePracticeHandlers, type PracticeFakeOptions } from '@/test/msw/practiceHandlers';
import { futureToken } from '@/test/tokens';
import { useAuthStore } from '@/stores/authStore';
import { useUiStore } from '@/stores/uiStore';
import { Lang, PartOfSpeech } from '@/ts/enums';
import { REMEMBERED_KEY } from '../remembered';
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

function setUp(options: { words?: SeedWord[] } & PracticeFakeOptions = {}) {
    const { words = [noun], ...practice } = options;
    server.use(...makeWordHandlers({ callerId: 'u1', seed: words }).handlers);
    const fake = makePracticeHandlers(practice);
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

const pressed = (name: string) => screen.getByRole('button', { name, pressed: true });

describe('PracticePage — set-up', () => {
    it('shows the documented defaults', async () => {
        setUp();
        await renderApp({ initialEntry: '/practice', session: SESSION });

        expect(await screen.findByRole('heading', { name: 'Set up your practice' })).toBeInTheDocument();
        expect(pressed('English')).toBeInTheDocument();
        expect(pressed('Español')).toBeInTheDocument();
        expect(pressed('Noun')).toBeInTheDocument();
        expect(pressed('Verb')).toBeInTheDocument();
        expect(screen.getByLabelText('Number of exercises')).toHaveValue('10');
        expect(pressed('Type the answer')).toBeInTheDocument();
        expect(pressed('Mixed')).toBeInTheDocument();
    });

    it('reads settings from the URL', async () => {
        setUp();
        await renderApp({ initialEntry: '/practice?lang=EN&pos=Verb&n=5&card=choice&mode=same', session: SESSION });

        expect(await screen.findByLabelText('Number of exercises')).toHaveValue('5');
        expect(pressed('Verb')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Noun', pressed: false })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Español', pressed: false })).toBeInTheDocument();
        expect(pressed('Choose the answer')).toBeInTheDocument();
        expect(pressed('Same language')).toBeInTheDocument();
    });

    it('mirrors a change into the URL', async () => {
        setUp();
        const user = userEvent.setup();
        const { router } = await renderApp({ initialEntry: '/practice', session: SESSION });

        await user.click(await screen.findByRole('button', { name: 'Choose the answer' }));

        await waitFor(() => expect(router.state.location.search).toMatchObject({ card: 'choice' }));
    });

    it('blocks Start with a field error and keeps the bad amount out of the URL', async () => {
        setUp();
        const user = userEvent.setup();
        const { router } = await renderApp({ initialEntry: '/practice', session: SESSION });

        const amount = await screen.findByLabelText('Number of exercises');
        await user.clear(amount);
        await user.type(amount, '0');

        expect(screen.getByText('Use a number of 1 or more.')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Start' })).toBeDisabled();
        expect(router.state.location.search).not.toHaveProperty('n', 0);

        await user.clear(amount);
        expect(screen.getByText('Enter a number.')).toBeInTheDocument();
        await user.clear(amount);
        await user.type(amount, '101');
        expect(screen.getByText('Use a number of 100 or less.')).toBeInTheDocument();
    });

    it('asks for two languages when "Different languages" is chosen', async () => {
        setUp();
        const user = userEvent.setup();
        await renderApp({ initialEntry: '/practice?mode=different', session: SESSION });

        await user.click(await screen.findByRole('button', { name: 'Español' }));

        expect(screen.getByText(/Select at least two languages/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Start' })).toBeDisabled();
    });

    it('disables "Different languages" on a one-language account', async () => {
        setUp();
        await renderApp({ initialEntry: '/practice', session: { ...SESSION, languages: ['English'] } });

        expect(await screen.findByRole('button', { name: 'Different languages' })).toBeDisabled();
        expect(screen.getByText(/Your account has one language/)).toBeInTheDocument();
    });

    it('notes that adjectives and adverbs have no exercises yet', async () => {
        setUp();
        const user = userEvent.setup();
        await renderApp({ initialEntry: '/practice', session: SESSION });

        expect(screen.queryByText('Adjectives and adverbs have no exercises yet.')).not.toBeInTheDocument();
        await user.click(await screen.findByRole('button', { name: 'Adjective' }));
        expect(screen.getByText('Adjectives and adverbs have no exercises yet.')).toBeInTheDocument();
    });

    it('shows only the relevant advanced settings', async () => {
        setUp();
        const user = userEvent.setup();
        await renderApp({ initialEntry: '/practice', session: SESSION });

        await user.click(await screen.findByRole('button', { name: 'Show advanced settings' }));
        // Typing only: choice difficulty is off, strictness is on. No native language on the account.
        expect(screen.getByRole('button', { name: 'L0' })).toBeDisabled();
        expect(screen.getByText('Only used when the answer style shows choices.')).toBeInTheDocument();
        expect(screen.getByText('Ignores capital letters only.')).toBeInTheDocument();
        expect(screen.queryByText('Native language')).not.toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Choose the answer' }));
        expect(screen.getAllByRole('button', { name: 'L0' })[0]).toBeEnabled();
    });

    it('offers the native-language switch only with a native language and not for "Different languages"', async () => {
        setUp();
        const user = userEvent.setup();
        await renderApp({
            initialEntry: '/practice',
            session: { ...SESSION, nativeLanguage: 'Spanish' },
        });

        await user.click(await screen.findByRole('button', { name: 'Show advanced settings' }));
        expect(screen.getByText('Native language')).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Different languages' }));
        expect(screen.queryByText('Native language')).not.toBeInTheDocument();
    });

    it('starts from the remembered settings on the next visit', async () => {
        setUp();
        localStorage.setItem(REMEMBERED_KEY, JSON.stringify({ n: 7, card: 'choice' }));
        await renderApp({ initialEntry: '/practice', session: SESSION });

        expect(await screen.findByLabelText('Number of exercises')).toHaveValue('7');
        expect(pressed('Choose the answer')).toBeInTheDocument();
    });
});

describe('PracticePage — Start', () => {
    it('sends the settings, starts the session and remembers the settings', async () => {
        const fake = setUp({ exercises: [makeExercise(), makeExercise({ key: 'k2' })] });
        const user = userEvent.setup();
        await renderApp({ initialEntry: '/practice?n=2&card=choice', session: SESSION });

        await user.click(await screen.findByRole('button', { name: 'Start' }));

        expect(await screen.findByText('Exercise 1 of 2')).toBeInTheDocument();
        expect(fake.state.generateBodies).toHaveLength(1);
        expect(fake.state.generateBodies[0]).toMatchObject({
            amount: 2,
            type: 'Multiple-Choice',
            languages: [Lang.EN, Lang.ES],
            partsOfSpeech: [PartOfSpeech.noun, PartOfSpeech.verb],
        });
        expect(fake.state.generateBodies[0]).not.toHaveProperty('wordIds');
        expect(usePracticeSessionStore.getState().session?.userId).toBe('u1');
        expect(localStorage.getItem(REMEMBERED_KEY)).toContain('"n":2');
    });

    it('says how many exercises could be created when there are fewer than asked', async () => {
        setUp({ exercises: [makeExercise()] });
        const user = userEvent.setup();
        await renderApp({ initialEntry: '/practice?n=5', session: SESSION });

        await user.click(await screen.findByRole('button', { name: 'Start' }));

        expect(await screen.findByText('1 of 5 exercises could be created.')).toBeInTheDocument();
    });

    it('stays on the set-up and explains when no exercise was found', async () => {
        setUp({ exercises: [] });
        const user = userEvent.setup();
        await renderApp({ initialEntry: '/practice', session: SESSION });

        await user.click(await screen.findByRole('button', { name: 'Start' }));

        expect(await screen.findByText('No exercises found')).toBeInTheDocument();
        expect(screen.getByText('There are not enough words with these word types or languages.')).toBeInTheDocument();
        expect(usePracticeSessionStore.getState().session).toBeNull();
        expect(localStorage.getItem(REMEMBERED_KEY)).toBeNull();
    });

    it('names the real reason when only adjectives or adverbs are selected', async () => {
        setUp({ exercises: [] });
        const user = userEvent.setup();
        await renderApp({ initialEntry: '/practice?pos=Adjective', session: SESSION });

        await user.click(await screen.findByRole('button', { name: 'Start' }));

        expect(await screen.findByText('Only adjectives or adverbs are selected.')).toBeInTheDocument();
        expect(screen.queryByText(/not enough words/)).not.toBeInTheDocument();
    });

    it('shows the error with a retry, and retry works', async () => {
        const fake = setUp({ exercises: [makeExercise()] });
        fake.state.generateFailure = { status: 400, body: { message: 'x', code: 'invalid_amount' } };
        const user = userEvent.setup();
        await renderApp({ initialEntry: '/practice?n=1', session: SESSION });

        await user.click(await screen.findByRole('button', { name: 'Start' }));
        expect(await screen.findByText('The exercises could not be created')).toBeInTheDocument();
        expect(screen.getByText('Use a whole number from 1 to 100.')).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Try again' }));
        expect(await screen.findByText('Exercise 1 of 1')).toBeInTheDocument();
    });

    it('cannot be started twice while the request runs', async () => {
        const fake = setUp({ exercises: [makeExercise()] });
        const user = userEvent.setup();
        await renderApp({ initialEntry: '/practice?n=1', session: SESSION });

        const start = await screen.findByRole('button', { name: 'Start' });
        await user.dblClick(start);

        await screen.findByText('Exercise 1 of 1');
        expect(fake.state.generateBodies).toHaveLength(1);
    });
});

describe('PracticePage — no words', () => {
    it('explains and links to Add word', async () => {
        setUp({ words: [] });
        await renderApp({ initialEntry: '/practice', session: SESSION });

        expect(await screen.findByText('You have no words yet')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Add word' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Start' })).not.toBeInTheDocument();
    });
});

describe('PracticePage — pre-selected words', () => {
    const words = [
        { id: 'w1', partOfSpeech: PartOfSpeech.verb, label: 'run', languages: ['EN' as const] },
        { id: 'w2', partOfSpeech: PartOfSpeech.verb, label: 'correr', languages: ['ES' as const] },
    ];

    it('shows the words, limits the word types, and sends the ids', async () => {
        const fake = setUp({ exercises: [makeExercise()] });
        useUiStore.getState().setPracticePreselection(words);
        const user = userEvent.setup();
        await renderApp({ initialEntry: '/practice?n=1', session: SESSION });

        expect(await screen.findByText('Practice with 2 selected words')).toBeInTheDocument();
        expect(pressed('Verb')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Noun' })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Noun' })).toHaveAttribute('aria-pressed', 'false');

        await user.click(screen.getByRole('button', { name: 'Show words' }));
        expect(screen.getByText('run')).toBeInTheDocument();
        expect(screen.getByText('correr')).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Start' }));
        await screen.findByText('Exercise 1 of 1');
        expect(fake.state.generateBodies[0]).toMatchObject({ wordIds: ['w1', 'w2'], partsOfSpeech: [PartOfSpeech.verb] });
        expect(usePracticeSessionStore.getState().session?.wordIds).toEqual(['w1', 'w2']);
    });

    it('is read once: the hand-off slot is empty afterwards', async () => {
        setUp();
        useUiStore.getState().setPracticePreselection(words);
        await renderApp({ initialEntry: '/practice', session: SESSION });

        await screen.findByText('Practice with 2 selected words');
        expect(useUiStore.getState().practicePreselection).toBeNull();
    });

    it('goes back to all words, and the word types open up again', async () => {
        const fake = setUp({ exercises: [makeExercise()] });
        useUiStore.getState().setPracticePreselection(words);
        const user = userEvent.setup();
        await renderApp({ initialEntry: '/practice?n=1', session: SESSION });

        await user.click(await screen.findByRole('button', { name: 'Use all my words' }));
        expect(screen.queryByText('Practice with 2 selected words')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Noun' })).toBeEnabled();

        await user.click(screen.getByRole('button', { name: 'Start' }));
        await screen.findByText('Exercise 1 of 1');
        expect(fake.state.generateBodies[0]).not.toHaveProperty('wordIds');
    });

    it('replaces a running session', async () => {
        setUp();
        usePracticeSessionStore.getState().start({
            userId: 'u1',
            params: {
                languages: [Lang.EN],
                partsOfSpeech: [PartOfSpeech.noun],
                amount: 1,
                type: 'Text-Input',
                multiLang: 'Random',
                difficultyMC: 1,
                strictnessTI: 2,
                wordSelection: 'Exercise-Performance',
                excludeNative: false,
            },
            wordIds: null,
            exercises: [makeExercise()],
        });
        useUiStore.getState().setPracticePreselection(words);
        await renderApp({ initialEntry: '/practice', session: SESSION });

        expect(await screen.findByText('Practice with 2 selected words')).toBeInTheDocument();
        expect(usePracticeSessionStore.getState().session).toBeNull();
    });
});

describe('PracticePage — running session', () => {
    it('shows the session instead of the set-up, and "Change settings" returns to it', async () => {
        setUp();
        usePracticeSessionStore.getState().start({
            userId: 'u1',
            params: {
                languages: [Lang.EN],
                partsOfSpeech: [PartOfSpeech.noun],
                amount: 1,
                type: 'Text-Input',
                multiLang: 'Random',
                difficultyMC: 1,
                strictnessTI: 2,
                wordSelection: 'Exercise-Performance',
                excludeNative: false,
            },
            wordIds: null,
            exercises: [makeExercise()],
        });
        const user = userEvent.setup();
        await renderApp({ initialEntry: '/practice', session: SESSION });

        expect(await screen.findByText('Exercise 1 of 1')).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Change settings' }));
        expect(await screen.findByRole('heading', { name: 'Set up your practice' })).toBeInTheDocument();
    });
});
