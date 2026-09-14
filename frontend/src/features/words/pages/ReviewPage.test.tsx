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

function germanNounSeed(label: string, gender: string, id: string): SeedWord {
    return {
        id,
        user: SESSION.id,
        partOfSpeech: PartOfSpeech.noun,
        translations: [
            {
                language: Lang.DE,
                cases: [
                    { caseName: 'genderDE', word: gender },
                    { caseName: 'singularNominativDE', word: label },
                ],
            },
        ],
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

describe('ReviewPage — Slice 7: filter bar writes the URL', () => {
    it('a PoS chip click reaches the request and narrows the list', async () => {
        const fake = makeWordHandlers({
            callerId: SESSION.id,
            seed: [nounSeed('cat', 'w1'), verbSeed('run', 'w2')],
        });
        server.use(...fake.handlers);

        const user = userEvent.setup();
        await renderApp({ initialEntry: '/review', session: SESSION });
        await screen.findByText('cat');
        await screen.findByText('run');

        await user.click(screen.getByRole('button', { name: 'n.' }));

        await waitFor(() => expect(fake.simpleQueries).toHaveLength(2));
        expect(fake.simpleQueries[1]).toContain('pos=Noun');
        expect(await screen.findByText('cat')).toBeInTheDocument();
        await waitFor(() => expect(screen.queryByText('run')).not.toBeInTheDocument());
    });

    it('a gender chip click reaches the request as that single language-specific value', async () => {
        const fake = makeWordHandlers({
            callerId: SESSION.id,
            seed: [germanNounSeed('Baum', 'der', 'w1'), germanNounSeed('Katze', 'die', 'w2')],
        });
        server.use(...fake.handlers);

        const user = userEvent.setup();
        await renderApp({ initialEntry: '/review', session: SESSION });
        await screen.findByText('Baum');

        await user.click(screen.getByRole('button', { name: 'der' }));

        await waitFor(() => expect(fake.simpleQueries).toHaveLength(2));
        expect(fake.simpleQueries[1]).toContain('gender=der');
        expect(await screen.findByText('Baum')).toBeInTheDocument();
        await waitFor(() => expect(screen.queryByText('Katze')).not.toBeInTheDocument());
    });

    it('a filter applied through the filter bar survives a reload', async () => {
        const fake = makeWordHandlers({
            callerId: SESSION.id,
            seed: [nounSeed('cat', 'w1'), verbSeed('run', 'w2')],
        });
        server.use(...fake.handlers);

        const user = userEvent.setup();
        const first = await renderApp({ initialEntry: '/review', session: SESSION });
        await screen.findByText('cat');
        await user.click(screen.getByRole('button', { name: 'n.' }));
        await waitFor(() => expect(fake.simpleQueries).toHaveLength(2));
        const hrefAfterFilter = first.router.state.location.href;
        first.unmount();

        // A fresh mount at the same URL — a page reload, not a client-side navigation.
        await renderApp({ initialEntry: hrefAfterFilter, session: SESSION });
        expect(await screen.findByText('cat')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'n.' })).toHaveAttribute('aria-pressed', 'true');
    });

    it('hiding a language drops its column with no extra request (D13 — lang is display-only)', async () => {
        const threeLangSession = { ...SESSION, languages: ['English', 'German', 'Spanish'] };
        const fake = makeWordHandlers({ callerId: SESSION.id, seed: [verbSeed('run', 'w1')] });
        server.use(...fake.handlers);

        const user = userEvent.setup();
        await renderApp({ initialEntry: '/review', session: threeLangSession });
        await screen.findByText('run');
        expect(screen.getAllByRole('columnheader')).toHaveLength(5); // select, type, EN, DE, ES

        await user.click(screen.getByRole('button', { name: 'Hide Deutsch' }));

        await waitFor(() => expect(screen.getAllByRole('columnheader')).toHaveLength(4));
        // No new /simple request — the language column is a display concern only.
        expect(fake.simpleQueries).toHaveLength(1);
    });
});

describe('ReviewPage — Slice 7: Display-gender switch (D14, fixed after user review)', () => {
    it('appears once a noun is loaded, even with no PoS filter applied', async () => {
        const fake = makeWordHandlers({
            callerId: SESSION.id,
            seed: [nounSeed('cat', 'w1'), verbSeed('run', 'w2')],
        });
        server.use(...fake.handlers);

        await renderApp({ initialEntry: '/review', session: SESSION });
        await screen.findByText('cat');

        expect(screen.getByText('Display gender')).toBeInTheDocument();
    });

    it('is absent when no noun is loaded', async () => {
        const fake = makeWordHandlers({ callerId: SESSION.id, seed: [verbSeed('run', 'w1')] });
        server.use(...fake.handlers);

        await renderApp({ initialEntry: '/review', session: SESSION });
        await screen.findByText('run');

        expect(screen.queryByText('Display gender')).not.toBeInTheDocument();
    });
});

describe('ReviewPage — Slice 7: Display-progress switch', () => {
    it('is on by default and hides every completion ring when turned off', async () => {
        const fake = makeWordHandlers({ callerId: SESSION.id, seed: [verbSeed('run', 'w1')] });
        server.use(...fake.handlers);

        const user = userEvent.setup();
        await renderApp({ initialEntry: '/review', session: SESSION });
        await screen.findByText('run');
        expect(document.querySelector('.ring')).toBeInTheDocument();

        await user.click(screen.getByText('Display progress').closest('button')!);
        expect(document.querySelector('.ring')).not.toBeInTheDocument();
    });
});

describe('ReviewPage — Slice 7: bulk actions', () => {
    it('selects rows, confirms delete, and the words disappear with a success toast', async () => {
        const fake = makeWordHandlers({
            callerId: SESSION.id,
            seed: [verbSeed('run', 'w1'), verbSeed('jump', 'w2')],
        });
        server.use(...fake.handlers);

        const user = userEvent.setup();
        await renderApp({ initialEntry: '/review', session: SESSION });
        await screen.findByText('run');
        await screen.findByText('jump');

        const rowCheckboxes = screen.getAllByRole('checkbox').slice(1); // skip select-all
        await user.click(rowCheckboxes[0]);
        await user.click(rowCheckboxes[1]);

        await user.click(screen.getByRole('button', { name: 'Delete' }));
        const deleteButtons = screen.getAllByRole('button', { name: 'Delete' });
        await user.click(deleteButtons[deleteButtons.length - 1]);

        expect(await screen.findByText('2 words deleted')).toBeInTheDocument();
        await waitFor(() => expect(screen.queryByText('run')).not.toBeInTheDocument());
        expect(screen.queryByText('jump')).not.toBeInTheDocument();
    });

    it('View is enabled only at exactly one selection', async () => {
        const fake = makeWordHandlers({
            callerId: SESSION.id,
            seed: [verbSeed('run', 'w1'), verbSeed('jump', 'w2')],
        });
        server.use(...fake.handlers);

        const user = userEvent.setup();
        await renderApp({ initialEntry: '/review', session: SESSION });
        await screen.findByText('run');

        const rowCheckboxes = screen.getAllByRole('checkbox').slice(1);
        await user.click(rowCheckboxes[0]);
        expect(screen.getByRole('button', { name: 'View' })).toBeEnabled();

        await user.click(rowCheckboxes[1]);
        expect(screen.getByRole('button', { name: 'View' })).toBeDisabled();
    });
});
