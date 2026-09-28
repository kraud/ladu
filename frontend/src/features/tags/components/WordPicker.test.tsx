import { useState } from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { server } from '@/test/msw/server';
import { makeWordHandlers, type SeedWord } from '@/test/msw/wordHandlers';
import { futureToken } from '@/test/tokens';
import { PartOfSpeech, Lang } from '@/ts/enums';
import { WordPicker, type PickedWord } from './WordPicker';

const SESSION = {
    id: 'u1',
    name: 'Kai Rebane',
    email: 'kai@example.com',
    username: 'kai',
    languages: ['English'],
    uiLanguage: 'English',
    nativeLanguage: null,
    verified: true,
    token: futureToken(),
};

const MULTI_LANG_SESSION = { ...SESSION, languages: ['English', 'German'] };

function verbSeed(label: string, id: string, user = SESSION.id): SeedWord {
    return {
        id,
        user,
        partOfSpeech: PartOfSpeech.verb,
        translations: [{ language: Lang.EN, cases: [{ caseName: 'simplePresent1sEN', word: label }] }],
    };
}

/** N distinct own words, for pagination/cap tests. */
function manySeeds(count: number): SeedWord[] {
    return Array.from({ length: count }, (_, i) => verbSeed(`word${i}`, `w${i}`));
}

function Harness({
    initialSelected = [],
    onGoToReview,
}: {
    initialSelected?: PickedWord[];
    onGoToReview?: () => void;
}) {
    const [selected, setSelected] = useState<PickedWord[]>(initialSelected);
    return <WordPicker selected={selected} onSelectedChange={setSelected} onGoToReview={onGoToReview} />;
}

