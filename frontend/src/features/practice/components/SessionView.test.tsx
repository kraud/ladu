import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from '@/test/render';
import { server } from '@/test/msw/server';
import { makeExercise, makePracticeHandlers } from '@/test/msw/practiceHandlers';
import { makeWordHandlers } from '@/test/msw/wordHandlers';
import { futureToken } from '@/test/tokens';
import { useAuthStore } from '@/stores/authStore';
import { Lang, PartOfSpeech } from '@/ts/enums';
import { defaultParams } from '../params';
import { usePracticeSessionStore } from '../sessionStore';
import type { Exercise, PracticeParams } from '../types';

const SESSION = {
    id: 'u1',
    name: 'Kai Rebane',
    email: 'kai@example.com',
    username: 'kai',
    languages: ['English', 'Spanish', 'German'],
    uiLanguage: 'English',
    nativeLanguage: null,
    verified: true,
    token: futureToken(),
};

const choice = (overrides: Partial<Exercise> = {}) =>
    makeExercise({
        key: 'mc',
        type: 'Multiple-Choice',
        options: ['casa', 'perro', 'gato'],
        ...overrides,
    });

async function open(exercises: Exercise[], params: Partial<PracticeParams> = {}, fakeOptions = {}) {
    const fake = makePracticeHandlers(fakeOptions);
    server.use(...fake.handlers);
    usePracticeSessionStore.getState().start({
        userId: 'u1',
        params: { ...defaultParams(SESSION.languages), ...params },
        wordIds: null,
        exercises,
    });
    await renderApp({ initialEntry: '/practice', session: SESSION });
    return fake;
}

beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
});

afterEach(() => {
    useAuthStore.getState().clearSession();
    usePracticeSessionStore.getState().clear();
});

describe('SessionView — typed answers', () => {
    it('shows the prompt, the task, and focuses the answer field', async () => {
        await open([makeExercise()]);

        expect(await screen.findByText('Exercise 1 of 1')).toBeInTheDocument();
        expect(screen.getByTestId('prompt')).toHaveTextContent('house');
        expect(screen.getByText('Same form in Español')).toBeInTheDocument();
        expect(screen.getByLabelText('Your answer')).toHaveFocus();
    });

    it('does not send an empty answer', async () => {
        const fake = await open([makeExercise()]);
        const user = userEvent.setup();

        expect(await screen.findByRole('button', { name: 'Check' })).toBeDisabled();
        await user.type(screen.getByLabelText('Your answer'), '   {Enter}');

        expect(fake.state.answers).toHaveLength(0);
        expect(usePracticeSessionStore.getState().session?.answers[0]).toBeNull();
    });

    it('marks a correct answer, saves it, and moves focus to Next', async () => {
        const fake = await open([makeExercise(), makeExercise({ key: 'k2' })]);
        const user = userEvent.setup();

        await user.type(await screen.findByLabelText('Your answer'), 'casa{Enter}');

        expect(await screen.findByText('Correct', { selector: 'b' })).toBeInTheDocument();
        await waitFor(() => expect(screen.getByText('Saved')).toBeInTheDocument());
        expect(fake.state.answers).toEqual([{ translationId: 'tr-es-1', caseName: 'singularES', result: 'correct' }]);
        expect(screen.getByLabelText('Your answer')).toHaveAttribute('readonly');
        expect(screen.getByRole('button', { name: 'Next' })).toHaveFocus();
    });

    it('sends only one save when Enter is pressed twice', async () => {
        const fake = await open([makeExercise()]);
        const user = userEvent.setup();

        await user.type(await screen.findByLabelText('Your answer'), 'casa{Enter}');
        await screen.findByText('Saved');

        expect(fake.state.answers).toHaveLength(1);
    });

    it('calls a capital-letter difference "almost correct" and shows the exact form', async () => {
        const fake = await open([makeExercise()], { strictnessTI: 2 });
        const user = userEvent.setup();

        await user.type(await screen.findByLabelText('Your answer'), 'CASA{Enter}');

        expect(await screen.findByText('Almost correct', { selector: 'b' })).toBeInTheDocument();
        expect(screen.getByText('Correct answer: casa')).toBeInTheDocument();
        await screen.findByText('Saved');
        expect(fake.state.answers[0]?.result).toBe('partial');
    });

    it('shows the expected answer and the typed answer when wrong', async () => {
        await open([makeExercise()]);
        const user = userEvent.setup();

        await user.type(await screen.findByLabelText('Your answer'), 'perro{Enter}');

        expect(await screen.findByText('Wrong', { selector: 'b' })).toBeInTheDocument();
        expect(screen.getByText('Correct answer: casa')).toBeInTheDocument();
        expect(screen.getByText('Your answer: perro')).toBeInTheDocument();
    });

    it('shows the pronoun of a verb form next to the field', async () => {
        await open([
            makeExercise({
                partOfSpeech: PartOfSpeech.verb,
                prompt: { language: Lang.EN, caseName: 'simplePresent1sEN', value: 'dance' },
                answer: { language: Lang.ES, caseName: 'indicativePresent1sES', value: 'bailo' },
            }),
        ]);

        expect(await screen.findByTestId('answer-pronoun')).toHaveTextContent('Yo');
        expect(screen.getAllByText('Present · 1st person singular', { exact: false }).length).toBeGreaterThan(0);
    });

    it('asks a question for a same-language drill', async () => {
        await open([
            makeExercise({
                multiLang: false,
                type: 'Multiple-Choice',
                options: ['der', 'die', 'das'],
                prompt: { language: Lang.DE, caseName: 'singularNominativDE', value: 'Haus' },
                answer: { language: Lang.DE, caseName: 'genderDE', value: 'das' },
            }),
        ]);

        expect(await screen.findByText('What is the gender of this word?')).toBeInTheDocument();
    });
});

