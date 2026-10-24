import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { SenseResponse, SenseSuggestion } from '@/features/autocomplete/types';
import { makeStartFromWordHandlers } from '@/test/msw/startFromWordHandlers';
import { server } from '@/test/msw/server';
import { renderWithProviders } from '@/test/render';
import { futureToken } from '@/test/tokens';
import { mockMobileViewport } from '@/test/viewport';
import { StartFromWord } from './StartFromWord';

const SESSION = {
    id: 'u1', name: 'Kai Rebane', email: 'kai@example.com', username: 'kai',
    languages: ['English', 'Spanish', 'German'], uiLanguage: 'Spanish', nativeLanguage: null, verified: true, token: futureToken(),
};

const BANK_MONEY: SenseSuggestion = {
    word: 'banco', partOfSpeech: 'Noun', gender: 'el', english: 'bank', sense: 'financial institution',
    key: { englishLemma: 'bank', entryOrder: 0, senseOrder: 0 },
    languages: ['English', 'Spanish', 'German', 'Estonian'],
};
const BANK_SEAT: SenseSuggestion = {
    word: 'banco', partOfSpeech: 'Noun', gender: 'el', english: 'bench', sense: 'seat',
    key: { englishLemma: 'bench', entryOrder: 0, senseOrder: 0 },
    languages: ['English', 'Spanish'],
};
const BANK_VERB: SenseSuggestion = {
    word: 'bancar', partOfSpeech: 'Verb', english: 'bank', sense: 'to deposit',
    key: { englishLemma: 'bank', entryOrder: 1, senseOrder: 0 },
    languages: ['English', 'Spanish', 'Estonian'],
};

const BANK_SENSE: SenseResponse = {
    sense: {
        english: 'bank', sense: 'financial institution',
        words: {
            English: [{ word: 'bank' }],
            Spanish: [{ word: 'banca', gender: 'la' }, { word: 'banco', gender: 'el' }],
            German: [{ word: 'Bank', gender: 'die' }, { word: 'Geldinstitut', gender: 'das' }],
            Estonian: [],
        },
    },
};

function setup(options: Parameters<typeof makeStartFromWordHandlers>[0] = {}) {
    const fake = makeStartFromWordHandlers({
        suggestions: { Spanish: [BANK_MONEY, BANK_SEAT, BANK_VERB] },
        senses: { 'bank|0|0': BANK_SENSE },
        ...options,
    });
    server.use(...fake.handlers);
    const onDraft = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
        <StartFromWord onDraft={onDraft} header={<h1>New word</h1>}>
            <p>the part-of-speech list</p>
        </StartFromWord>,
        { session: SESSION },
    );
    return { fake, onDraft, user };
}

async function typeAndPick(user: ReturnType<typeof userEvent.setup>, text: string, option: RegExp) {
    await user.type(screen.getByTestId('start-word-input'), text);
    await user.click(await screen.findByRole('option', { name: option }));
}

const card = (language: string) => screen.getByTestId(`preview-card-${language}`);
const expand = (language: string) => within(card(language)).getByRole('button', { name: 'Expand translation' });

