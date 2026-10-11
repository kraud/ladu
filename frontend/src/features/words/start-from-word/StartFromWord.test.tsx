import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { SenseResponse, SenseSuggestion } from '@/features/autocomplete/types';
import { makeStartFromWordHandlers } from '@/test/msw/startFromWordHandlers';
import { server } from '@/test/msw/server';
import { renderWithProviders } from '@/test/render';
import { futureToken } from '@/test/tokens';
import { StartFromWord } from './StartFromWord';

const SESSION = {
    id: 'u1', name: 'Kai Rebane', email: 'kai@example.com', username: 'kai',
    languages: ['English', 'Spanish', 'German'], uiLanguage: 'Spanish', nativeLanguage: null, verified: true, token: futureToken(),
};

const BANK_MONEY: SenseSuggestion = {
    word: 'banco', partOfSpeech: 'Noun', gender: 'el', english: 'bank', sense: 'financial institution',
    key: { englishLemma: 'bank', entryOrder: 0, senseOrder: 0 },
};
const BANK_RIVER: SenseSuggestion = {
    word: 'banco', partOfSpeech: 'Noun', gender: 'el', english: 'bench', sense: 'seat',
    key: { englishLemma: 'bench', entryOrder: 0, senseOrder: 0 },
};
const BANK_VERB: SenseSuggestion = {
    word: 'bancar', partOfSpeech: 'Verb', english: 'bank', sense: 'to deposit',
    key: { englishLemma: 'bank', entryOrder: 1, senseOrder: 0 },
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
        suggestions: { Spanish: [BANK_MONEY, BANK_RIVER, BANK_VERB] },
        senses: { 'bank|0|0': BANK_SENSE },
        ...options,
    });
    server.use(...fake.handlers);
    const onDraft = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
        <StartFromWord onDraft={onDraft}>
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

