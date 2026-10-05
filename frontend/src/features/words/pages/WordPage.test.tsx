import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { renderApp } from '@/test/render';
import { server } from '@/test/msw/server';
import { makeWordHandlers } from '@/test/msw/wordHandlers';
import { makeTagHandlers } from '@/test/msw/tagHandlers';
import { useAuthStore } from '@/stores/authStore';
import { futureToken } from '@/test/tokens';
import { mockMobileViewport } from '@/test/viewport';
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

    it('phone: the "Detailed view" line goes under the word, the subtitle is gone, and the menu button shares the word\'s row', async () => {
        mockMobileViewport();
        server.use(...makeWordHandlers({ callerId: SESSION.id, seed: [SEED] }).handlers);
        await renderApp({ initialEntry: `/word/${SEED.id}`, session: SESSION });

        const heading = await screen.findByRole('heading', { level: 1, name: 'house' });
        const line = screen.getByText('Detailed view: Noun');
        expect(heading.compareDocumentPosition(line) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(screen.queryByText('All the currently stored translations for this word')).not.toBeInTheDocument();

        const trigger = screen.getByRole('button', { name: 'Open menu' });
        expect(trigger.parentElement?.contains(heading)).toBe(true);
    });

    it('phone: view mode shows only the icons of what the word has; Edit shows all three', async () => {
        mockMobileViewport();
        const user = userEvent.setup();
        // A clue, no tags, and links never hold anything yet.
        server.use(...makeWordHandlers({ callerId: SESSION.id, seed: [SEED] }).handlers);
        await renderApp({ initialEntry: `/word/${SEED.id}`, session: SESSION });

        const trigger = await screen.findByRole('button', { name: 'Open menu' });
        expect(within(trigger).getByTestId('trigger-clue')).toBeInTheDocument();
        expect(within(trigger).queryByTestId('trigger-tags')).not.toBeInTheDocument();
        expect(within(trigger).queryByTestId('trigger-linked-words')).not.toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Edit' }));
        const editTrigger = await screen.findByRole('button', { name: 'Open menu' });
        expect(within(editTrigger).getByTestId('trigger-clue')).toBeInTheDocument();
        expect(within(editTrigger).getByTestId('trigger-tags')).toBeInTheDocument();
        expect(within(editTrigger).getByTestId('trigger-linked-words')).toBeInTheDocument();
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

    it('has a back arrow next to the title that goes back like Return, but only outside edit mode', async () => {
        server.use(...makeWordHandlers({ callerId: SESSION.id, seed: [SEED] }).handlers);
        const user = userEvent.setup();
        const { router } = await renderApp({ initialEntry: `/word/${SEED.id}`, session: SESSION });

        await user.click(await screen.findByRole('button', { name: 'Edit' }));
        expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Cancel' }));

        await user.click(await screen.findByRole('button', { name: 'Back' }));
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
        // `WordForm`'s sidebar always mounts the live `TagCombobox` now (D4a).
        server.use(...fake.handlers, ...makeTagHandlers({ callerId: SESSION.id }).handlers);
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
        server.use(...fake.handlers, ...makeTagHandlers({ callerId: SESSION.id }).handlers);
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

describe('WordPage — tags (view state is read-only; 2026-09-28 reversal)', () => {
    it("shows the word's existing tags as plain, non-removable chips, with a hint to edit the word", async () => {
        server.use(
            ...makeWordHandlers({
                callerId: SESSION.id,
                seed: [{ ...SEED, tags: [{ id: 'tag-1', label: 'Kitchen', visibility: 'Private', authorId: SESSION.id }] }],
            }).handlers,
        );
        await renderApp({ initialEntry: `/word/${SEED.id}`, session: SESSION });

        expect(await screen.findByText('Kitchen')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Remove Kitchen' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Add tag' })).not.toBeInTheDocument();
        expect(screen.queryByPlaceholderText('Search tags to add…')).not.toBeInTheDocument();
        expect(screen.getByText('Edit the word to add or remove tags.')).toBeInTheDocument();
    });

    it('changing tags is only possible after entering Edit — the combobox appears there, but nothing is sent until Save is pressed', async () => {
        const wordsFake = makeWordHandlers({
            callerId: SESSION.id,
            seed: [{ ...SEED, tags: [{ id: 'tag-1', label: 'Kitchen', visibility: 'Private', authorId: SESSION.id }] }],
        });
        const tagsFake = makeTagHandlers({
            callerId: SESSION.id,
            seedTags: [{ id: 'tag-1', authorId: SESSION.id, label: 'Kitchen', visibility: 'Private', wordIds: [SEED.id] }],
            wordOwners: { [SEED.id]: SESSION.id },
        });
        server.use(...wordsFake.handlers, ...tagsFake.handlers);
        const user = userEvent.setup();
        await renderApp({ initialEntry: `/word/${SEED.id}`, session: SESSION });

        expect(await screen.findByText('Kitchen')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Remove Kitchen' })).not.toBeInTheDocument();

        await user.click(await screen.findByRole('button', { name: 'Edit' }));
        await user.click(await screen.findByRole('button', { name: 'Remove Kitchen' }));

        // Staged only — removing the chip alone must not call the API yet.
        expect(tagsFake.requests).toHaveLength(0);
        await waitFor(() => expect(screen.getByRole('button', { name: 'Save word' })).toBeEnabled());

        await user.click(screen.getByRole('button', { name: 'Save word' }));
        await waitFor(() =>
            expect(tagsFake.requests).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ path: '/tags/links/remove', body: { tagIds: ['tag-1'], wordIds: [SEED.id] } }),
                ]),
            ),
        );
        expect(wordsFake.requests).toHaveLength(1);
    });

    it('Cancel after removing a tag in Edit discards the change — the view still shows it', async () => {
        server.use(
            ...makeWordHandlers({
                callerId: SESSION.id,
                seed: [{ ...SEED, tags: [{ id: 'tag-1', label: 'Kitchen', visibility: 'Private', authorId: SESSION.id }] }],
            }).handlers,
            ...makeTagHandlers({
                callerId: SESSION.id,
                seedTags: [{ id: 'tag-1', authorId: SESSION.id, label: 'Kitchen', visibility: 'Private', wordIds: [SEED.id] }],
                wordOwners: { [SEED.id]: SESSION.id },
            }).handlers,
        );
        const user = userEvent.setup();
        await renderApp({ initialEntry: `/word/${SEED.id}`, session: SESSION });

        await user.click(await screen.findByRole('button', { name: 'Edit' }));
        await user.click(await screen.findByRole('button', { name: 'Remove Kitchen' }));
        await user.click(screen.getByRole('button', { name: 'Cancel' }));

        // Back to the read-only view — the discarded removal never went out.
        expect(await screen.findByText('Kitchen')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Remove Kitchen' })).not.toBeInTheDocument();
    });

    it('on desktop, Cancel renders immediately next to (left of) Save word, not grouped with Delete', async () => {
        server.use(...makeWordHandlers({ callerId: SESSION.id, seed: [SEED] }).handlers);
        const user = userEvent.setup();
        await renderApp({ initialEntry: `/word/${SEED.id}`, session: SESSION });

        await user.click(await screen.findByRole('button', { name: 'Edit' }));
        const bar = screen.getByTestId('word-editor-bar');
        const buttons = within(bar).getAllByRole('button');
        const names = buttons.map((button) => button.textContent);
        const cancelIndex = names.findIndex((name) => name?.includes('Cancel'));
        const saveIndex = names.findIndex((name) => name?.includes('Save word'));
        const deleteIndex = names.findIndex((name) => name?.includes('Delete'));

        expect(cancelIndex).toBeGreaterThan(-1);
        expect(saveIndex).toBe(cancelIndex + 1);
        expect(deleteIndex).toBeLessThan(cancelIndex);
    });
});
