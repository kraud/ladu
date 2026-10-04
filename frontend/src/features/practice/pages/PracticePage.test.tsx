import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from '@/test/render';
import { server } from '@/test/msw/server';
import { makeWordHandlers, type SeedWord } from '@/test/msw/wordHandlers';
import { makeExercise, makePracticeHandlers, type PracticeFakeOptions } from '@/test/msw/practiceHandlers';
import { mockMobileViewport } from '@/test/viewport';
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

        expect(await screen.findByRole('heading', { name: 'Practice' })).toBeInTheDocument();
        expect(pressed('English')).toBeInTheDocument();
        expect(pressed('Español')).toBeInTheDocument();
        expect(pressed('Noun')).toBeInTheDocument();
        expect(pressed('Verb')).toBeInTheDocument();
        expect(screen.getByLabelText('Number of exercises')).toHaveValue(10);
        expect(pressed('Type the answer')).toBeInTheDocument();
        expect(pressed('Mixed')).toBeInTheDocument();
    });

    it('reads settings from the URL', async () => {
        setUp();
        await renderApp({ initialEntry: '/practice?lang=EN&pos=Verb&n=5&card=choice&mode=same', session: SESSION });

        expect(await screen.findByLabelText('Number of exercises')).toHaveValue(5);
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
        expect(screen.getByRole('button', { name: 'Start session' })).toBeDisabled();
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
        expect(screen.getByRole('button', { name: 'Start session' })).toBeDisabled();
    });

    it('disables "Different languages" on a one-language account', async () => {
        setUp();
        await renderApp({ initialEntry: '/practice', session: { ...SESSION, languages: ['English'] } });

        expect(await screen.findByRole('button', { name: 'Different languages' })).toBeDisabled();
        expect(screen.getByText(/Your account has one language/)).toBeInTheDocument();
    });

    it('always says that adjectives and adverbs have no exercises yet, and cannot pick them', async () => {
        setUp();
        const user = userEvent.setup();
        const { router } = await renderApp({ initialEntry: '/practice', session: SESSION });

        expect(await screen.findByText('Adjectives and adverbs have no exercises yet.')).toBeInTheDocument();
        const adjective = screen.getByRole('button', { name: 'Adjective' });
        expect(adjective).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Adverb' })).toBeDisabled();
        expect(adjective.parentElement).toHaveAttribute('title', 'Adjectives and adverbs have no exercises yet.');

        await user.click(adjective);
        expect(adjective).toHaveAttribute('aria-pressed', 'false');
        expect(router.state.location.search).not.toHaveProperty('pos');
    });

    it('drops adjectives and adverbs that come from the URL or the remembered settings', async () => {
        setUp();
        localStorage.setItem(REMEMBERED_KEY, JSON.stringify({ pos: ['Adverb'] }));
        await renderApp({ initialEntry: '/practice?pos=Adjective&pos=Verb', session: SESSION });

        expect(await screen.findByRole('button', { name: 'Verb', pressed: true })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Adjective', pressed: false })).toBeInTheDocument();
    });

    it('shows the mockup header with the subtitle, and the live language hint', async () => {
        setUp();
        const user = userEvent.setup();
        await renderApp({ initialEntry: '/practice', session: SESSION });

        expect(await screen.findByRole('heading', { name: 'Practice' })).toBeInTheDocument();
        expect(screen.getByText('Short sessions from your words')).toBeInTheDocument();
        expect(screen.getByText('All your languages')).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Español' }));
        expect(screen.getByText('1 of 2 languages')).toBeInTheDocument();
    });

    it('explains the "Mixed" language mode and shows the amount range', async () => {
        setUp();
        await renderApp({ initialEntry: '/practice', session: SESSION });

        expect(await screen.findByText(/Mixed shows translations between languages/)).toBeInTheDocument();
        const amount = screen.getByLabelText('Number of exercises');
        expect(amount).toHaveAttribute('type', 'number');
        expect(screen.getByText('1–100')).toBeInTheDocument();
    });

    it('says what to fix while Start is blocked', async () => {
        setUp();
        const user = userEvent.setup();
        await renderApp({ initialEntry: '/practice', session: SESSION });

        expect(screen.queryByText('Fix the highlighted fields to start.')).not.toBeInTheDocument();
        await user.clear(await screen.findByLabelText('Number of exercises'));
        expect(screen.getByText('Fix the highlighted fields to start.')).toBeInTheDocument();
    });

    it('shows only the relevant advanced settings, as a radio list with every description', async () => {
        setUp();
        const user = userEvent.setup();
        await renderApp({ initialEntry: '/practice', session: SESSION });

        await user.click(await screen.findByRole('button', { name: 'Advanced' }));
        // Typing only: choice difficulty is off, strictness is on. No native language on the account.
        expect(screen.getByRole('radio', { name: /Level 0/ })).toHaveAttribute('aria-disabled', 'true');
        expect(screen.getByText('Only used when the answer style shows choices.')).toBeInTheDocument();
        expect(screen.getAllByRole('radio', { name: /Level 2/ })[1]).not.toHaveAttribute('aria-disabled', 'true');
        expect(screen.getByText('Ignores accents and capital letters.')).toBeInTheDocument();
        expect(screen.getByText('Ignores capital letters only.')).toBeInTheDocument();
        expect(screen.queryByText('Native language')).not.toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Choose the answer' }));
        expect(screen.getByRole('radio', { name: /Level 0/ })).not.toHaveAttribute('aria-disabled', 'true');
    });

    it('changes a level through the radio list and mirrors it into the URL', async () => {
        setUp();
        const user = userEvent.setup();
        const { router } = await renderApp({ initialEntry: '/practice', session: SESSION });

        await user.click(await screen.findByRole('button', { name: 'Advanced' }));
        await user.click(within(screen.getByRole('radiogroup', { name: 'Typing strictness' })).getByRole('radio', { name: /Level 3/ }));

        await waitFor(() => expect(router.state.location.search).toMatchObject({ ti: 3 }));
    });

    it('uses chips with full level names on a phone', async () => {
        mockMobileViewport();
        setUp();
        const user = userEvent.setup();
        await renderApp({ initialEntry: '/practice', session: SESSION });

        // The settings are in the slide-in menu on a phone.
        await user.click(await screen.findByRole('button', { name: 'New session' }));
        await user.click(await screen.findByRole('button', { name: 'Advanced' }));
        expect(screen.queryByRole('radio')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Level 0' })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Level 2', pressed: true })).toBeInTheDocument();
        expect(screen.getByText('Ignores capital letters only.')).toBeInTheDocument();
    });

    it('offers the native-language switch only with a native language, named, and not for "Different languages"', async () => {
        setUp();
        const user = userEvent.setup();
        await renderApp({
            initialEntry: '/practice',
            session: { ...SESSION, nativeLanguage: 'Spanish' },
        });

        await user.click(await screen.findByRole('button', { name: 'Advanced' }));
        expect(screen.getByText('Native language')).toBeInTheDocument();
        expect(screen.getByText('Español · affects same-language exercises')).toBeInTheDocument();
        expect(screen.getByText('No same-language exercises in Español.')).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Different languages' }));
        expect(screen.queryByText('Native language')).not.toBeInTheDocument();
    });

    it('starts from the remembered settings on the next visit', async () => {
        setUp();
        localStorage.setItem(REMEMBERED_KEY, JSON.stringify({ n: 7, card: 'choice' }));
        await renderApp({ initialEntry: '/practice', session: SESSION });

        expect(await screen.findByLabelText('Number of exercises')).toHaveValue(7);
        expect(pressed('Choose the answer')).toBeInTheDocument();
    });
});

