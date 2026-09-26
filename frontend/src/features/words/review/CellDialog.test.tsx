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

function renderDialog(ui: {
    wordId: string;
    langKey: 'EN' | 'ES' | 'DE' | 'EE';
    onClose: () => void;
    nativeLanguage?: string | null;
    userLanguages?: readonly string[];
}) {
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

// D41: a cell with an existing translation opens read-only first — this
// helper reaches the editable form the way a user would, via the Edit button.
async function openForEdit(user: ReturnType<typeof userEvent.setup>) {
    await user.click(await screen.findByRole('button', { name: 'Edit' }));
}

describe('CellDialog — display', () => {
    it('opens read-only, prefilled from the fetched word\'s stored cases, with no Save button', async () => {
        server.use(...makeWordHandlers({ callerId: SESSION.id, seed: [TWO_LANG_WORD] }).handlers);
        renderDialog({ wordId: TWO_LANG_WORD.id, langKey: 'ES', onClose: vi.fn() });

        // Twice now: the dialog title and the read-only value.
        expect(await screen.findAllByText('casa')).toHaveLength(2);
        expect(screen.getByText('el')).toBeInTheDocument();
        expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    });

    it('Edit reveals the editable inputs; Close closes the dialog directly', async () => {
        server.use(...makeWordHandlers({ callerId: SESSION.id, seed: [TWO_LANG_WORD] }).handlers);
        const user = userEvent.setup();
        const onClose = vi.fn();
        renderDialog({ wordId: TWO_LANG_WORD.id, langKey: 'EN', onClose });

        await openForEdit(user);
        expect(await screen.findByLabelText('Singular')).toHaveValue('house');

        await user.click(screen.getByRole('button', { name: 'Close' }));
        expect(onClose).toHaveBeenCalled();
    });

    it('Cancel from edit mode returns to read-only and discards the typed change', async () => {
        server.use(...makeWordHandlers({ callerId: SESSION.id, seed: [TWO_LANG_WORD] }).handlers);
        const user = userEvent.setup();
        renderDialog({ wordId: TWO_LANG_WORD.id, langKey: 'EN', onClose: vi.fn() });

        await openForEdit(user);
        const singular = await screen.findByLabelText('Singular');
        await user.clear(singular);
        await user.type(singular, 'cottage');

        await user.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(await screen.findAllByText('house')).toHaveLength(2); // title + read-only value
        expect(screen.queryByText('cottage')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    });
});

describe('CellDialog — edit', () => {
    it('Save is disabled until the card is both dirty and valid', async () => {
        server.use(...makeWordHandlers({ callerId: SESSION.id, seed: [TWO_LANG_WORD] }).handlers);
        const user = userEvent.setup();
        renderDialog({ wordId: TWO_LANG_WORD.id, langKey: 'EN', onClose: vi.fn() });

        await openForEdit(user);
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

        await openForEdit(user);
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

        await openForEdit(user);
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

    it('has no Delete translation button and no Edit button — it opens straight into edit mode (D41)', async () => {
        server.use(...makeWordHandlers({ callerId: SESSION.id, seed: [TWO_LANG_WORD] }).handlers);
        renderDialog({ wordId: TWO_LANG_WORD.id, langKey: 'DE', onClose: vi.fn() });

        await screen.findByLabelText('Singular nominative');
        expect(screen.queryByRole('button', { name: 'Delete translation' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    });
});

describe('CellDialog — one header, no frame around the form (Slice 18)', () => {
    /**
     * The dialog's title is the only header: the flag plus the headword, no language name. The card's
     * own header used to add a second flag + a bare language-name label, a collapse toggle and a ring.
     */
    function expectOnlyDialogHeader(native: string, headword: string) {
        const dialog = screen.getByRole('dialog');
        expect(within(dialog).getByRole('heading').textContent).toBe(headword);
        expect(within(dialog).queryByText(native)).not.toBeInTheDocument(); // no language name anywhere as text
        expect(within(dialog).queryAllByRole('img', { name: native })).toHaveLength(1); // one flag, in the title
        expect(within(dialog).queryByRole('button', { name: /collapse translation|expand translation/i })).not.toBeInTheDocument();
        expect(dialog.querySelector('.ring')).not.toBeInTheDocument();
        // No card frame: neither the rounded border nor the coloured top line.
        expect(dialog.querySelector('.rounded-lg.border')).not.toBeInTheDocument();
    }

    it('view (a filled cell): the dialog title is the only header', async () => {
        server.use(...makeWordHandlers({ callerId: SESSION.id, seed: [TWO_LANG_WORD] }).handlers);
        renderDialog({ wordId: TWO_LANG_WORD.id, langKey: 'EN', onClose: vi.fn() });

        await screen.findByRole('button', { name: 'Edit' }); // read-only view is up (the word also appears in the title, so no text lookup)
        expectOnlyDialogHeader('English', 'house');
    });

    it('edit (Edit pressed): still one header, and the fields are there', async () => {
        server.use(...makeWordHandlers({ callerId: SESSION.id, seed: [TWO_LANG_WORD] }).handlers);
        const user = userEvent.setup();
        renderDialog({ wordId: TWO_LANG_WORD.id, langKey: 'EN', onClose: vi.fn() });

        await openForEdit(user);
        expect(await screen.findByLabelText('Singular')).toHaveValue('house');
        expectOnlyDialogHeader('English', 'house');
    });

    it('add (an empty cell): still one header, straight in edit mode', async () => {
        server.use(...makeWordHandlers({ callerId: SESSION.id, seed: [TWO_LANG_WORD] }).handlers);
        renderDialog({ wordId: TWO_LANG_WORD.id, langKey: 'DE', onClose: vi.fn() });

        await screen.findByLabelText('Singular nominative');
        expectOnlyDialogHeader('Deutsch', 'house');
    });
});

describe('CellDialog — title: the headword, in the right language', () => {
    const title = () => screen.getByRole('dialog').querySelector('[data-slot="dialog-title"]')!.textContent;

    it("view: the dialog language's own main case, not the word's first translation", async () => {
        server.use(...makeWordHandlers({ callerId: SESSION.id, seed: [TWO_LANG_WORD] }).handlers);
        renderDialog({ wordId: TWO_LANG_WORD.id, langKey: 'ES', onClose: vi.fn() });

        await screen.findByRole('button', { name: 'Edit' }); // read-only view is up (the word also appears in the title, so no text lookup)
        expect(title()).toBe('casa'); // the first translation is English ("house")
    });

    it('edit: the title keeps the same headword while editing', async () => {
        server.use(...makeWordHandlers({ callerId: SESSION.id, seed: [TWO_LANG_WORD] }).handlers);
        const user = userEvent.setup();
        renderDialog({ wordId: TWO_LANG_WORD.id, langKey: 'ES', onClose: vi.fn() });

        await openForEdit(user);
        await screen.findByLabelText('Singular');
        expect(title()).toBe('casa');
    });

    it('view/edit ignore the native language: an existing translation shows its own word', async () => {
        server.use(...makeWordHandlers({ callerId: SESSION.id, seed: [TWO_LANG_WORD] }).handlers);
        renderDialog({
            wordId: TWO_LANG_WORD.id,
            langKey: 'EN',
            onClose: vi.fn(),
            nativeLanguage: 'Spanish',
            userLanguages: ['Spanish', 'English'],
        });

        await screen.findByRole('button', { name: 'Edit' }); // read-only view is up (the word also appears in the title, so no text lookup)
        expect(title()).toBe('house');
    });

    it('create: the native language\'s main case when the word has a translation in it', async () => {
        server.use(...makeWordHandlers({ callerId: SESSION.id, seed: [TWO_LANG_WORD] }).handlers);
        renderDialog({
            wordId: TWO_LANG_WORD.id,
            langKey: 'DE',
            onClose: vi.fn(),
            nativeLanguage: 'Spanish',
            userLanguages: ['English', 'Spanish', 'German'],
        });

        await screen.findByLabelText('Singular nominative');
        expect(title()).toBe('casa');
    });

    it('create, no native language: the first account language the word has', async () => {
        server.use(...makeWordHandlers({ callerId: SESSION.id, seed: [TWO_LANG_WORD] }).handlers);
        renderDialog({
            wordId: TWO_LANG_WORD.id,
            langKey: 'DE',
            onClose: vi.fn(),
            nativeLanguage: null,
            userLanguages: ['Spanish', 'English', 'German'],
        });

        await screen.findByLabelText('Singular nominative');
        expect(title()).toBe('casa');
    });

    it('create, native language not on the word yet: falls back to the first account language it has', async () => {
        server.use(...makeWordHandlers({ callerId: SESSION.id, seed: [TWO_LANG_WORD] }).handlers);
        renderDialog({
            wordId: TWO_LANG_WORD.id,
            langKey: 'DE',
            onClose: vi.fn(),
            nativeLanguage: 'German', // the language being added: no translation yet
            userLanguages: ['English', 'Spanish', 'German'],
        });

        await screen.findByLabelText('Singular nominative');
        expect(title()).toBe('house');
    });

    it('never shows the language name in the title (the flag names it)', async () => {
        server.use(...makeWordHandlers({ callerId: SESSION.id, seed: [TWO_LANG_WORD] }).handlers);
        renderDialog({ wordId: TWO_LANG_WORD.id, langKey: 'ES', onClose: vi.fn() });

        await screen.findByRole('button', { name: 'Edit' }); // read-only view is up (the word also appears in the title, so no text lookup)
        expect(title()).not.toMatch(/Español|Spanish|—/);
        // The language is still announced, through the flag.
        expect(within(screen.getByRole('dialog')).getByRole('img', { name: 'Español' })).toBeInTheDocument();
    });
});

describe('CellDialog — delete translation', () => {
    it('is hidden when the word has only 2 stored translations', async () => {
        server.use(...makeWordHandlers({ callerId: SESSION.id, seed: [TWO_LANG_WORD] }).handlers);
        renderDialog({ wordId: TWO_LANG_WORD.id, langKey: 'EN', onClose: vi.fn() });

        await screen.findByRole('button', { name: 'Edit' }); // read-only view is up (the word also appears in the title, so no text lookup)
        expect(screen.queryByRole('button', { name: 'Delete translation' })).not.toBeInTheDocument();
    });

    it('is shown at 3 translations, and confirming sends the set minus that language', async () => {
        const fake = makeWordHandlers({ callerId: SESSION.id, seed: [THREE_LANG_WORD] });
        server.use(...fake.handlers);
        const user = userEvent.setup();
        renderDialog({ wordId: THREE_LANG_WORD.id, langKey: 'DE', onClose: vi.fn() });

        // Available straight from the read-only display state (D41) — Delete
        // doesn't require entering edit mode first.
        await screen.findByRole('button', { name: 'Edit' }); // read-only view is up (the word also appears in the title, so no text lookup)
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