describe('StartFromWord — the section', () => {
    it('starts in the UI language, shows flag and two-letter code, offers only the account languages, and has no visible labels', async () => {
        const { user } = setup();
        expect(screen.getByTestId('start-language')).toHaveTextContent('ES');
        expect(screen.getByTestId('start-pos')).toHaveTextContent('Any type');
        expect(screen.queryByText('Language of the word')).not.toBeInTheDocument();
        expect(screen.queryByText('Part of speech')).not.toBeInTheDocument();
        expect(screen.getByText('the part-of-speech list')).toBeInTheDocument();
        expect(screen.getByText('or create manually')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'New word' })).toBeInTheDocument();

        await user.click(screen.getByTestId('start-language'));
        await screen.findAllByRole('option');
        expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['EN', 'ES', 'DE']); // no Estonian: not on the account
    });

    it('remembers the last chosen language for the next visit', async () => {
        const first = setup();
        await first.user.click(screen.getByTestId('start-language'));
        await first.user.click(await screen.findByRole('option', { name: 'DE' }));
        expect(screen.getByTestId('start-language')).toHaveTextContent('DE');
        cleanup();

        setup();
        expect(screen.getByTestId('start-language')).toHaveTextContent('DE');
    });

    it('does not use a remembered language that is not on the account', () => {
        localStorage.setItem('ladu.startFromWord.language', 'Estonian');
        setup();
        expect(screen.getByTestId('start-language')).toHaveTextContent('ES'); // the UI language
    });

    it('does not use a remembered value that is not a language', () => {
        localStorage.setItem('ladu.startFromWord.language', 'not a language');
        setup();
        expect(screen.getByTestId('start-language')).toHaveTextContent('ES');
    });

    it('the heading has the sparkle icon in an accent-coloured left column, and the title and hint in the right one', () => {
        setup();
        const icon = screen.getByTestId('start-icon');
        expect(icon).toHaveClass('text-(--accent)', 'size-8');
        expect(icon.querySelector('svg')).not.toBeNull();
        const textColumn = screen.getByRole('heading', { name: 'Start from a word' }).parentElement as HTMLElement;
        expect(textColumn).toHaveTextContent('Type a word in any language.');
        expect(icon.nextElementSibling).toBe(textColumn);
    });

    it('takes half the row on a desktop, aligned left', () => {
        setup();
        expect(screen.getByTestId('start-from-word')).toHaveClass('w-1/2');
    });

    it('on a phone: the full row, two selects sharing a line, the word underneath, and the full language names', async () => {
        mockMobileViewport();
        const { user } = setup();
        const section = screen.getByTestId('start-from-word');
        expect(section).not.toHaveClass('w-1/2');
        expect(screen.getByTestId('start-language')).toHaveTextContent('Español');
        const controls = screen.getByTestId('start-language').parentElement as HTMLElement;
        expect(controls).toHaveClass('grid-cols-2');
        expect(within(controls).getByTestId('start-word-input').parentElement).toHaveClass('col-span-2');

        await user.click(screen.getByTestId('start-language'));
        await screen.findAllByRole('option');
        expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['English', 'Español', 'Deutsch']);
    });

    it('the placeholder follows the two selects', async () => {
        const { user } = setup();
        const input = screen.getByTestId('start-word-input');
        expect(input).toHaveAttribute('placeholder', 'Type a word in Spanish');

        await user.click(screen.getByTestId('start-pos'));
        await user.click(await screen.findByRole('option', { name: 'Verb' }));
        expect(input).toHaveAttribute('placeholder', 'Type the verb in Spanish');

        await user.click(screen.getByTestId('start-language'));
        await user.click(await screen.findByRole('option', { name: 'DE' }));
        expect(input).toHaveAttribute('placeholder', 'Type the verb in German');

        await user.click(screen.getByTestId('start-pos'));
        await user.click(await screen.findByRole('option', { name: 'Any type' }));
        expect(input).toHaveAttribute('placeholder', 'Type a word in German');
    });

    it('lists the senses of the typed word in the chosen language, grouped by part of speech with a separator while "Any type"', async () => {
        const { user, fake } = setup();
        await user.type(screen.getByTestId('start-word-input'), 'ban');

        const list = await screen.findByTestId('sense-list');
        const options = within(list).getAllByRole('option');
        expect(options).toHaveLength(3);
        expect(options[0]).toHaveTextContent('el banco');
        expect(options[0]).toHaveTextContent('bank — financial institution');
        expect(options[2]).toHaveTextContent('bancar');
        // One heading per group, and one separator between the two groups; no label on the lines themselves.
        expect(within(list).getByRole('group', { name: 'Noun' })).toHaveTextContent('el banco');
        expect(within(list).getByRole('group', { name: 'Verb' })).toHaveTextContent('bancar');
        expect(list.querySelectorAll('.h-px')).toHaveLength(1); // the separator is decorative: no role to query
        expect(options[0]).not.toHaveTextContent('Noun');
        expect(fake.suggestionRequests.at(-1)).toEqual({ language: 'Spanish', prefix: 'ban', partOfSpeech: 'Any' });
    });

    it('each line shows the flags of the other account languages the sense covers; the start language and Estonian (not on the account) are left out', async () => {
        const { user } = setup();
        await user.type(screen.getByTestId('start-word-input'), 'ban');
        await screen.findAllByRole('option');
        const flags = (index: number) =>
            Array.from(screen.getAllByRole('option')[index].querySelectorAll('[data-testid="sense-languages"] img')).map((img) => img.getAttribute('src'));
        expect(flags(0)).toEqual(['/GB.svg', '/DE.svg']); // bank / financial institution: EN, ES (start), DE, EE (not on the account)
        expect(flags(1)).toEqual(['/GB.svg']); // bench / seat
        expect(screen.getAllByRole('option')[0].querySelector('[data-testid="sense-languages"] img')).toHaveClass('opacity-80', 'saturate-75'); // toned down
        expect(screen.queryByText(/^\+\d/)).not.toBeInTheDocument();
    });

    it('a chosen part of speech limits the list and shows no group headings', async () => {
        const { user, fake } = setup();
        await user.click(screen.getByTestId('start-pos'));
        await user.click(await screen.findByRole('option', { name: 'Verb' }));
        await user.type(screen.getByTestId('start-word-input'), 'ban');

        const options = await screen.findAllByRole('option');
        expect(options).toHaveLength(1);
        expect(options[0]).toHaveTextContent('bancar');
        const list = screen.getByTestId('sense-list');
        expect(list.querySelectorAll('.h-px')).toHaveLength(0);
        expect(within(list).queryByRole('group')).not.toBeInTheDocument();
        expect(fake.suggestionRequests.at(-1)?.partOfSpeech).toBe('Verb');
    });

    it('sends the typed language to the server: German is searched when German is chosen', async () => {
        const { user, fake } = setup({ suggestions: { German: [{ ...BANK_MONEY, word: 'Bank', gender: 'die' }] } });
        await user.click(screen.getByTestId('start-language'));
        await user.click(await screen.findByRole('option', { name: 'DE' }));
        await user.type(screen.getByTestId('start-word-input'), 'Ba');

        expect(await screen.findByRole('option', { name: /Bank/ })).toBeInTheDocument();
        expect(fake.suggestionRequests.at(-1)?.language).toBe('German');
    });
});

