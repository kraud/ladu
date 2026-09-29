import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from '@/test/render';
import { server } from '@/test/msw/server';
import { makeWordHandlers } from '@/test/msw/wordHandlers';
import { makeExercise, makePracticeHandlers, type PracticeFakeOptions } from '@/test/msw/practiceHandlers';
import { futureToken } from '@/test/tokens';
import { useAuthStore } from '@/stores/authStore';
import { PartOfSpeech } from '@/ts/enums';
import { defaultParams } from '../params';
import { usePracticeSessionStore } from '../sessionStore';
import type { Exercise, PracticeParams } from '../types';
import type { PreselectedWord } from '../preselection';
import type { AnswerResult } from '../types';

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

const typed = (n: number) =>
    makeExercise({ key: `ti${n}`, translationId: `tr${n}`, answer: { language: 'Spanish' as never, caseName: 'singularES', value: 'casa' } });
const choice = makeExercise({
    key: 'mc',
    translationId: 'tr-mc',
    type: 'Multiple-Choice',
    options: ['casa', 'perro'],
});

const WORDS: PreselectedWord[] = [
    { id: 'w1', partOfSpeech: PartOfSpeech.noun, label: 'house', languages: ['EN', 'ES'] },
];

/** A finished session: correct, partial, wrong (typed), wrong (chosen). */
async function openResults(
    options: {
        params?: Partial<PracticeParams>;
        preselected?: PreselectedWord[] | null;
        unsaved?: number[];
    } & PracticeFakeOptions = {},
) {
    const { params, preselected = null, unsaved = [], ...fakeOptions } = options;
    const exercises: Exercise[] = [typed(1), typed(2), typed(3), choice];
    server.use(...makeWordHandlers({ callerId: 'u1', seed: [] }).handlers);
    const fake = makePracticeHandlers({ exercises, ...fakeOptions });
    server.use(...fake.handlers);

    const store = usePracticeSessionStore.getState();
    store.start({
        userId: 'u1',
        params: { ...defaultParams(SESSION.languages), ...params },
        wordIds: preselected?.map((w) => w.id) ?? null,
        preselected,
        exercises,
    });
    const results: [AnswerResult, string][] = [
        ['correct', 'casa'],
        ['partial', 'Casa'],
        ['wrong', 'perro'],
        ['wrong', 'perro'],
    ];
    results.forEach(([result, given], index) => {
        store.dispatch({ type: 'answer', index, result, given });
        store.dispatch(
            unsaved.includes(index)
                ? { type: 'saveFailed', index }
                : { type: 'saveSucceeded', index, performance: { translationId: exercises[index]!.translationId, modifier: null, reviseCounter: 0, cases: [] } },
        );
    });
    store.dispatch({ type: 'finish' });
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

describe('ResultsView', () => {
    it('shows the score, the almost-correct count and one row per exercise', async () => {
        await openResults();

        expect(await screen.findByTestId('score')).toHaveTextContent('2 of 4 correct');
        expect(screen.getByText(/50 %/)).toBeInTheDocument();
        expect(screen.getByText(/1 almost correct/)).toBeInTheDocument();

        const rows = screen.getAllByTestId('result-row');
        expect(rows).toHaveLength(4);
        expect(within(rows[0]!).getByText('Correct')).toBeInTheDocument();
        expect(within(rows[1]!).getByText('Almost correct')).toBeInTheDocument();
        expect(within(rows[2]!).getByText('Wrong')).toBeInTheDocument();
        expect(within(rows[0]!).getByText('Typed')).toBeInTheDocument();
        expect(within(rows[3]!).getByText('Chosen')).toBeInTheDocument();
    });

    it('shows the user answer only when it differs from the expected one', async () => {
        await openResults();
        const rows = await screen.findAllByTestId('result-row');

        expect(within(rows[0]!).queryByTestId('given')).not.toBeInTheDocument();
        expect(within(rows[1]!).getByTestId('given')).toHaveTextContent('Casa');
        expect(within(rows[2]!).getByTestId('given')).toHaveTextContent('perro');
    });

    it('warns about unsaved answers and retries them all', async () => {
        const fake = await openResults({ unsaved: [0, 2] });
        const user = userEvent.setup();

        expect(await screen.findByText('2 answers are not saved.')).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Retry all' }));

        await waitFor(() => expect(screen.queryByText(/are not saved/)).not.toBeInTheDocument());
        expect(fake.state.answers.map((a) => a.translationId).sort()).toEqual(['tr1', 'tr3']);
    });

    it('opens an exercise read-only and returns to the results', async () => {
        await openResults();
        const user = userEvent.setup();

        const rows = await screen.findAllByTestId('result-row');
        await user.click(within(rows[1]!).getByRole('button', { name: 'Open exercise' }));

        expect(await screen.findByText('Exercise 2 of 4')).toBeInTheDocument();
        expect(screen.getByLabelText('Your answer')).toHaveAttribute('readonly');
        expect(screen.getByRole('button', { name: 'Mastered' })).toBeEnabled();
        expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Back to results' }));
        expect(await screen.findByTestId('score')).toBeInTheDocument();
    });

    it('keeps the settings summary closed until asked, and lists pre-selected words', async () => {
        await openResults({ preselected: WORDS });
        const user = userEvent.setup();

        expect(await screen.findByRole('button', { name: 'Show settings' })).toBeInTheDocument();
        expect(screen.queryByText('Number of exercises')).not.toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Show settings' }));
        expect(screen.getByText('Number of exercises')).toBeInTheDocument();
        expect(within(screen.getByRole('region', { name: 'Settings' })).getByText('house')).toBeInTheDocument();
        // Choice difficulty is relevant only when the session shows choices in different languages.
        expect(screen.getByText('Typing strictness')).toBeInTheDocument();
    });

    it('"Practice again" makes new exercises with the same settings and words', async () => {
        const fake = await openResults({ preselected: WORDS, params: { amount: 4 } });
        const user = userEvent.setup();

        await user.click(await screen.findByRole('button', { name: 'Practice again' }));

        expect(await screen.findByText('Exercise 1 of 4')).toBeInTheDocument();
        expect(fake.state.generateBodies).toHaveLength(1);
        expect(fake.state.generateBodies[0]).toMatchObject({ amount: 4, wordIds: ['w1'] });
        expect(usePracticeSessionStore.getState().session?.answers.every((a) => a === null)).toBe(true);
    });

    it('"Practice again" stays on the results and explains a failure', async () => {
        const fake = await openResults();
        fake.state.generateFailure = { status: 500, body: { message: 'x' } };
        const user = userEvent.setup();

        await user.click(await screen.findByRole('button', { name: 'Practice again' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('The exercises could not be created');
        expect(screen.getByTestId('score')).toBeInTheDocument();
    });

    it('"Change settings" returns to the set-up with the same settings and words', async () => {
        await openResults({ preselected: WORDS, params: { amount: 7 } });
        const user = userEvent.setup();

        await user.click(await screen.findByRole('button', { name: 'Change settings' }));

        expect(await screen.findByRole('heading', { name: 'Practice' })).toBeInTheDocument();
        expect(screen.getByLabelText('Number of exercises')).toHaveValue(7);
        expect(screen.getByText('Practice with 1 selected word')).toBeInTheDocument();
        expect(usePracticeSessionStore.getState().session).toBeNull();
    });

    it('links to Review', async () => {
        await openResults();
        expect(await screen.findByRole('link', { name: 'Go to Review' })).toHaveAttribute('href', '/review');
    });
});