describe('StartFromWord', () => {
    it('starts in the UI language, offers only the account languages, and shows the part-of-speech list under "or"', async () => {
        const { user } = setup();
        expect(screen.getByTestId('start-language')).toHaveTextContent('Español');
        expect(screen.getByTestId('start-pos')).toHaveTextContent('Any');
        expect(screen.getByText('the part-of-speech list')).toBeInTheDocument();
        expect(screen.getByText('or')).toBeInTheDocument();

        await user.click(screen.getByTestId('start-language'));
        await screen.findAllByRole('option');
        const names = screen.getAllByRole('option').map((option) => option.textContent);
        expect(names).toEqual(['English', 'Español', 'Deutsch']); // no Estonian: not on the account
    });

    it('lists the senses of the typed word in the chosen language, with the part of speech while "Any"', async () => {
        const { user, fake } = setup();
        await user.type(screen.getByTestId('start-word-input'), 'ban');

        const list = await screen.findByTestId('sense-list');
        const options = within(list).getAllByRole('option');
        expect(options).toHaveLength(3);
        expect(options[0]).toHaveTextContent('el banco');
        expect(options[0]).toHaveTextContent('Noun');
        expect(options[0]).toHaveTextContent('bank — financial institution');
        expect(options[2]).toHaveTextContent('bancar');
        expect(options[2]).toHaveTextContent('Verb');
        expect(fake.suggestionRequests.at(-1)).toEqual({ language: 'Spanish', prefix: 'ban', partOfSpeech: 'Any' });
    });

    it('a chosen part of speech limits the list and leaves the label out', async () => {
        const { user, fake } = setup();
        await user.click(screen.getByTestId('start-pos'));
        await user.click(await screen.findByRole('option', { name: 'Verb' }));
        await user.type(screen.getByTestId('start-word-input'), 'ban');

        const options = await screen.findAllByRole('option');
        expect(options).toHaveLength(1);
        expect(options[0]).toHaveTextContent('bancar');
        expect(options[0]).not.toHaveTextContent('Verb');
        expect(fake.suggestionRequests.at(-1)?.partOfSpeech).toBe('Verb');
    });

    it('sends the typed language to the server: German is searched when German is chosen', async () => {
        const { user, fake } = setup({ suggestions: { German: [{ ...BANK_MONEY, word: 'Bank', gender: 'die' }] } });
        await user.click(screen.getByTestId('start-language'));
        await user.click(await screen.findByRole('option', { name: 'Deutsch' }));
        await user.type(screen.getByTestId('start-word-input'), 'Ba');

        expect(await screen.findByRole('option', { name: /Bank/ })).toBeInTheDocument();
        expect(fake.suggestionRequests.at(-1)?.language).toBe('German');
    });

    it('a pick opens the preview: only account languages, start word selected, rows with a word are on', async () => {
        const { user, fake } = setup();
        await typeAndPick(user, 'ban', /el banco.*financial/);

        const preview = await screen.findByTestId('sense-preview');
        expect(screen.queryByText('the part-of-speech list')).not.toBeInTheDocument();
        expect(fake.senseRequests.at(-1)).toEqual({ partOfSpeech: 'Noun', key: 'bank|0|0', languages: ['Spanish', 'English', 'German'] });

        // Start language first, then the other account languages. Estonian is not on the account.
        const rows = within(preview).getAllByRole('listitem').map((row) => row.getAttribute('data-testid'));
        expect(rows).toEqual(['preview-row-Spanish', 'preview-row-English', 'preview-row-German']);
        expect(within(screen.getByTestId('preview-row-Spanish')).getByRole('radio', { name: 'el banco' })).toBeChecked();
        expect(within(screen.getByTestId('preview-row-German')).getByRole('radio', { name: 'die Bank' })).toBeChecked();
        expect(screen.getByRole('checkbox', { name: 'Use Español' })).toBeChecked();
        expect(screen.getByRole('checkbox', { name: 'Use English' })).toBeChecked();
    });

    it('"Create draft" sends the chosen word of each language that is on, with its gender, and hands the answer up', async () => {
        const { user, fake, onDraft } = setup({
            drafts: { 'Spanish|banca': { status: 'partial', cases: [{ caseName: 'singularES', word: 'banca' }] } },
        });
        await typeAndPick(user, 'ban', /el banco.*financial/);
        const spanish = await screen.findByTestId('preview-row-Spanish');
        await user.click(within(spanish).getByRole('radio', { name: 'la banca' }));
        await user.click(screen.getByRole('checkbox', { name: 'Use English' })); // off
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

    it('one language is enough; none switches the button off', async () => {
        const { user } = setup();
        await typeAndPick(user, 'ban', /el banco.*financial/);
        await screen.findByTestId('sense-preview');
        await user.click(screen.getByRole('checkbox', { name: 'Use English' }));
        await user.click(screen.getByRole('checkbox', { name: 'Use Deutsch' }));
        expect(screen.getByRole('button', { name: 'Create draft' })).toBeEnabled();

        await user.click(screen.getByRole('checkbox', { name: 'Use Español' }));
        expect(screen.getByRole('button', { name: 'Create draft' })).toBeDisabled();
        expect(screen.getByText('Select at least one language.')).toBeInTheDocument();
    });

    it('a language with no word says so and cannot be switched on', async () => {
        const { user } = setup({
            senses: { 'bank|0|0': { sense: { ...BANK_SENSE.sense, words: { ...BANK_SENSE.sense.words, German: [] } } } },
        });
        await typeAndPick(user, 'ban', /el banco.*financial/);
        const german = await screen.findByTestId('preview-row-German');
        expect(within(german).getByText('No word found')).toBeInTheDocument();
        expect(within(german).getByRole('checkbox')).toHaveAttribute('aria-disabled', 'true');
    });

    it('Estonian (on the account) with no word in the table shows the Ekilex words, marked; or says they are unavailable', async () => {
        const withEstonian = { ...SESSION, languages: ['English', 'Spanish', 'Estonian'] };
        const fake = makeStartFromWordHandlers({
            suggestions: { Spanish: [BANK_MONEY] },
            senses: { 'bank|0|0': { ...BANK_SENSE, ekilex: { estonian: [{ word: 'pank' }] } } },
        });
        server.use(...fake.handlers);
        const user = userEvent.setup();
        renderWithProviders(<StartFromWord onDraft={vi.fn()} />, { session: withEstonian });
        await typeAndPick(user, 'ban', /el banco/);

        const estonian = await screen.findByTestId('preview-row-Estonian');
        expect(within(estonian).getByText('from Ekilex')).toBeInTheDocument();
        expect(within(estonian).getByText('pank')).toBeInTheDocument();
        expect(within(estonian).getByRole('checkbox')).toBeChecked();
    });

    it('Ekilex down: the Estonian row says the words are not available now', async () => {
        const fake = makeStartFromWordHandlers({
            suggestions: { Spanish: [BANK_MONEY] },
            senses: { 'bank|0|0': { ...BANK_SENSE, ekilex: { unavailable: true } } },
        });
        server.use(...fake.handlers);
        const user = userEvent.setup();
        renderWithProviders(<StartFromWord onDraft={vi.fn()} />, { session: { ...SESSION, languages: ['Spanish', 'Estonian'] } });
        await typeAndPick(user, 'ban', /el banco/);

        expect(await screen.findByText('Estonian words are not available now.')).toBeInTheDocument();
    });

    it('a failed draft shows an alert and keeps the preview; Back returns to the list', async () => {
        const { user, onDraft } = setup({ draftFailure: 500 });
        await typeAndPick(user, 'ban', /el banco.*financial/);
        await screen.findByTestId('sense-preview');
        await user.click(screen.getByRole('button', { name: 'Create draft' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('The draft could not be created');
        expect(onDraft).not.toHaveBeenCalled();

        await user.click(screen.getByRole('button', { name: 'Back' }));
        expect(screen.getByTestId('start-from-word')).toBeInTheDocument();
        expect(screen.getByTestId('start-word-input')).toHaveValue('banco');
    });

    it('a sense that cannot be loaded shows an alert', async () => {
        const { user } = setup({ senses: {} });
        await typeAndPick(user, 'ban', /el banco.*financial/);
        expect(await screen.findByRole('alert')).toHaveTextContent('The meaning could not be loaded');
    });
});