describe('SessionView — choices', () => {
    it('marks the chosen and the correct option after a wrong pick, and locks the card', async () => {
        const fake = await open([choice()]);
        const user = userEvent.setup();

        await user.click(await screen.findByRole('button', { name: /perro/ }));

        expect(screen.getByRole('button', { name: /perro/ })).toHaveAttribute('data-state', 'wrong');
        expect(screen.getByRole('button', { name: /casa/ })).toHaveAttribute('data-state', 'right');
        await screen.findByText('Saved');

        await user.click(screen.getByRole('button', { name: /gato/ }));
        expect(fake.state.answers).toHaveLength(1);
        expect(fake.state.answers[0]?.result).toBe('wrong');
    });

    it('answers with the number key', async () => {
        const fake = await open([choice()]);
        const user = userEvent.setup();

        await screen.findByRole('button', { name: /casa/ });
        await user.keyboard('1');

        await screen.findByText('Saved');
        expect(fake.state.answers[0]?.result).toBe('correct');
    });
});

describe('SessionView — saving', () => {
    it('shows "Not saved", lets the user go on, and retries', async () => {
        const fake = await open([makeExercise(), makeExercise({ key: 'k2' })]);
        fake.state.failNextAnswers = 1;
        const user = userEvent.setup();

        await user.type(await screen.findByLabelText('Your answer'), 'casa{Enter}');
        expect(await screen.findByText('Not saved')).toBeInTheDocument();

        // Navigation is free while the answer is unsaved.
        await user.click(screen.getByRole('button', { name: 'Next' }));
        expect(await screen.findByText('Exercise 2 of 2')).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Previous' }));

        await user.click(screen.getByRole('button', { name: 'Retry' }));
        await screen.findByText('Saved');
        expect(fake.state.answers).toHaveLength(1);
    });

    it('turns a save that a reload cut off into "Not saved"', async () => {
        const exercise = makeExercise();
        server.use(...makePracticeHandlers().handlers);
        usePracticeSessionStore.getState().start({
            userId: 'u1',
            params: defaultParams(SESSION.languages),
            wordIds: null,
            exercises: [exercise],
        });
        usePracticeSessionStore.getState().dispatch({ type: 'answer', index: 0, result: 'correct', given: 'casa' });
        await renderApp({ initialEntry: '/practice', session: SESSION });

        expect(await screen.findByText('Not saved')).toBeInTheDocument();
        expect(screen.getByLabelText('Your answer')).toHaveValue('casa');
    });
});

