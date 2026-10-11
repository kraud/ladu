import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';
import { renderApp } from '@/test/render';
import { server } from '@/test/msw/server';
import { makeWordHandlers } from '@/test/msw/wordHandlers';
import { makeStartFromWordHandlers } from '@/test/msw/startFromWordHandlers';
import { useAuthStore } from '@/stores/authStore';
import { futureToken } from '@/test/tokens';

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

afterEach(() => {
    useAuthStore.getState().clearSession();
});

async function fillEnEs(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: 'English' }));
    await user.click(screen.getByRole('button', { name: 'Español' }));

    const [singularEN, singularES] = screen.getAllByLabelText('Singular');
    await user.type(singularEN!, 'House');
    await user.type(singularES!, 'Casa');
    await user.click(screen.getByRole('radio', { name: 'el' }));
}

describe('AddWordPage', () => {
    it('shows "Start from a word" above the part-of-speech list; a draft opens the form with one filled card per language, ready to save', async () => {
        const fake = makeStartFromWordHandlers({
            suggestions: {
                English: [{ word: 'bank', partOfSpeech: 'Noun', english: 'bank', sense: 'financial institution', key: { englishLemma: 'bank', entryOrder: 0, senseOrder: 0 } }],
            },
            senses: {
                'bank|0|0': { sense: { english: 'bank', sense: 'financial institution', words: { English: [{ word: 'bank' }], Spanish: [{ word: 'banco', gender: 'el' }] } } },
            },
            drafts: {
                'English|bank': { status: 'found', cases: [
                    { caseName: 'regularityEN', word: 'regular' }, { caseName: 'singularEN', word: 'bank' }, { caseName: 'pluralEN', word: 'banks' },
                ] },
                'Spanish|banco': { status: 'found', cases: [
                    { caseName: 'genderES', word: 'el' }, { caseName: 'regularityES', word: 'regular' },
                    { caseName: 'singularES', word: 'banco' }, { caseName: 'pluralES', word: 'bancos' },
                ] },
            },
        });
        server.use(...makeWordHandlers({ callerId: SESSION.id }).handlers, ...fake.handlers);

        const user = userEvent.setup();
        await renderApp({ initialEntry: '/addWord', session: SESSION });

        // The section, the "or" line, then the part-of-speech list.
        expect(screen.getByTestId('start-from-word')).toBeInTheDocument();
        expect(screen.getByText('or create manually')).toBeInTheDocument();
        expect(screen.getByRole('radio', { name: /Verb/ })).toBeInTheDocument();

        await user.type(screen.getByTestId('start-word-input'), 'ban');
        await user.click(await screen.findByRole('option', { name: /bank/ }));
        await user.click(await screen.findByRole('button', { name: 'Create draft' }));

        // The form of the draft's part of speech, with both cards filled; the section is gone.
        expect(await screen.findByRole('heading', { name: 'New Noun' })).toBeInTheDocument();
        expect(screen.queryByTestId('start-from-word')).not.toBeInTheDocument();
        await waitFor(() => expect(screen.getAllByLabelText('Singular').map((input) => (input as HTMLInputElement).value)).toEqual(['bank', 'banco']));
        expect(screen.getAllByLabelText('Plural').map((input) => (input as HTMLInputElement).value)).toEqual(['banks', 'bancos']);
        expect(screen.getByRole('radio', { name: 'el' })).toBeChecked();

        // Two languages, all required fields filled: Save is on.
        await waitFor(() => expect(screen.getByRole('button', { name: 'Save word' })).toBeEnabled());
    });

    it('has a back arrow that returns to Words', async () => {
        server.use(...makeWordHandlers({ callerId: SESSION.id }).handlers);

        const user = userEvent.setup();
        const { router } = await renderApp({ initialEntry: '/addWord', session: SESSION });

        await user.click(screen.getByRole('link', { name: 'Back to Words' }));
        await waitFor(() => expect(router.state.location.pathname).toBe('/words'));
    });

    it('sends the back arrow to the type gate once a type is picked', async () => {
        server.use(...makeWordHandlers({ callerId: SESSION.id }).handlers);

        const user = userEvent.setup();
        const { router } = await renderApp({ initialEntry: '/addWord', session: SESSION });

        await user.click(screen.getByRole('radio', { name: /Noun/ }));
        expect(screen.getByRole('heading', { name: 'New Noun' })).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Back to word type' }));
        expect(screen.getByRole('heading', { name: 'New word' })).toBeInTheDocument();
        expect(router.state.location.pathname).toBe('/addWord');
    });

    it('creates a noun, morphs the toast into success, and navigates on "See details"', async () => {
        const fake = makeWordHandlers({ callerId: SESSION.id });
        server.use(...fake.handlers);

        const user = userEvent.setup();
        const { router } = await renderApp({ initialEntry: '/addWord', session: SESSION });

        // D37: one heading pair before a PoS is picked.
        expect(screen.getByRole('heading', { name: 'New word' })).toBeInTheDocument();
        expect(screen.queryByText('What kind of word is it?')).not.toBeInTheDocument();
        await user.click(screen.getByRole('radio', { name: /Noun/ }));

        // D38: the title tracks the picked type. No subtitle, like Tags and Review.
        expect(await screen.findByRole('heading', { name: 'New Noun' })).toBeInTheDocument();
        expect(screen.queryByText('All the required fields must be completed before saving')).not.toBeInTheDocument();

        await fillEnEs(user);
        await waitFor(() => expect(screen.getByRole('button', { name: 'Save word' })).toBeEnabled());
        await user.click(screen.getByRole('button', { name: 'Save word' }));

        expect(await screen.findByText('Word was created successfully')).toBeInTheDocument();
        expect(fake.requests).toHaveLength(1);
        expect(fake.requests[0]?.body).toEqual({
            partOfSpeech: 'Noun',
            clue: undefined,
            translations: [
                { language: 'English', cases: [{ caseName: 'singularEN', word: 'house' }] },
                {
                    language: 'Spanish',
                    cases: [
                        { caseName: 'genderES', word: 'el' },
                        { caseName: 'singularES', word: 'casa' },
                    ],
                },
            ],
        });

        // The form reset and the PoS gate is back — still on /addWord.
        expect(router.state.location.pathname).toBe('/addWord');
        expect(await screen.findByRole('heading', { name: 'New word' })).toBeInTheDocument();
        expect(screen.queryByText('What kind of word is it?')).not.toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Click here to see the new word' }));
        const createdId = fake.store.values().next().value?.id;
        await waitFor(() => expect(router.state.location.pathname).toBe(`/word/${createdId}`));
    });

    it('skips the PoS gate when the route carries a part-of-speech param', async () => {
        server.use(...makeWordHandlers({ callerId: SESSION.id }).handlers);
        await renderApp({ initialEntry: '/addWord/noun', session: SESSION });

        expect(screen.queryByText('What kind of word is it?')).not.toBeInTheDocument();
        expect(await screen.findByRole('heading', { name: 'New Noun' })).toBeInTheDocument();
        expect(screen.queryByText('All the required fields must be completed before saving')).not.toBeInTheDocument();
    });

    it('Change word type returns to the gate and resets the title', async () => {
        server.use(...makeWordHandlers({ callerId: SESSION.id }).handlers);
        const user = userEvent.setup();
        await renderApp({ initialEntry: '/addWord/noun', session: SESSION });

        expect(await screen.findByRole('heading', { name: 'New Noun' })).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Change word type' }));

        expect(screen.getByRole('heading', { name: 'New word' })).toBeInTheDocument();
        expect(screen.queryByText('What kind of word is it?')).not.toBeInTheDocument();
    });

    it('shows the generic error toast for an unmapped backend failure and preserves form state', async () => {
        server.use(
            http.post('*/api/words', () => HttpResponse.json({ message: 'boom' }, { status: 500 })),
        );

        const user = userEvent.setup();
        await renderApp({ initialEntry: '/addWord/noun', session: SESSION });

        await fillEnEs(user);
        await waitFor(() => expect(screen.getByRole('button', { name: 'Save word' })).toBeEnabled());
        await user.click(screen.getByRole('button', { name: 'Save word' }));

        expect(await screen.findByText('Something went wrong, try again.')).toBeInTheDocument();
        // Nothing was reset — the filled fields are still there (lowercasing
        // only happens to the persisted case value on push-up, not the input).
        expect(screen.getAllByLabelText('Singular')[0]).toHaveValue('House');
    });
});