describe('StartFromWord — the preview', () => {
    it('a pick replaces the page title and the list with its own title; the cards are collapsed, in the start language first', async () => {
        const { user, fake } = setup();
        await typeAndPick(user, 'ban', /el banco.*financial/);

        const preview = await screen.findByTestId('sense-preview');
        expect(screen.getByRole('heading', { level: 1, name: 'Choose the words to use' })).toBeInTheDocument();
        expect(screen.queryByRole('heading', { name: 'New word' })).not.toBeInTheDocument();
        expect(screen.queryByText('the part-of-speech list')).not.toBeInTheDocument();
        expect(screen.queryByTestId('start-from-word')).not.toBeInTheDocument();
        expect(fake.senseRequests.at(-1)).toEqual({ partOfSpeech: 'Noun', key: 'bank|0|0', languages: ['Spanish', 'English', 'German'] });

        // Two-column grid like the noun cards; account languages only (no Estonian); start language first.
        expect(within(preview).getAllByRole('group').map((group) => group.getAttribute('data-testid'))).toEqual([
            'preview-card-Spanish', 'preview-card-English', 'preview-card-German',
        ]);
        expect(preview.querySelector('.grid')).toHaveClass('sm:grid-cols-2');
        // Collapsed: the header shows the preselected word and how many other options there are.
        expect(card('Spanish')).toHaveTextContent('el banco');
        expect(card('Spanish')).toHaveTextContent('1 other option');
        expect(card('German')).toHaveTextContent('die Bank');
        expect(card('English')).toHaveTextContent('bank');
        expect(card('English')).toHaveTextContent('No other options');
        expect(within(card('Spanish')).queryByRole('radio')).not.toBeInTheDocument();
    });

    it('the back arrow returns to the start section, with the page title and the typed word', async () => {
        const { user } = setup();
        await typeAndPick(user, 'ban', /el banco.*financial/);
        await screen.findByTestId('sense-preview');
        await user.click(screen.getByRole('button', { name: 'Back' }));

        expect(screen.getByTestId('start-from-word')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'New word' })).toBeInTheDocument();
        expect(screen.getByTestId('start-word-input')).toHaveValue('banco');
    });

    it('expanding a card lists its words and "No translation"; choosing another word changes the header', async () => {
        const { user } = setup();
        await typeAndPick(user, 'ban', /el banco.*financial/);
        await screen.findByTestId('sense-preview');
        await user.click(expand('Spanish'));

        const spanish = within(card('Spanish'));
        expect(spanish.getByRole('radio', { name: 'el banco' })).toBeChecked();
        expect(spanish.getByRole('radio', { name: 'No translation' })).not.toBeChecked();
        await user.click(spanish.getByRole('radio', { name: 'la banca' }));
        expect(card('Spanish')).toHaveTextContent('la banca');
        await user.click(within(card('Spanish')).getByRole('button', { name: 'Collapse translation' }));
        expect(within(card('Spanish')).queryByRole('radio')).not.toBeInTheDocument();
    });

    it('"Create draft" sends the chosen word of each card, leaves out a card set to "No translation", and hands the answer up', async () => {
        const { user, fake, onDraft } = setup({
            drafts: { 'Spanish|banca': { status: 'partial', cases: [{ caseName: 'singularES', word: 'banca' }] } },
        });
        await typeAndPick(user, 'ban', /el banco.*financial/);
        await screen.findByTestId('sense-preview');
        await user.click(expand('Spanish'));
        await user.click(within(card('Spanish')).getByRole('radio', { name: 'la banca' }));
        await user.click(expand('English'));
        await user.click(within(card('English')).getByRole('radio', { name: 'No translation' }));
        expect(card('English')).toHaveTextContent('No translation');
        expect(card('English')).toHaveTextContent('1 option available');
        await user.click(screen.getByRole('button', { name: 'Create draft' }));

        await waitFor(() => expect(onDraft).toHaveBeenCalledTimes(1));
        expect(fake.draftRequests).toEqual([
            { partOfSpeech: 'Noun', picks: [{ language: 'Spanish', word: 'banca', gender: 'la' }, { language: 'German', word: 'Bank', gender: 'die' }] },
        ]);
        expect(onDraft.mock.calls[0][0]).toMatchObject({
            partOfSpeech: 'Noun',
            translations: [
                { language: 'Spanish', word: 'banca', status: 'partial' },
                { language: 'German', word: 'Bank', status: 'found' },
            ],
        });
    });

    it('one card is enough; with every card on "No translation" the button is off', async () => {
        const { user } = setup();
        await typeAndPick(user, 'ban', /el banco.*financial/);
        await screen.findByTestId('sense-preview');
        for (const language of ['English', 'German']) {
            await user.click(expand(language));
            await user.click(within(card(language)).getByRole('radio', { name: 'No translation' }));
        }
        expect(screen.getByRole('button', { name: 'Create draft' })).toBeEnabled();

        await user.click(expand('Spanish'));
        await user.click(within(card('Spanish')).getByRole('radio', { name: 'No translation' }));
        expect(screen.getByRole('button', { name: 'Create draft' })).toBeDisabled();
        expect(screen.getByText('Choose a word for at least one language.')).toBeInTheDocument();
    });

    it('a language with no word says so, has "No translation" in its header and cannot be expanded', async () => {
        const { user } = setup({
            senses: { 'bank|0|0': { sense: { ...BANK_SENSE.sense, words: { ...BANK_SENSE.sense.words, German: [] } } } },
        });
        await typeAndPick(user, 'ban', /el banco.*financial/);
        await screen.findByTestId('sense-preview');
        expect(card('German')).toHaveTextContent('No translation');
        expect(card('German')).toHaveTextContent('No word found');
        expect(expand('German')).toBeDisabled();
        expect(expand('Spanish')).toBeEnabled();
    });

    it('Estonian (on the account) with no word in the table shows the Ekilex word, marked', async () => {
        const fake = makeStartFromWordHandlers({
            suggestions: { Spanish: [BANK_MONEY] },
            senses: { 'bank|0|0': { ...BANK_SENSE, ekilex: { estonian: [{ word: 'pank' }] } } },
        });
        server.use(...fake.handlers);
        const user = userEvent.setup();
        renderWithProviders(<StartFromWord onDraft={vi.fn()} />, { session: { ...SESSION, languages: ['English', 'Spanish', 'Estonian'] } });
        await typeAndPick(user, 'ban', /el banco/);

        await screen.findByTestId('preview-card-Estonian');
        expect(card('Estonian')).toHaveTextContent('pank');
        expect(card('Estonian')).toHaveTextContent('from Ekilex');
    });

    it('Ekilex down: the Estonian card says the words are not available now', async () => {
        const fake = makeStartFromWordHandlers({
            suggestions: { Spanish: [BANK_MONEY] },
            senses: { 'bank|0|0': { ...BANK_SENSE, ekilex: { unavailable: true } } },
        });
        server.use(...fake.handlers);
        const user = userEvent.setup();
        renderWithProviders(<StartFromWord onDraft={vi.fn()} />, { session: { ...SESSION, languages: ['Spanish', 'Estonian'] } });
        await typeAndPick(user, 'ban', /el banco/);

        await screen.findByTestId('preview-card-Estonian');
        expect(card('Estonian')).toHaveTextContent('Estonian words are not available now.');
        expect(expand('Estonian')).toBeDisabled();
    });

    it('a failed draft shows an alert and keeps the preview', async () => {
        const { user, onDraft } = setup({ draftFailure: 500 });
        await typeAndPick(user, 'ban', /el banco.*financial/);
        await screen.findByTestId('sense-preview');
        await user.click(screen.getByRole('button', { name: 'Create draft' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('The draft could not be created');
        expect(onDraft).not.toHaveBeenCalled();
        expect(screen.getByTestId('sense-preview')).toBeInTheDocument();
    });

    it('a sense that cannot be loaded shows an alert', async () => {
        const { user } = setup({ senses: {} });
        await typeAndPick(user, 'ban', /el banco.*financial/);
        expect(await screen.findByRole('alert')).toHaveTextContent('The meaning could not be loaded');
    });
});