describe('WordPicker — basics', () => {
    it("lists the caller's own words and excludes other users' words", async () => {
        server.use(
            ...makeWordHandlers({
                callerId: SESSION.id,
                seed: [verbSeed('run', 'w1'), verbSeed('swim', 'w2', 'someone-else')],
            }).handlers,
        );

        renderWithProviders(<Harness />, { session: SESSION });

        expect(await screen.findByText('run')).toBeInTheDocument();
        expect(screen.queryByText('swim')).not.toBeInTheDocument();
    });

    it('typing a query narrows the request after the debounce', async () => {
        const fake = makeWordHandlers({
            callerId: SESSION.id,
            seed: [verbSeed('run', 'w1'), verbSeed('jump', 'w2')],
        });
        server.use(...fake.handlers);
        const user = userEvent.setup();

        renderWithProviders(<Harness />, { session: SESSION });
        await screen.findByText('run');

        await user.type(screen.getByPlaceholderText('Search your words…'), 'jum');
        // Both words render unfiltered until the debounced request actually
        // lands — wait for that before asserting on the narrowed DOM, or
        // `findByText('jump')` trivially passes on the pre-debounce list.
        await waitFor(() => expect(fake.simpleQueries.some((q) => q.includes('q=jum'))).toBe(true), {
            timeout: 2000,
        });
        expect(await screen.findByText('jump')).toBeInTheDocument();
        expect(screen.queryByText('run')).not.toBeInTheDocument();
    });

    it('clicking a row picks it and moves it to the selected list', async () => {
        server.use(...makeWordHandlers({ callerId: SESSION.id, seed: [verbSeed('run', 'w1')] }).handlers);
        const user = userEvent.setup();

        renderWithProviders(<Harness />, { session: SESSION });
        const row = (await screen.findByText('run')).closest('tr') as HTMLElement;
        await user.click(row);

        expect(screen.getByText('1 selected')).toBeInTheDocument();
        // The picked word drops out of the results (already-selected filter)
        // — the pool is empty, so the empty-account message takes over…
        await waitFor(() => expect(screen.queryAllByRole('row')).toHaveLength(0));
        expect(screen.getByText("You don't have any words yet")).toBeInTheDocument();
        // …and it reappears in the selected pill list.
        expect(screen.getByRole('button', { name: 'Remove run' })).toBeInTheDocument();
    });

    it('removing a selected word via its pill puts it back in the pick list', async () => {
        server.use(...makeWordHandlers({ callerId: SESSION.id, seed: [verbSeed('run', 'w1')] }).handlers);
        const user = userEvent.setup();

        renderWithProviders(<Harness initialSelected={[{ id: 'w1', label: 'run' }]} />, { session: SESSION });
        expect(screen.getByRole('button', { name: 'Remove run' })).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Remove run' }));
        expect(await screen.findByText('run')).toBeInTheDocument();
        expect(screen.getAllByRole('row')).toHaveLength(2); // the word row + the terminal "all loaded" row
        expect(screen.queryByRole('button', { name: 'Remove run' })).not.toBeInTheDocument();
    });

    it('shows the empty-account message when the caller has no words', async () => {
        server.use(...makeWordHandlers({ callerId: SESSION.id, seed: [] }).handlers);

        renderWithProviders(<Harness />, { session: SESSION });
        expect(await screen.findByText("You don't have any words yet")).toBeInTheDocument();
    });

    it('shows the no-matches message for a query with no results', async () => {
        server.use(...makeWordHandlers({ callerId: SESSION.id, seed: [verbSeed('run', 'w1')] }).handlers);
        const user = userEvent.setup();

        renderWithProviders(<Harness />, { session: SESSION });
        await screen.findByText('run');
        await user.type(screen.getByPlaceholderText('Search your words…'), 'zzz');

        expect(await screen.findByText('No words match')).toBeInTheDocument();
    });

    it('rows show only the languages with a translation, dash-joined, and no + affordance', async () => {
        server.use(
            ...makeWordHandlers({
                callerId: MULTI_LANG_SESSION.id,
                seed: [
                    {
                        id: 'w1',
                        user: MULTI_LANG_SESSION.id,
                        partOfSpeech: PartOfSpeech.noun,
                        translations: [{ language: Lang.EN, cases: [{ caseName: 'singularEN', word: 'tree' }] }],
                    },
                ],
            }).handlers,
        );

        renderWithProviders(<Harness />, { session: MULTI_LANG_SESSION });

        // Only English has a translation — no "tree - " with a trailing dash,
        // and no add-translation "+" button anywhere in the row.
        expect(await screen.findByText('tree')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Add.*translation/i })).not.toBeInTheDocument();
    });
});

describe('WordPicker — search box clear button', () => {
    it('does not clear the query when a word is picked', async () => {
        server.use(
            ...makeWordHandlers({
                callerId: SESSION.id,
                seed: [verbSeed('run', 'w1'), verbSeed('jump', 'w2')],
            }).handlers,
        );
        const user = userEvent.setup();

        renderWithProviders(<Harness />, { session: SESSION });
        await screen.findByText('run');
        const input = screen.getByPlaceholderText('Search your words…');
        await user.type(input, 'jum');
        const row = await waitFor(() => (screen.getByText('jump').closest('tr') as HTMLElement));
        await user.click(row);

        expect(input).toHaveValue('jum');
        expect(screen.getByRole('button', { name: 'Clear search' })).toBeInTheDocument();
    });

    it('the clear button only appears once there is a query, and resets it', async () => {
        server.use(...makeWordHandlers({ callerId: SESSION.id, seed: [verbSeed('run', 'w1')] }).handlers);
        const user = userEvent.setup();

        renderWithProviders(<Harness />, { session: SESSION });
        expect(screen.queryByRole('button', { name: 'Clear search' })).not.toBeInTheDocument();

        const input = screen.getByPlaceholderText('Search your words…');
        await user.type(input, 'run');
        expect(screen.getByRole('button', { name: 'Clear search' })).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Clear search' }));
        expect(input).toHaveValue('');
        expect(screen.queryByRole('button', { name: 'Clear search' })).not.toBeInTheDocument();
    });
});

