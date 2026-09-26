import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { futureToken } from '@/test/tokens';
import { Lang, NounCases, PartOfSpeech } from '@/ts/enums';
import type { WordBE } from '../types';
import { WordForm } from './WordForm';

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

// The "+ Add translation" tile lists one chip per free language — a chip click adds it, no dialog.
async function addLanguage(user: ReturnType<typeof userEvent.setup>, native: string) {
    await user.click(screen.getByRole('button', { name: native }));
}

describe('WordForm — create mode', () => {
    // D37: the gate's own heading moved to `AddWordPage` — `WordForm` renders
    // no heading of its own, only the PoS radio group.
    it('gates on part of speech, then hides the gate once Noun is picked', async () => {
        const user = userEvent.setup();
        renderWithProviders(<WordForm mode="create" onSubmit={vi.fn()} />, { session: SESSION });

        expect(screen.getByRole('radiogroup')).toBeInTheDocument();
        await user.click(screen.getByRole('radio', { name: /Noun/ }));

        expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
        expect(screen.getByRole('group', { name: 'Add translation' })).toBeInTheDocument();
    });

    it('skips the gate when defaultPartOfSpeech is given', () => {
        renderWithProviders(<WordForm mode="create" defaultPartOfSpeech={PartOfSpeech.noun} onSubmit={vi.fn()} />, {
            session: SESSION,
        });
        expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
    });

    it('fires onPartOfSpeechChange the moment a type is picked on the gate', async () => {
        const user = userEvent.setup();
        const onPartOfSpeechChange = vi.fn();
        renderWithProviders(
            <WordForm mode="create" onSubmit={vi.fn()} onPartOfSpeechChange={onPartOfSpeechChange} />,
            { session: SESSION },
        );

        await user.click(screen.getByRole('radio', { name: /Noun/ }));
        expect(onPartOfSpeechChange).toHaveBeenCalledWith(PartOfSpeech.noun);
    });

    describe('Change word type', () => {
        it('shows only when onChangePartOfSpeech is passed, and only in create mode', () => {
            const { unmount } = renderWithProviders(
                <WordForm mode="create" defaultPartOfSpeech={PartOfSpeech.noun} onSubmit={vi.fn()} />,
                { session: SESSION },
            );
            expect(screen.queryByRole('button', { name: 'Change word type' })).not.toBeInTheDocument();
            unmount();

            renderWithProviders(
                <WordForm
                    mode="create"
                    defaultPartOfSpeech={PartOfSpeech.noun}
                    onSubmit={vi.fn()}
                    onChangePartOfSpeech={vi.fn()}
                />,
                { session: SESSION },
            );
            expect(screen.getByRole('button', { name: 'Change word type' })).toBeInTheDocument();
        });

        it('returns to the gate immediately on an untouched form', async () => {
            const user = userEvent.setup();
            const onChangePartOfSpeech = vi.fn();
            renderWithProviders(
                <WordForm
                    mode="create"
                    defaultPartOfSpeech={PartOfSpeech.noun}
                    onSubmit={vi.fn()}
                    onChangePartOfSpeech={onChangePartOfSpeech}
                />,
                { session: SESSION },
            );

            await user.click(screen.getByRole('button', { name: 'Change word type' }));
            expect(onChangePartOfSpeech).toHaveBeenCalledTimes(1);
            expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
        });

        it('confirms before discarding a form with typed content; Cancel keeps the form', async () => {
            const user = userEvent.setup();
            const onChangePartOfSpeech = vi.fn();
            renderWithProviders(
                <WordForm
                    mode="create"
                    defaultPartOfSpeech={PartOfSpeech.noun}
                    onSubmit={vi.fn()}
                    onChangePartOfSpeech={onChangePartOfSpeech}
                />,
                { session: SESSION },
            );

            await addLanguage(user, 'English');
            await user.type(screen.getByLabelText('Singular'), 'House');

            await user.click(screen.getByRole('button', { name: 'Change word type' }));
            const dialog = await screen.findByRole('alertdialog');
            expect(onChangePartOfSpeech).not.toHaveBeenCalled();

            await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
            expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
            expect(onChangePartOfSpeech).not.toHaveBeenCalled();
            expect(screen.getByLabelText('Singular')).toHaveValue('House');
        });

        it('Confirm discards the form and calls onChangePartOfSpeech', async () => {
            const user = userEvent.setup();
            const onChangePartOfSpeech = vi.fn();
            renderWithProviders(
                <WordForm
                    mode="create"
                    defaultPartOfSpeech={PartOfSpeech.noun}
                    onSubmit={vi.fn()}
                    onChangePartOfSpeech={onChangePartOfSpeech}
                />,
                { session: SESSION },
            );

            await addLanguage(user, 'English');
            await user.type(screen.getByLabelText('Singular'), 'House');

            await user.click(screen.getByRole('button', { name: 'Change word type' }));
            const dialog = await screen.findByRole('alertdialog');
            await user.click(within(dialog).getByRole('button', { name: 'Change word type' }));

            expect(onChangePartOfSpeech).toHaveBeenCalledTimes(1);
        });

        it('is absent in edit mode even when onChangePartOfSpeech is passed — partOfSpeech is immutable after creation', () => {
            const initialWord: WordBE = {
                id: 'word-1',
                user: SESSION.id,
                partOfSpeech: PartOfSpeech.noun,
                translations: [
                    { id: 'tr-1', language: Lang.EN, cases: [{ caseName: NounCases.singularEN, word: 'house' }] },
                    { id: 'tr-2', language: Lang.ES, cases: [{ caseName: NounCases.singularES, word: 'casa' }] },
                ],
                clue: null,
                isCloned: false,
                originalCreator: null,
                tags: [],
                createdAt: '2026-01-01T00:00:00.000Z',
                updatedAt: '2026-01-01T00:00:00.000Z',
            };
            renderWithProviders(
                <WordForm
                    mode="edit"
                    initialWord={initialWord}
                    onSubmit={vi.fn()}
                    onDelete={vi.fn()}
                    onChangePartOfSpeech={vi.fn()}
                />,
                { session: SESSION },
            );
            expect(screen.queryByRole('button', { name: 'Change word type' })).not.toBeInTheDocument();
        });
    });

    it('lists the free languages as chips under "Add translation"; a click adds the card and drops its chip', async () => {
        const user = userEvent.setup();
        renderWithProviders(<WordForm mode="create" defaultPartOfSpeech={PartOfSpeech.noun} onSubmit={vi.fn()} />, {
            session: SESSION,
        });

        const tile = screen.getByRole('group', { name: 'Add translation' });
        expect(within(tile).getByRole('button', { name: 'English' })).toBeInTheDocument();
        expect(within(tile).getByRole('button', { name: 'Español' })).toBeInTheDocument();

        await addLanguage(user, 'English');
        expect(screen.getByLabelText('Singular')).toBeInTheDocument();
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

        // Only Spanish is left to add.
        expect(within(tile).getByRole('button', { name: 'Español' })).toBeInTheDocument();
        expect(within(tile).queryByRole('button', { name: 'English' })).not.toBeInTheDocument();
    });

    it('keeps Remove enabled even at 2 slots, and hides the Add translation tile once every language is used', async () => {
        const user = userEvent.setup();
        renderWithProviders(<WordForm mode="create" defaultPartOfSpeech={PartOfSpeech.noun} onSubmit={vi.fn()} />, {
            session: SESSION,
        });

        await addLanguage(user, 'English');
        await addLanguage(user, 'Español');

        expect(screen.getAllByRole('button', { name: 'Remove' })[0]).toBeEnabled();
        expect(screen.queryByRole('group', { name: 'Add translation' })).not.toBeInTheDocument();
    });

    it('explains in the bottom bar why Save is disabled, and shows nothing once it is enabled', async () => {
        const user = userEvent.setup();
        renderWithProviders(<WordForm mode="create" defaultPartOfSpeech={PartOfSpeech.noun} onSubmit={vi.fn()} />, {
            session: SESSION,
        });
        const bar = screen.getByTestId('word-editor-bar');
        const reason = () => within(bar).queryByRole('status');

        expect(within(bar).getByText('Fields marked with * are required.')).toBeInTheDocument();
        expect(reason()).toHaveTextContent('Add at least 2 translations before you can save.');

        await addLanguage(user, 'English');
        expect(reason()).toHaveTextContent('Add at least 2 translations before you can save.'); // still only 1 slot

        await addLanguage(user, 'Español');
        expect(reason()).toHaveTextContent('Fill in every required field (marked *) in all translations.');

        const [singularEN, singularES] = screen.getAllByLabelText('Singular');
        await user.type(singularEN!, 'House');
        await user.type(singularES!, 'Casa');
        await user.click(screen.getByRole('radio', { name: 'el' }));
        await waitFor(() => expect(reason()).not.toBeInTheDocument());
        expect(within(bar).getByRole('button', { name: 'Save word' })).toBeEnabled();
    });

    it('puts the actions in the bottom bar, not the sidebar', () => {
        renderWithProviders(
            <WordForm
                mode="create"
                defaultPartOfSpeech={PartOfSpeech.noun}
                onSubmit={vi.fn()}
                onChangePartOfSpeech={vi.fn()}
            />,
            { session: SESSION },
        );
        const bar = screen.getByTestId('word-editor-bar');
        expect(within(bar).getByRole('button', { name: 'Change word type' })).toBeInTheDocument();
        expect(within(bar).getByRole('button', { name: 'Save word' })).toBeInTheDocument();
        const sidebar = screen.getByLabelText('Clue').closest('aside')!;
        expect(within(sidebar).queryByRole('button', { name: 'Change word type' })).not.toBeInTheDocument();
        expect(within(sidebar).queryByRole('button', { name: 'Save word' })).not.toBeInTheDocument();
    });

    it('gates Save on >= 2 complete + dirty slots, then submits the exact nested payload', async () => {
        const user = userEvent.setup();
        const onSubmit = vi.fn();
        renderWithProviders(<WordForm mode="create" defaultPartOfSpeech={PartOfSpeech.noun} onSubmit={onSubmit} />, {
            session: SESSION,
        });

        const save = () => screen.getByRole('button', { name: 'Save word' });
        await addLanguage(user, 'English');
        await addLanguage(user, 'Español');
        expect(save()).toBeDisabled();

        const [singularEN, singularES] = screen.getAllByLabelText('Singular');
        await user.type(singularEN!, 'House');
        expect(save()).toBeDisabled(); // Spanish still incomplete (needs gender too)

        await user.type(singularES!, 'Casa');
        await user.click(screen.getByRole('radio', { name: 'el' }));

        await waitFor(() => expect(save()).toBeEnabled());
        await user.click(save());

        expect(onSubmit).toHaveBeenCalledWith({
            partOfSpeech: 'Noun',
            clue: undefined,
            translations: [
                { language: 'English', cases: [{ caseName: NounCases.singularEN, word: 'house' }] },
                {
                    language: 'Spanish',
                    // Config field order (gender, then registry rows) drives case order.
                    cases: [
                        { caseName: NounCases.genderES, word: 'el' },
                        { caseName: NounCases.singularES, word: 'casa' },
                    ],
                },
            ],
        });
    });

    it('Clear empties a translation added (but not yet saved) this session', async () => {
        const user = userEvent.setup();
        renderWithProviders(<WordForm mode="create" defaultPartOfSpeech={PartOfSpeech.noun} onSubmit={vi.fn()} />, {
            session: SESSION,
        });

        await addLanguage(user, 'English');
        await user.type(screen.getByLabelText('Singular'), 'House');
        expect(screen.getByLabelText('Singular')).toHaveValue('House');

        await user.click(screen.getByRole('button', { name: 'Clear' }));

        await waitFor(() => expect(screen.getByLabelText('Singular')).toHaveValue(''));
        // The card still works normally afterward — typing again isn't stuck.
        await user.type(screen.getByLabelText('Singular'), 'Cat');
        expect(screen.getByLabelText('Singular')).toHaveValue('Cat');
    });

    it('Remove drops a slot and stays enabled even after dropping back to 2', async () => {
        const user = userEvent.setup();
        renderWithProviders(<WordForm mode="create" defaultPartOfSpeech={PartOfSpeech.noun} onSubmit={vi.fn()} />, {
            session: { ...SESSION, languages: ['English', 'Spanish', 'German'] },
        });

        await addLanguage(user, 'English');
        await addLanguage(user, 'Español');
        await addLanguage(user, 'Deutsch');

        const removeButtons = screen.getAllByRole('button', { name: 'Remove' });
        expect(removeButtons[0]).toBeEnabled();
        await user.click(removeButtons[0]!);

        // The English card is gone (only Spanish's plain "Singular" field is left) and its
        // language is free again, so its chip is back in the "Add translation" tile.
        expect(screen.getAllByLabelText('Singular')).toHaveLength(1);
        expect(
            within(screen.getByRole('group', { name: 'Add translation' })).getByRole('button', { name: 'English' }),
        ).toBeInTheDocument();
        expect(screen.getAllByRole('button', { name: 'Remove' })[0]).toBeEnabled(); // back to 2 slots, still enabled
    });

    describe('Remove confirmation', () => {
        it('removes an empty card at once, with no dialog', async () => {
            const user = userEvent.setup();
            renderWithProviders(<WordForm mode="create" defaultPartOfSpeech={PartOfSpeech.noun} onSubmit={vi.fn()} />, {
                session: SESSION,
            });
            await addLanguage(user, 'English');

            await user.click(screen.getByRole('button', { name: 'Remove' }));
            expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
            expect(screen.queryByLabelText('Singular')).not.toBeInTheDocument();
        });

        it('asks first when the card holds typed data (not yet saved); Cancel keeps it', async () => {
            const user = userEvent.setup();
            renderWithProviders(<WordForm mode="create" defaultPartOfSpeech={PartOfSpeech.noun} onSubmit={vi.fn()} />, {
                session: SESSION,
            });
            await addLanguage(user, 'English');
            await user.type(screen.getByLabelText('Singular'), 'House');

            await user.click(screen.getByRole('button', { name: 'Remove' }));
            const dialog = await screen.findByRole('alertdialog');
            expect(within(dialog).getByText('Remove this translation?')).toBeInTheDocument();
            expect(within(dialog).getByText(/The English translation and everything entered in it/)).toBeInTheDocument();

            await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
            expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
            expect(screen.getByLabelText('Singular')).toHaveValue('House');
        });

        it('Confirm removes the card and frees its language again', async () => {
            const user = userEvent.setup();
            renderWithProviders(<WordForm mode="create" defaultPartOfSpeech={PartOfSpeech.noun} onSubmit={vi.fn()} />, {
                session: SESSION,
            });
            await addLanguage(user, 'English');
            await user.type(screen.getByLabelText('Singular'), 'House');

            await user.click(screen.getByRole('button', { name: 'Remove' }));
            const dialog = await screen.findByRole('alertdialog');
            await user.click(within(dialog).getByRole('button', { name: 'Remove' }));

            await waitFor(() => expect(screen.queryByLabelText('Singular')).not.toBeInTheDocument());
            expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
            expect(
                within(screen.getByRole('group', { name: 'Add translation' })).getByRole('button', { name: 'English' }),
            ).toBeInTheDocument();
        });

        it('a card emptied by hand (typed, then deleted) goes without asking', async () => {
            const user = userEvent.setup();
            renderWithProviders(<WordForm mode="create" defaultPartOfSpeech={PartOfSpeech.noun} onSubmit={vi.fn()} />, {
                session: SESSION,
            });
            await addLanguage(user, 'English');
            await user.type(screen.getByLabelText('Singular'), 'Hi');
            await user.clear(screen.getByLabelText('Singular'));

            await user.click(screen.getByRole('button', { name: 'Remove' }));
            expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
            expect(screen.queryByLabelText('Singular')).not.toBeInTheDocument();
        });

        it('a card emptied with Clear goes without asking', async () => {
            const user = userEvent.setup();
            renderWithProviders(<WordForm mode="create" defaultPartOfSpeech={PartOfSpeech.noun} onSubmit={vi.fn()} />, {
                session: SESSION,
            });
            await addLanguage(user, 'English');
            await user.type(screen.getByLabelText('Singular'), 'House');
            await user.click(screen.getByRole('button', { name: 'Clear' }));
            await waitFor(() => expect(screen.getByLabelText('Singular')).toHaveValue(''));

            await user.click(screen.getByRole('button', { name: 'Remove' }));
            expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
        });

        it('edit mode: a saved translation asks first, even when nothing was changed', async () => {
            const user = userEvent.setup();
            const initialWord: WordBE = {
                id: 'word-1',
                user: SESSION.id,
                partOfSpeech: PartOfSpeech.noun,
                translations: [
                    { id: 'tr-1', language: Lang.EN, cases: [{ caseName: NounCases.singularEN, word: 'house' }] },
                    { id: 'tr-2', language: Lang.ES, cases: [{ caseName: NounCases.singularES, word: 'casa' }] },
                ],
                clue: null,
                isCloned: false,
                originalCreator: null,
                tags: [],
                createdAt: '2026-01-01T00:00:00.000Z',
                updatedAt: '2026-01-01T00:00:00.000Z',
            };
            renderWithProviders(<WordForm mode="edit" initialWord={initialWord} onSubmit={vi.fn()} />, {
                session: SESSION,
            });

            await user.click(screen.getAllByRole('button', { name: 'Remove' })[0]!);
            const dialog = await screen.findByRole('alertdialog');
            expect(within(dialog).getByText(/The English translation/)).toBeInTheDocument();
        });
    });
});
