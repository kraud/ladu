import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { renderApp } from '@/test/render';
import { server } from '@/test/msw/server';
import { makeWordHandlers, type SeedWord } from '@/test/msw/wordHandlers';
import { useAuthStore } from '@/stores/authStore';
import { futureToken } from '@/test/tokens';
import { PartOfSpeech, Lang } from '@/ts/enums';

const SESSION = {
    id: 'u1',
    name: 'Kai Rebane',
    email: 'kai@example.com',
    username: 'kai',
    languages: ['English', 'German'],
    uiLanguage: 'English',
    nativeLanguage: null,
    verified: true,
    token: futureToken(),
};

afterEach(() => {
    useAuthStore.getState().clearSession();
});

function verbSeed(label: string, id: string): SeedWord {
    return {
        id,
        user: SESSION.id,
        partOfSpeech: PartOfSpeech.verb,
        translations: [{ language: Lang.EN, cases: [{ caseName: 'simplePresent1sEN', word: label }] }],
    };
}

function nounSeed(label: string, id: string): SeedWord {
    return {
        id,
        user: SESSION.id,
        partOfSpeech: PartOfSpeech.noun,
        translations: [{ language: Lang.EN, cases: [{ caseName: 'singularEN', word: label }] }],
    };
}

describe('ReviewPage', () => {
    it('replaces the old placeholder with the real table', async () => {
        const fake = makeWordHandlers({ callerId: SESSION.id, seed: [verbSeed('run', 'w1')] });
        server.use(...fake.handlers);

        await renderApp({ initialEntry: '/review', session: SESSION });

        expect(await screen.findByText('run')).toBeInTheDocument();
        expect(screen.queryByText('Table lands in Phase 3.')).not.toBeInTheDocument();
    });

    it('a pos filter in the URL reaches the request', async () => {
        const fake = makeWordHandlers({
            callerId: SESSION.id,
            seed: [nounSeed('cat', 'w1'), verbSeed('run', 'w2')],
        });
        server.use(...fake.handlers);

        await renderApp({ initialEntry: '/review?pos=Noun', session: SESSION });

        await waitFor(() => expect(fake.simpleQueries).toHaveLength(1));
        expect(fake.simpleQueries[0]).toContain('pos=Noun');
        expect(await screen.findByText('cat')).toBeInTheDocument();
        expect(screen.queryByText('run')).not.toBeInTheDocument();
    });

    it('?lang= reorders the language columns', async () => {
        const fake = makeWordHandlers({ callerId: SESSION.id, seed: [verbSeed('run', 'w1')] });
        server.use(...fake.handlers);

        await renderApp({ initialEntry: '/review?lang=DE,EN', session: SESSION });
        await screen.findByText('run');

        const headers = screen.getAllByRole('columnheader').map((h) => h.textContent);
        expect(headers[2]).toContain('DE');
        expect(headers[3]).toContain('EN');
    });

    it('Load more appends a second page', async () => {
        const words = Array.from({ length: 51 }, (_, i) => verbSeed(String(i), `w${i}`));
        const fake = makeWordHandlers({ callerId: SESSION.id, seed: words });
        server.use(...fake.handlers);

        const user = userEvent.setup();
        await renderApp({ initialEntry: '/review', session: SESSION });

        await waitFor(() => expect(screen.getAllByRole('row')).toHaveLength(51)); // 50 words + header row
        await user.click(screen.getByRole('button', { name: 'Load more' }));

        await waitFor(() => expect(screen.getAllByRole('row')).toHaveLength(52)); // 51 words + header row
        expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
    });

    it('shows the "no words yet" empty state for an unfiltered empty account', async () => {
        const fake = makeWordHandlers({ callerId: SESSION.id, seed: [] });
        server.use(...fake.handlers);

        await renderApp({ initialEntry: '/review', session: SESSION });

        expect(await screen.findByText('No words yet')).toBeInTheDocument();
    });

    it('shows the "no matches" empty state when a filter empties the results', async () => {
        const fake = makeWordHandlers({ callerId: SESSION.id, seed: [verbSeed('run', 'w1')] });
        server.use(...fake.handlers);

        await renderApp({ initialEntry: '/review?pos=Noun', session: SESSION });

        expect(await screen.findByText('No words match your filters')).toBeInTheDocument();
    });
});
