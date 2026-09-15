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

async function addLanguage(user: ReturnType<typeof userEvent.setup>, native: string) {
    await user.click(screen.getByRole('button', { name: 'Add another translation' }));
    await user.click(await screen.findByRole('button', { name: native }));
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
        expect(screen.getByRole('button', { name: 'Add another translation' })).toBeInTheDocument();
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

    it('adds a language via the picker dialog, closes it, and removes availableLanguages from it next time', async () => {
        const user = userEvent.setup();
        renderWithProviders(<WordForm mode="create" defaultPartOfSpeech={PartOfSpeech.noun} onSubmit={vi.fn()} />, {
            session: SESSION,
        });

        await addLanguage(user, 'English');
        expect(screen.getByText('English')).toBeInTheDocument();
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

        // Only Spanish is left to add.
        await user.click(screen.getByRole('button', { name: 'Add another translation' }));
        expect(screen.getByRole('button', { name: 'Español' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'English' })).not.toBeInTheDocument();
    });

    it('keeps Remove enabled even at 2 slots, and disables Add another translation once every language is used', async () => {
        const user = userEvent.setup();
        renderWithProviders(<WordForm mode="create" defaultPartOfSpeech={PartOfSpeech.noun} onSubmit={vi.fn()} />, {
            session: SESSION,
        });

        await addLanguage(user, 'English');
        await addLanguage(user, 'Español');

        expect(screen.getAllByRole('button', { name: 'Remove' })[0]).toBeEnabled();
        expect(screen.getByRole('button', { name: 'Add another translation' })).toBeDisabled();
    });

    it('shows the min-translations hint below 2 slots and hides it once 2 are added', async () => {
        const user = userEvent.setup();
        renderWithProviders(<WordForm mode="create" defaultPartOfSpeech={PartOfSpeech.noun} onSubmit={vi.fn()} />, {
            session: SESSION,
        });

        const hint = 'Add at least 2 translations before you can save.';
        expect(screen.getByText(hint)).toBeInTheDocument();

        await addLanguage(user, 'English');
        expect(screen.getByText(hint)).toBeInTheDocument(); // still only 1 slot

        await addLanguage(user, 'Español');
        expect(screen.queryByText(hint)).not.toBeInTheDocument();
    });

    it('gates Save on >= 2 complete + dirty slots, then submits the exact nested payload', async () => {
        const user = userEvent.setup();
        const onSubmit = vi.fn();
        renderWithProviders(<WordForm mode="create" defaultPartOfSpeech={PartOfSpeech.noun} onSubmit={onSubmit} />, {
            session: SESSION,
        });

        const save = () => screen.getByRole('button', { name: 'Save' });
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

        expect(screen.queryByText('English')).not.toBeInTheDocument();
        expect(screen.getAllByRole('button', { name: 'Remove' })[0]).toBeEnabled(); // back to 2 slots, still enabled
    });
});
