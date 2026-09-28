import { useState } from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
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

function verbSeed(label: string, id: string, user = SESSION.id): SeedWord {
    return {
        id,
        user,
        partOfSpeech: PartOfSpeech.verb,
        translations: [{ language: Lang.EN, cases: [{ caseName: 'simplePresent1sEN', word: label }] }],
    };
}

function Harness({ initialSelected = [] }: { initialSelected?: PickedWord[] }) {
    const [selected, setSelected] = useState<PickedWord[]>(initialSelected);
    return <WordPicker selected={selected} onSelectedChange={setSelected} />;
}

describe('WordPicker', () => {
    it('lists the caller\'s own words and excludes other users\' words', async () => {
        const fake = makeWordHandlers({
            callerId: SESSION.id,
            seed: [verbSeed('run', 'w1'), verbSeed('swim', 'w2', 'someone-else')],
        });
        server.use(...fake.handlers);

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

    it('clicking a row picks it, clears the search, and moves it to the selected list', async () => {
        const fake = makeWordHandlers({ callerId: SESSION.id, seed: [verbSeed('run', 'w1')] });
        server.use(...fake.handlers);
        const user = userEvent.setup();

        renderWithProviders(<Harness />, { session: SESSION });
        const row = (await screen.findByText('run')).closest('tr') as HTMLElement;
        await user.click(row);

        expect(screen.getByText('1 selected')).toBeInTheDocument();
        // The picked word drops out of the results table (already-selected filter)…
        await waitFor(() => expect(screen.queryByRole('row')).not.toBeInTheDocument());
        // …and reappears in the selected pill list.
        expect(screen.getByRole('button', { name: 'Remove run' })).toBeInTheDocument();
    });

    it('removing a selected word via its pill puts it back in the pick list', async () => {
        const fake = makeWordHandlers({ callerId: SESSION.id, seed: [verbSeed('run', 'w1')] });
        server.use(...fake.handlers);
        const user = userEvent.setup();

        renderWithProviders(<Harness initialSelected={[{ id: 'w1', label: 'run' }]} />, { session: SESSION });
        expect(screen.getByRole('button', { name: 'Remove run' })).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Remove run' }));
        expect(await screen.findByRole('row')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Remove run' })).not.toBeInTheDocument();
    });

    it('shows the empty-account message when the caller has no words', async () => {
        const fake = makeWordHandlers({ callerId: SESSION.id, seed: [] });
        server.use(...fake.handlers);

        renderWithProviders(<Harness />, { session: SESSION });
        expect(await screen.findByText("You don't have any words yet")).toBeInTheDocument();
    });

    it('shows the no-matches message for a query with no results', async () => {
        const fake = makeWordHandlers({ callerId: SESSION.id, seed: [verbSeed('run', 'w1')] });
        server.use(...fake.handlers);
        const user = userEvent.setup();

        renderWithProviders(<Harness />, { session: SESSION });
        await screen.findByText('run');
        await user.type(screen.getByPlaceholderText('Search your words…'), 'zzz');

        expect(await screen.findByText('No words match')).toBeInTheDocument();
    });
});