describe('WordPicker — "Load more" is a row in the list, not a separate button', () => {
    it('labels the row with how many more will load, and clicking it appends the next page', async () => {
        server.use(...makeWordHandlers({ callerId: SESSION.id, seed: manySeeds(8) }).handlers);
        const user = userEvent.setup();

        renderWithProviders(<Harness />, { session: SESSION });
        // Newest-created first — word7 (last seeded) is on the first page, word0 isn't.
        await screen.findByText('word7');
        // 5 word rows + the "Load more" terminal row.
        expect(screen.getAllByRole('row')).toHaveLength(6);
        // 8 seeded, 5 loaded — 3 remain, all fitting in one more page of 5.
        const loadMoreRow = screen.getByText('Load more (3)');
        expect(screen.queryByText('All words loaded')).not.toBeInTheDocument();
        expect(screen.queryByText('Go to Review for more')).not.toBeInTheDocument();

        await user.click(loadMoreRow);
        await waitFor(() => expect(screen.getAllByRole('row')).toHaveLength(9)); // 8 words + terminal row
        expect(screen.queryByText(/Load more/)).not.toBeInTheDocument();
        expect(screen.getByText('All words loaded')).toBeInTheDocument();
    });

    it('shows the count capped at one page even when more than a page remains', async () => {
        server.use(...makeWordHandlers({ callerId: SESSION.id, seed: manySeeds(12) }).handlers);
        renderWithProviders(<Harness />, { session: SESSION });

        await screen.findByText('word11');
        // 12 seeded, 5 loaded — 7 remain, but only 5 fit in the next page.
        expect(screen.getByText('Load more (5)')).toBeInTheDocument();
    });

    it('swaps to a disabled "all loaded" row once nothing more can load', async () => {
        server.use(...makeWordHandlers({ callerId: SESSION.id, seed: [verbSeed('run', 'w1')] }).handlers);
        renderWithProviders(<Harness />, { session: SESSION });

        await screen.findByText('run');
        const allLoadedRow = screen.getByText('All words loaded').closest('tr') as HTMLElement;
        expect(allLoadedRow).toHaveClass('pointer-events-none');
    });

    it('swaps the row to "Go to Review for more" once 20 are loaded, and it calls back', async () => {
        server.use(...makeWordHandlers({ callerId: SESSION.id, seed: manySeeds(25) }).handlers);
        const user = userEvent.setup();
        const onGoToReview = vi.fn();

        renderWithProviders(<Harness onGoToReview={onGoToReview} />, { session: SESSION });
        await screen.findByText('word24');

        for (let i = 0; i < 3; i += 1) {
            await user.click(screen.getByText(/Load more/));
            await waitFor(() => expect(screen.getAllByRole('row')).toHaveLength(10 + i * 5 + 1));
        }

        expect(screen.getAllByRole('row')).toHaveLength(21); // 20 words + terminal row
        expect(screen.queryByText(/Load more/)).not.toBeInTheDocument();
        await user.click(screen.getByText('Go to Review for more'));
        expect(onGoToReview).toHaveBeenCalled();
    });

    it('a search does not cap at 20 or offer a Go to Review row', async () => {
        server.use(...makeWordHandlers({ callerId: SESSION.id, seed: manySeeds(7) }).handlers);
        const user = userEvent.setup();

        renderWithProviders(<Harness />, { session: SESSION });
        await screen.findByText('word6');
        await user.type(screen.getByPlaceholderText('Search your words…'), 'word');

        await waitFor(() => expect(screen.getAllByRole('row')).toHaveLength(6)); // 5 words + Load more
        await user.click(screen.getByText(/Load more/));
        await waitFor(() => expect(screen.getAllByRole('row')).toHaveLength(8)); // 7 words + terminal row

        expect(screen.queryByText(/Load more/)).not.toBeInTheDocument();
        expect(screen.queryByText('Go to Review for more')).not.toBeInTheDocument();
        expect(screen.getByText('All words loaded')).toBeInTheDocument();
    });
});