describe('SessionView — navigation', () => {
    it('goes back and forth and keeps the given answer', async () => {
        await open([makeExercise(), makeExercise({ key: 'k2', prompt: { ...makeExercise().prompt, value: 'dog' } })]);
        const user = userEvent.setup();

        expect(await screen.findByRole('button', { name: 'Previous' })).toBeDisabled();
        await user.type(screen.getByLabelText('Your answer'), 'casa{Enter}');
        await user.click(await screen.findByRole('button', { name: 'Next' }));

        expect(screen.getByTestId('prompt')).toHaveTextContent('dog');
        expect(screen.getByLabelText('Your answer')).toHaveFocus();

        await user.click(screen.getByRole('button', { name: 'Previous' }));
        expect(screen.getByLabelText('Your answer')).toHaveValue('casa');
        expect(screen.getByLabelText('Your answer')).toHaveAttribute('readonly');
    });

    it('offers the results only when every exercise is answered', async () => {
        await open([makeExercise(), makeExercise({ key: 'k2' })]);
        const user = userEvent.setup();

        await user.type(await screen.findByLabelText('Your answer'), 'casa{Enter}');
        await user.click(await screen.findByRole('button', { name: 'Next' }));
        await user.type(screen.getByLabelText('Your answer'), 'x');
        expect(screen.getByRole('button', { name: 'See results' })).toBeDisabled();
        expect(screen.getByText('Answer all exercises to see the results.')).toBeInTheDocument();

        await user.type(screen.getByLabelText('Your answer'), '{Enter}');
        await user.click(await screen.findByRole('button', { name: 'See results' }));

        expect(await screen.findByRole('heading', { name: 'Results' })).toBeInTheDocument();
        expect(screen.getByText('1 of 2 correct')).toBeInTheDocument();
    });

    it('shows the progress counters', async () => {
        await open([makeExercise(), makeExercise({ key: 'k2' })]);
        const user = userEvent.setup();

        await user.type(await screen.findByLabelText('Your answer'), 'casa{Enter}');

        expect(await screen.findByText(/1 answered/)).toBeInTheDocument();
        expect(screen.getByText(/1 correct/)).toBeInTheDocument();
    });

    it('says how many exercises could be created when there are fewer', async () => {
        await open([makeExercise()], { amount: 5 });

        expect(await screen.findByText('1 of 5 exercises could be created.')).toBeInTheDocument();
    });

    it('asks before leaving, then goes back to the set-up', async () => {
        server.use(...makeWordHandlers({ callerId: 'u1', seed: [] }).handlers);
        await open([makeExercise()]);
        const user = userEvent.setup();

        await user.click(await screen.findByRole('button', { name: 'Leave practice' }));
        expect(await screen.findByText('Leave this practice?')).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Stay' }));
        expect(usePracticeSessionStore.getState().session).not.toBeNull();

        await user.click(screen.getByRole('button', { name: 'Leave practice' }));
        await user.click(await screen.findByRole('button', { name: 'Leave' }));

        expect(await screen.findByText('You have no words yet')).toBeInTheDocument();
        expect(usePracticeSessionStore.getState().session).toBeNull();
    });

    it('restores the same card after a reload', async () => {
        await open([makeExercise(), makeExercise({ key: 'k2', prompt: { ...makeExercise().prompt, value: 'dog' } })]);
        const user = userEvent.setup();
        await user.type(await screen.findByLabelText('Your answer'), 'casa{Enter}');
        await user.click(await screen.findByRole('button', { name: 'Next' }));
        await screen.findByText('Exercise 2 of 2');

        // A reload keeps only what the store persisted to sessionStorage.
        const saved = sessionStorage.getItem('ladu.practice.session');
        expect(saved).not.toBeNull();
        await usePracticeSessionStore.persist.rehydrate();

        expect(usePracticeSessionStore.getState().session?.current).toBe(1);
        expect(screen.getByTestId('prompt')).toHaveTextContent('dog');
    });
});