describe('PracticePage — Start', () => {
    it('sends the settings, starts the session and remembers the settings', async () => {
        const fake = setUp({ exercises: [makeExercise(), makeExercise({ key: 'k2' })] });
        const user = userEvent.setup();
        await renderApp({ initialEntry: '/practice?n=2&card=choice', session: SESSION });

        await user.click(await screen.findByRole('button', { name: 'Start session' }));

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

        await user.click(await screen.findByRole('button', { name: 'Start session' }));

        expect(await screen.findByText('1 of 5 exercises could be created.')).toBeInTheDocument();
    });

    it('stays on the set-up and explains when no exercise was found', async () => {
        setUp({ exercises: [] });
        const user = userEvent.setup();
        await renderApp({ initialEntry: '/practice', session: SESSION });

        await user.click(await screen.findByRole('button', { name: 'Start session' }));

        expect(await screen.findByText('No exercises found')).toBeInTheDocument();
        expect(screen.getByText('There are not enough words with these word types or languages.')).toBeInTheDocument();
        expect(usePracticeSessionStore.getState().session).toBeNull();
        expect(localStorage.getItem(REMEMBERED_KEY)).toBeNull();
    });

    it('"Adjust settings" opens Advanced and hides the explanation', async () => {
        setUp({ exercises: [] });
        const user = userEvent.setup();
        await renderApp({ initialEntry: '/practice', session: SESSION });

        await user.click(await screen.findByRole('button', { name: 'Start session' }));
        expect(await screen.findByText(/leaves nothing to ask/)).toBeInTheDocument();
        expect(screen.queryByRole('radio')).not.toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Adjust settings' }));
        expect(screen.queryByText('No exercises found')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Advanced', expanded: true })).toBeInTheDocument();
    });

    it('shows the error with a retry, and retry works', async () => {
        const fake = setUp({ exercises: [makeExercise()] });
        fake.state.generateFailure = { status: 400, body: { message: 'x', code: 'invalid_amount' } };
        const user = userEvent.setup();
        await renderApp({ initialEntry: '/practice?n=1', session: SESSION });

        await user.click(await screen.findByRole('button', { name: 'Start session' }));
        expect(await screen.findByText('The exercises could not be created')).toBeInTheDocument();
        expect(screen.getByText('Use a whole number from 1 to 100.')).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Try again' }));
        expect(await screen.findByText('Exercise 1 of 1')).toBeInTheDocument();
    });

    it('cannot be started twice while the request runs', async () => {
        const fake = setUp({ exercises: [makeExercise()] });
        const user = userEvent.setup();
        await renderApp({ initialEntry: '/practice?n=1', session: SESSION });

        const start = await screen.findByRole('button', { name: 'Start session' });
        await user.dblClick(start);

        await screen.findByText('Exercise 1 of 1');
        expect(fake.state.generateBodies).toHaveLength(1);
    });
});

describe('PracticePage — no words', () => {
    it('explains and links to Add word', async () => {
        setUp({ words: [] });
        await renderApp({ initialEntry: '/practice', session: SESSION });

        expect(await screen.findByText('No words to practice yet')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Add word' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Start session' })).not.toBeInTheDocument();
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

        // The list is open at first, and can be collapsed.
        expect(screen.getByText('run')).toBeInTheDocument();
        expect(screen.getByText('correr')).toBeInTheDocument();
        expect(screen.getByText('We will change this word list in a later update.')).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Hide words' }));
        expect(screen.queryByText('run')).not.toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Show words' }));
        expect(screen.getByText('run')).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Start session' }));
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

    it('asks before it removes the pre-selection, and the word types open up again', async () => {
        const fake = setUp({ exercises: [makeExercise()] });
        useUiStore.getState().setPracticePreselection(words);
        const user = userEvent.setup();
        await renderApp({ initialEntry: '/practice?n=1', session: SESSION });

        await user.click(await screen.findByRole('button', { name: 'Remove pre-selection' }));
        expect(await screen.findByText('Remove the pre-selection?')).toBeInTheDocument();
        expect(screen.getByText('Practice with 2 selected words')).toBeInTheDocument();

        // "Keep" changes nothing.
        await user.click(screen.getByRole('button', { name: 'Keep' }));
        await waitFor(() => expect(screen.queryByText('Remove the pre-selection?')).not.toBeInTheDocument());
        expect(screen.getByText('Practice with 2 selected words')).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Remove pre-selection' }));
        await user.click(await screen.findByRole('button', { name: 'Remove' }));
        expect(screen.queryByText('Practice with 2 selected words')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Noun' })).toBeEnabled();

        await user.click(screen.getByRole('button', { name: 'Start session' }));
        await screen.findByText('Exercise 1 of 1');
        expect(fake.state.generateBodies[0]).not.toHaveProperty('wordIds');
    });

    it('explains a pre-selection with no word type that has exercises, and blocks Start', async () => {
        setUp();
        useUiStore
            .getState()
            .setPracticePreselection([{ id: 'w9', partOfSpeech: PartOfSpeech.adjective, label: 'big', languages: ['EN'] }]);
        await renderApp({ initialEntry: '/practice', session: SESSION });

        expect(await screen.findByText(/None of the selected words has a word type with exercises/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Start session' })).toBeDisabled();
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
    it('shows the session instead of the set-up, and leaving returns to it', async () => {
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
        await user.click(screen.getByRole('button', { name: 'Leave session' }));
        await user.click(await screen.findByRole('button', { name: 'Leave session and delete' }));
        expect(await screen.findByRole('heading', { name: 'Practice' })).toBeInTheDocument();
    });

    async function renderWithSession() {
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
        return renderApp({ initialEntry: '/practice', session: SESSION });
    }

    it('opens the settings with a banner after leaving the page, and "Resume" goes back to the card', async () => {
        const { router } = await renderWithSession();
        const user = userEvent.setup();
        expect(await screen.findByText('Exercise 1 of 1')).toBeInTheDocument();

        await router.navigate({ to: '/review' });
        await router.navigate({ to: '/practice' });

        expect(await screen.findByRole('heading', { name: 'Practice' })).toBeInTheDocument();
        expect(screen.getByText('You have an unfinished session')).toBeInTheDocument();
        expect(screen.getByText('0 of 1')).toBeInTheDocument();
        expect(screen.getByText('exercises')).toBeInTheDocument();
        expect(screen.getByTestId('flag-grid')).toBeInTheDocument();
        expect(screen.getByTestId('card-type-grid')).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Resume' }));
        expect(await screen.findByText('Exercise 1 of 1')).toBeInTheDocument();
    });

    it('"Dismiss" removes the banner and the stored session', async () => {
        const { router } = await renderWithSession();
        const user = userEvent.setup();
        await screen.findByText('Exercise 1 of 1');

        await router.navigate({ to: '/review' });
        await router.navigate({ to: '/practice' });
        await user.click(await screen.findByRole('button', { name: 'Dismiss' }));

        expect(screen.queryByText('You have an unfinished session')).not.toBeInTheDocument();
        expect(usePracticeSessionStore.getState().session).toBeNull();
    });

    it('drops a finished session when the page is left: no banner on return', async () => {
        const { router } = await renderWithSession();
        await screen.findByText('Exercise 1 of 1');
        usePracticeSessionStore.getState().dispatch({ type: 'answer', index: 0, result: 'correct', given: 'x' });
        usePracticeSessionStore.getState().dispatch({ type: 'finish' });
        expect(usePracticeSessionStore.getState().session?.view).toBe('results');

        await router.navigate({ to: '/review' });
        await router.navigate({ to: '/practice' });

        expect(await screen.findByRole('heading', { name: 'Practice' })).toBeInTheDocument();
        expect(screen.queryByText('You have an unfinished session')).not.toBeInTheDocument();
        expect(usePracticeSessionStore.getState().session).toBeNull();
    });
});
