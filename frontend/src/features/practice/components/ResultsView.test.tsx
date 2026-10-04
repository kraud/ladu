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
        almostNone?: boolean;
    } & PracticeFakeOptions = {},
) {
    const { params, preselected = null, unsaved = [], almostNone = false, ...fakeOptions } = options;
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
        [almostNone ? 'correct' : 'partial', almostNone ? 'casa' : 'Casa'],
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
    it('shows the score, the almost-correct hint and one row per exercise', async () => {
        await openResults();

        expect(await screen.findByRole('heading', { name: 'Session results' })).toBeInTheDocument();
        expect(await screen.findByTestId('score')).toHaveTextContent('2 of 4');
        expect(screen.getByText('correct answers')).toBeInTheDocument();
        expect(screen.queryByText(/50 ?%/)).not.toBeInTheDocument();
        expect(screen.getByText('includes 1 almost correct — accents or capitals only')).toBeInTheDocument();

        const rows = screen.getAllByTestId('result-row');
        expect(rows).toHaveLength(4);
        expect(within(rows[0]!).getByText('Correct')).toBeInTheDocument();
        expect(within(rows[1]!).getByText('Almost')).toBeInTheDocument();
        expect(within(rows[2]!).getByText('Wrong')).toBeInTheDocument();
        expect(within(rows[0]!).getByText('Typed')).toBeInTheDocument();
        expect(within(rows[3]!).getByText('Chosen')).toBeInTheDocument();
    });

    it('has the title, the score, the languages and the word types in one header', async () => {
        await openResults();
        const heading = await screen.findByRole('heading', { name: 'Session results' });
        // The title is above the card; the card holds the figures.
        const header = screen.getByTestId('score').closest('section')!;
        expect(header).not.toContainElement(heading);

        expect(within(header).getByTestId('score')).toHaveTextContent('2 of 4');
        // The fake exercises are English -> Spanish nouns.
        expect(within(header).getByTestId('languages-count')).toHaveTextContent('2');
        expect(within(header).getByText('languages')).toBeInTheDocument();
        expect(within(header).getByTestId('flag-grid').children).toHaveLength(2);
        expect(within(header).getByTestId('types-count')).toHaveTextContent('1');
        expect(within(header).getByText('type of words')).toBeInTheDocument();
        // The types show as tags in the same kind of grid: an abbreviation, with the full name for screen readers.
        const types = within(header).getByTestId('types-grid');
        expect(types.children).toHaveLength(1);
        expect(within(types).getByText('n.')).toBeInTheDocument();
        expect(within(types).getByText('Noun')).toHaveClass('sr-only');
    });

    it('shows the word type and the form once, short, in their own column', async () => {
        await openResults();
        const [row] = await screen.findAllByTestId('result-row');

        // Short text for the eye, the full words for screen readers.
        for (const abbr of ['n.', 'sg.', 'nom.']) expect(within(row!).getByText(abbr)).toHaveAttribute('aria-hidden', 'true');
        for (const full of [/^Noun,/, /^Singular,/, 'Nominative']) {
            expect(within(row!).getByText(full, { selector: '.sr-only' })).toBeInTheDocument();
        }
        expect(row).toHaveTextContent(/house/);
        expect(row).toHaveTextContent(/casa/);
    });

    it('shows the full word of an abbreviation in a tooltip after a second', async () => {
        await openResults();
        const user = userEvent.setup();
        const [row] = await screen.findAllByTestId('result-row');

        await user.hover(within(row!).getByText('nom.'));

        expect(
            await screen.findByText('Nominative', { selector: '[data-slot="tooltip-content"]' }, { timeout: 3000 }),
        ).toBeInTheDocument();
    });

    it('marks typed and chosen with an icon and a tooltip label', async () => {
        await openResults();
        const user = userEvent.setup();
        const rows = await screen.findAllByTestId('result-row');

        // The visible marker is an icon; the label is for screen readers and the tooltip.
        expect(within(rows[0]!).getByText('Typed')).toHaveClass('sr-only');
        expect(within(rows[3]!).getByText('Chosen')).toHaveClass('sr-only');

        await user.hover(within(rows[3]!).getByText('Chosen').parentElement!);
        expect(
            await screen.findByText('Chosen', { selector: '[data-slot="tooltip-content"]' }, { timeout: 3000 }),
        ).toBeInTheDocument();
    });

    it('says nothing about almost-correct answers when there are none', async () => {
        await openResults({ almostNone: true });
        await screen.findByTestId('score');

        expect(screen.queryByText(/almost correct/)).not.toBeInTheDocument();
    });

    it('does not repeat the user answer in the row, so every row has the same shape', async () => {
        await openResults();
        const rows = await screen.findAllByTestId('result-row');

        rows.forEach((row) => expect(within(row).queryByTestId('given')).not.toBeInTheDocument());
        expect(within(rows[2]!).queryByText(/perro/)).not.toBeInTheDocument();
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
        // The whole row is the button.
        await user.click(within(rows[1]!).getByRole('button', { name: /Open exercise/ }));

        expect(await screen.findByText('Exercise 2 of 4')).toBeInTheDocument();
        expect(screen.getByLabelText('Your answer')).toHaveAttribute('readonly');
        expect(screen.getByRole('button', { name: 'Mastered' })).toBeEnabled();
        expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Previous' })).not.toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Back to results' }));
        expect(await screen.findByTestId('score')).toBeInTheDocument();
    });

    it('keeps the settings summary closed until asked, and lists pre-selected words', async () => {
        await openResults({ preselected: WORDS });
        const user = userEvent.setup();

        expect(await screen.findByRole('button', { name: 'Settings used', expanded: false })).toBeInTheDocument();
        expect(screen.queryByText('Number of exercises')).not.toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Settings used' }));
        expect(screen.getByText('Number of exercises')).toBeInTheDocument();
        // Typing only: strictness shows as "Level 2 — …", choice difficulty is left out.
        expect(screen.getByText(/Level 2 — Ignores capital letters only/)).toBeInTheDocument();
        expect(screen.queryByText('Choice difficulty')).not.toBeInTheDocument();
        expect(within(screen.getByRole('region', { name: 'Settings used' })).getByText('house')).toBeInTheDocument();
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

    it('"Practice again" that finds nothing explains why, with a way to the settings', async () => {
        await openResults({ exercises: [] });
        // The fake serves `exercises` cut to the amount; an empty pool gives an empty list.
        const user = userEvent.setup();

        await user.click(await screen.findByRole('button', { name: 'Practice again' }));

        expect(await screen.findByText('No exercises found')).toBeInTheDocument();
        expect(screen.getByTestId('score')).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Adjust settings' }));
        expect(await screen.findByRole('heading', { name: 'Practice' })).toBeInTheDocument();
    });

    it('goes back to the set-up with the arrow next to the title', async () => {
        await openResults();
        const user = userEvent.setup();

        await user.click(await screen.findByRole('button', { name: 'Back to set-up' }));

        expect(await screen.findByRole('heading', { name: 'Practice' })).toBeInTheDocument();
        expect(usePracticeSessionStore.getState().session).toBeNull();
    });

    it('marks an unsaved answer in its row', async () => {
        await openResults({ unsaved: [2] });
        const rows = await screen.findAllByTestId('result-row');

        expect(within(rows[2]!).getByText('Not saved')).toBeInTheDocument();
        expect(within(rows[0]!).queryByText('Not saved')).not.toBeInTheDocument();
        // The retry is on the banner and on the card, not in the row.
        expect(within(rows[2]!).queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
    });

    it('shows how many exercises were made when fewer than asked', async () => {
        await openResults({ params: { amount: 6 } });
        const user = userEvent.setup();

        await user.click(await screen.findByRole('button', { name: 'Settings used' }));

        expect(screen.getByText('4 (of 6 asked)')).toBeInTheDocument();
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

    it('"Change settings" opens the New configuration tab, also when the session had no pre-selected words', async () => {
        await openResults({ params: { amount: 7 } });
        // The account has words, so the set-up shows its tabs (not the "no words" message).
        server.use(
            ...makeWordHandlers({
                callerId: 'u1',
                seed: [{ id: 'w1', user: 'u1', partOfSpeech: PartOfSpeech.noun, translations: [] }],
            }).handlers,
        );
        const user = userEvent.setup();

        await user.click(await screen.findByRole('button', { name: 'Change settings' }));

        expect(await screen.findByRole('tab', { name: 'New configuration' })).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByLabelText('Number of exercises')).toHaveValue(7);
    });

    it('links to Review', async () => {
        await openResults();
        expect(await screen.findByRole('link', { name: 'Go to Review table' })).toHaveAttribute('href', '/review');
    });
});
