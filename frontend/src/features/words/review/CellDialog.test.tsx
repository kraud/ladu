import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToastContainer } from 'react-toastify';
import { renderWithProviders } from '@/test/render';
import { server } from '@/test/msw/server';
import { makeWordHandlers } from '@/test/msw/wordHandlers';
import { useAuthStore } from '@/stores/authStore';
import { futureToken } from '@/test/tokens';
import { Lang, NounCases, PartOfSpeech } from '@/ts/enums';
import { CellDialog } from './CellDialog';

const SESSION = {
    id: 'u1',
    name: 'Kai Rebane',
    email: 'kai@example.com',
    username: 'kai',
    languages: ['English', 'Spanish', 'German'],
    uiLanguage: 'English',
    nativeLanguage: null,
    verified: true,
    token: futureToken(),
};

// Two stored translations — the minimum a word can have, so Delete stays hidden.
const TWO_LANG_WORD = {
    id: 'word-1',
    user: SESSION.id,
    partOfSpeech: PartOfSpeech.noun,
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

// Three stored translations — Delete becomes available.
const THREE_LANG_WORD = {
    ...TWO_LANG_WORD,
    id: 'word-2',
    translations: [
        ...TWO_LANG_WORD.translations,
        {
            language: Lang.DE,
            cases: [
                { caseName: NounCases.genderDE, word: 'der' },
                { caseName: NounCases.singularNominativDE, word: 'Baum' },
            ],
        },
    ],
};

function renderDialog(ui: { wordId: string; langKey: 'EN' | 'ES' | 'DE' | 'EE'; onClose: () => void }) {
    return renderWithProviders(
        <>
            <CellDialog {...ui} />
            <ToastContainer position="bottom-center" autoClose={false} />
        </>,
        { session: SESSION },
    );
}

afterEach(() => {
    useAuthStore.getState().clearSession();
});

describe('CellDialog — loading', () => {
    it('shows a loading skeleton while the word is being fetched', () => {
        server.use(...makeWordHandlers({ callerId: SESSION.id, seed: [TWO_LANG_WORD] }).handlers);
        renderDialog({ wordId: TWO_LANG_WORD.id, langKey: 'EN', onClose: vi.fn() });

        expect(document.querySelector('[data-slot="skeleton"]')).toBeInTheDocument();
    });
});

describe('CellDialog — edit', () => {
    it('prefills the card from the fetched word\'s stored cases for that language', async () => {
        server.use(...makeWordHandlers({ callerId: SESSION.id, seed: [TWO_LANG_WORD] }).handlers);
        renderDialog({ wordId: TWO_LANG_WORD.id, langKey: 'ES', onClose: vi.fn() });

        expect(await screen.findByLabelText('Singular')).toHaveValue('casa');
        expect(screen.getByRole('radio', { name: 'el' })).toBeChecked();
    });

    it('Save is disabled until the card is both dirty and valid', async () => {
        server.use(...makeWordHandlers({ callerId: SESSION.id, seed: [TWO_LANG_WORD] }).handlers);
        const user = userEvent.setup();
        renderDialog({ wordId: TWO_LANG_WORD.id, langKey: 'EN', onClose: vi.fn() });

        const singular = await screen.findByLabelText('Singular');
        expect(singular).toHaveValue('house');
        // Hydrated-but-unedited: valid, but not dirty.
        expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();

        await user.clear(singular);
        // Dirty, but now invalid (blank required field).
        await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled());

        await user.type(singular, 'cottage');
        await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled());
    });

    it('sends every translation, with only the edited language\'s cases changed (D29)', async () => {
        const fake = makeWordHandlers({ callerId: SESSION.id, seed: [TWO_LANG_WORD] });
        server.use(...fake.handlers);
        const user = userEvent.setup();
        renderDialog({ wordId: TWO_LANG_WORD.id, langKey: 'EN', onClose: vi.fn() });

        const singular = await screen.findByLabelText('Singular');
        await user.clear(singular);
        await user.type(singular, 'cottage');
        await user.click(await screen.findByRole('button', { name: 'Save' }));

        await waitFor(() => expect(fake.requests).toHaveLength(1));
        expect(fake.requests[0]?.body).toMatchObject({
            id: TWO_LANG_WORD.id,
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
    });

    it('closes and toasts success on save', async () => {
        server.use(...makeWordHandlers({ callerId: SESSION.id, seed: [TWO_LANG_WORD] }).handlers);
        const user = userEvent.setup();
        const onClose = vi.fn();
        renderDialog({ wordId: TWO_LANG_WORD.id, langKey: 'EN', onClose });

        const singular = await screen.findByLabelText('Singular');
        await user.clear(singular);
        await user.type(singular, 'cottage');
        await user.click(await screen.findByRole('button', { name: 'Save' }));

        expect(await screen.findByText('English translation updated')).toBeInTheDocument();
        await waitFor(() => expect(onClose).toHaveBeenCalled());
    });
});

describe('CellDialog — add', () => {
    it('appends a new language rather than replacing an existing one', async () => {
        const fake = makeWordHandlers({ callerId: SESSION.id, seed: [TWO_LANG_WORD] });
        server.use(...fake.handlers);
        const user = userEvent.setup();
        renderDialog({ wordId: TWO_LANG_WORD.id, langKey: 'DE', onClose: vi.fn() });

        const singular = await screen.findByLabelText('Singular nominative');
        expect(singular).toHaveValue('');
        await user.click(screen.getByRole('radio', { name: 'der' }));
        await user.type(singular, 'Haus');
        await user.click(await screen.findByRole('button', { name: 'Save' }));

        await waitFor(() => expect(fake.requests).toHaveLength(1));
        const body = fake.requests[0]?.body as { translations: Array<{ language: string }> };
        expect(body.translations).toHaveLength(3);
        expect(body.translations.map((tr) => tr.language)).toEqual(['English', 'Spanish', 'German']);
    });

    it('has no Delete translation button', async () => {
        server.use(...makeWordHandlers({ callerId: SESSION.id, seed: [TWO_LANG_WORD] }).handlers);
        renderDialog({ wordId: TWO_LANG_WORD.id, langKey: 'DE', onClose: vi.fn() });

        await screen.findByLabelText('Singular nominative');
        expect(screen.queryByRole('button', { name: 'Delete translation' })).not.toBeInTheDocument();
    });
});

describe('CellDialog — delete translation', () => {
    it('is hidden when the word has only 2 stored translations', async () => {
        server.use(...makeWordHandlers({ callerId: SESSION.id, seed: [TWO_LANG_WORD] }).handlers);
        renderDialog({ wordId: TWO_LANG_WORD.id, langKey: 'EN', onClose: vi.fn() });

        await screen.findByLabelText('Singular');
        expect(screen.queryByRole('button', { name: 'Delete translation' })).not.toBeInTheDocument();
    });

    it('is shown at 3 translations, and confirming sends the set minus that language', async () => {
        const fake = makeWordHandlers({ callerId: SESSION.id, seed: [THREE_LANG_WORD] });
        server.use(...fake.handlers);
        const user = userEvent.setup();
        renderDialog({ wordId: THREE_LANG_WORD.id, langKey: 'DE', onClose: vi.fn() });

        await screen.findByLabelText('Singular nominative');
        await user.click(screen.getByRole('button', { name: 'Delete translation' }));

        const dialog = await screen.findByRole('alertdialog');
        await user.click(within(dialog).getByRole('button', { name: 'Delete translation' }));

        await waitFor(() => expect(fake.requests).toHaveLength(1));
        const body = fake.requests[0]?.body as { translations: Array<{ language: string }> };
        expect(body.translations.map((tr) => tr.language)).toEqual(['English', 'Spanish']);
        // Native language name, not the English word — same convention `WordCell`
        // and `LanguagePicker` already use (design commandment: no language
        // treated as "primary", including via translation of its own name).
        expect(await screen.findByText('Deutsch translation removed')).toBeInTheDocument();
    });
});

describe('CellDialog — error', () => {
    it('closes and shows an error toast when the word fails to load', async () => {
        server.use(...makeWordHandlers({ callerId: SESSION.id, seed: [] }).handlers);
        const onClose = vi.fn();
        renderDialog({ wordId: 'missing-word', langKey: 'EN', onClose });

        expect(await screen.findByText('This word could not be found.')).toBeInTheDocument();
        expect(onClose).toHaveBeenCalled();
    });
});
