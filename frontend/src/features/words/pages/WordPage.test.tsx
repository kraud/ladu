import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { renderApp } from '@/test/render';
import { server } from '@/test/msw/server';
import { makeWordHandlers } from '@/test/msw/wordHandlers';
import { useAuthStore } from '@/stores/authStore';
import { futureToken } from '@/test/tokens';
import { Lang, NounCases, PartOfSpeech } from '@/ts/enums';

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

const SEED = {
    id: 'word-1',
    user: SESSION.id,
    partOfSpeech: PartOfSpeech.noun,
    clue: 'a small building',
    translations: [
        { language: Lang.EN, cases: [{ caseName: NounCases.singularEN, word: 'house' }] },
        {
            language: Lang.ES,
            cases: [
                { caseName: NounCases.genderES, word: 'el' },
                { caseName: NounCases.singularES, word: 'casa' },
            ],
        },
    ],
};

afterEach(() => {
    useAuthStore.getState().clearSession();
});

describe('WordPage — view', () => {
    it('renders a read-only summary with Edit/Delete/Return controls', async () => {
        server.use(...makeWordHandlers({ callerId: SESSION.id, seed: [SEED] }).handlers);
        await renderApp({ initialEntry: `/word/${SEED.id}`, session: SESSION });

        expect(await screen.findByRole('heading', { level: 1, name: 'house' })).toBeInTheDocument();
        expect(screen.getByText('Detailed view: Noun')).toBeInTheDocument();
        expect(screen.getByText('a small building')).toBeInTheDocument();

        // Read-only: the case values render as text, not editable inputs.
        expect(screen.getByText('casa')).toBeInTheDocument();
        expect(screen.queryAllByRole('textbox')).toHaveLength(0);
        expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument();

        // All three live in the bottom bar; the sidebar keeps only clue + tags.
        const bar = screen.getByTestId('word-editor-bar');
        expect(within(bar).getByRole('button', { name: 'Edit' })).toBeInTheDocument();
        expect(within(bar).getByRole('button', { name: 'Delete' })).toBeInTheDocument();
        expect(within(bar).getByRole('button', { name: 'Return' })).toBeInTheDocument();
        expect(within(bar).queryByRole('status')).not.toBeInTheDocument();
    });

    // `renderApp` always boots a single-entry memory history, so `useCanGoBack()`
    // is false in every one of these — `goBack()` takes the `navigate({ to: '/' })`
    // fallback throughout, not `router.history.back()` (see `WordPage.tsx`).

    it('Return navigates Home when there is no client-side history to pop into', async () => {
        server.use(...makeWordHandlers({ callerId: SESSION.id, seed: [SEED] }).handlers);
        const { router } = await renderApp({ initialEntry: `/word/${SEED.id}`, session: SESSION });

        await screen.findByRole('button', { name: 'Return' });
        await userEvent.setup().click(screen.getByRole('button', { name: 'Return' }));

        await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    });

    it('shows a toast and navigates Home for a not-found word', async () => {
        server.use(...makeWordHandlers({ callerId: SESSION.id }).handlers);
        const { router } = await renderApp({ initialEntry: '/word/missing-id', session: SESSION });

        expect(await screen.findByText('This word could not be found.')).toBeInTheDocument();
        await waitFor(() => expect(router.state.location.pathname).toBe('/'));
        expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    });

    it('shows a toast and navigates Home for another user\'s word', async () => {
        server.use(
            ...makeWordHandlers({ callerId: SESSION.id, seed: [{ ...SEED, user: 'someone-else' }] }).handlers,
        );
        const { router } = await renderApp({ initialEntry: `/word/${SEED.id}`, session: SESSION });

        expect(await screen.findByText("You don't have access to this word.")).toBeInTheDocument();
        await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    });
});

describe('WordPage — edit', () => {
    it('edits a case, saves, and drops back to the (now updated) read-only view', async () => {
        const fake = makeWordHandlers({ callerId: SESSION.id, seed: [SEED] });
        server.use(...fake.handlers);
        const user = userEvent.setup();
        await renderApp({ initialEntry: `/word/${SEED.id}`, session: SESSION });

        await user.click(await screen.findByRole('button', { name: 'Edit' }));

        // Both EN and ES noun configs label this field "Singular" — EN is first (seed order).
        const singularEN = (await screen.findAllByLabelText('Singular'))[0]!;
        expect(singularEN).toHaveValue('house');
        await user.clear(singularEN);
        await user.type(singularEN, 'Cottage');

        await user.click(screen.getByRole('button', { name: 'Save word' }));

        expect(await screen.findByText('Word was updated successfully')).toBeInTheDocument();
        expect(fake.requests).toHaveLength(1);
        expect(fake.requests[0]?.body).toMatchObject({
            id: SEED.id,
            partOfSpeech: 'Noun',
            translations: [
                { language: 'English', cases: [{ caseName: NounCases.singularEN, word: 'cottage' }] },
                {
                    language: 'Spanish',
                    cases: [
                        { caseName: NounCases.genderES, word: 'el' },
                        { caseName: NounCases.singularES, word: 'casa' },
                    ],
                },
            ],
        });

        // Back to the read-only view, showing the persisted change.
        await waitFor(() => expect(screen.queryByRole('button', { name: 'Save word' })).not.toBeInTheDocument());
        expect(screen.getByRole('heading', { level: 1, name: 'cottage' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    });

    it('Cancel discards the in-progress edit and returns to the unchanged view', async () => {
        const fake = makeWordHandlers({ callerId: SESSION.id, seed: [SEED] });
        server.use(...fake.handlers);
        const user = userEvent.setup();
        await renderApp({ initialEntry: `/word/${SEED.id}`, session: SESSION });

        await user.click(await screen.findByRole('button', { name: 'Edit' }));
        const singularEN = (await screen.findAllByLabelText('Singular'))[0]!;
        await user.clear(singularEN);
        await user.type(singularEN, 'Cottage');

        await user.click(screen.getByRole('button', { name: 'Cancel' }));

        expect(screen.queryAllByLabelText('Singular')).toHaveLength(0);
        expect(screen.getByRole('heading', { level: 1, name: 'house' })).toBeInTheDocument();
        expect(fake.requests).toHaveLength(0);
    });
});

describe('WordPage — delete', () => {
    it('Delete opens a confirm dialog; Cancel there makes no request', async () => {
        const fake = makeWordHandlers({ callerId: SESSION.id, seed: [SEED] });
        server.use(...fake.handlers);
        const user = userEvent.setup();
        await renderApp({ initialEntry: `/word/${SEED.id}`, session: SESSION });

        await user.click(await screen.findByRole('button', { name: 'Delete' }));
        const dialog = await screen.findByRole('alertdialog');
        expect(within(dialog).getByText('Confirm delete Noun')).toBeInTheDocument();

        await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
        expect(fake.store.has(SEED.id)).toBe(true);
    });

    it('confirming delete removes the word, toasts, and navigates to /', async () => {
        const fake = makeWordHandlers({ callerId: SESSION.id, seed: [SEED] });
        server.use(...fake.handlers);
        const user = userEvent.setup();
        const { router } = await renderApp({ initialEntry: `/word/${SEED.id}`, session: SESSION });

        await user.click(await screen.findByRole('button', { name: 'Delete' }));
        const dialog = await screen.findByRole('alertdialog');
        await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

        expect(await screen.findByText('Word deleted successfully')).toBeInTheDocument();
        expect(fake.store.has(SEED.id)).toBe(false);
        await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    });
});
