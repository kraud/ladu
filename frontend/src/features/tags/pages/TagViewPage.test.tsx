import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderApp } from '@/test/render';
import { server } from '@/test/msw/server';
import { makeTagHandlers, type SeedTag } from '@/test/msw/tagHandlers';
import { makeWordHandlers, type SeedWord } from '@/test/msw/wordHandlers';
import { futureToken } from '@/test/tokens';
import { PartOfSpeech, Lang } from '@/ts/enums';

const ME = 'user-me';
const OTHER = 'user-other';

const SESSION = {
    id: ME,
    name: 'Kai Rebane',
    email: 'kai@example.com',
    username: 'kai',
    languages: ['English'],
    uiLanguage: 'English',
    nativeLanguage: null,
    verified: true,
    token: futureToken(),
};

function verbSeed(label: string, id: string, tagId?: string): SeedWord {
    return {
        id,
        user: ME,
        partOfSpeech: PartOfSpeech.verb,
        translations: [{ language: Lang.EN, cases: [{ caseName: 'simplePresent1sEN', word: label }] }],
        tags: tagId ? [{ id: tagId, label: 'Kitchen', visibility: 'Private', authorId: ME }] : [],
    };
}

function setUp(
    seedTags: SeedTag[] = [],
    seedWords: SeedWord[] = [],
    authorBadges: Record<string, string[]> = {},
    followedWordIds: string[] = [],
) {
    const tagFake = makeTagHandlers({ callerId: ME, usernames: { [OTHER]: 'mari' }, seedTags, authorBadges });
    const wordFake = makeWordHandlers({ callerId: ME, seed: seedWords, followedWordIds });
    server.use(...tagFake.handlers, ...wordFake.handlers);
    return { tagFake, wordFake };
}

describe('TagViewPage — not found', () => {
    it('shows the not-found state for an unknown tag id, with a link back to /tags', async () => {
        setUp([]);
        await renderApp({ initialEntry: '/tag/does-not-exist', session: SESSION });

        expect(await screen.findByText("You can't see this tag")).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Return to Tags' })).toHaveAttribute('href', '/tags');
    });
});

describe('TagViewPage — owned tag', () => {
    it('shows the header, word count, and the tag\'s own words', async () => {
        setUp(
            [{ id: 'tag-1', authorId: ME, label: 'Kitchen', description: 'Pots and pans', visibility: 'Public', wordIds: ['w1'] }],
            [verbSeed('simmer', 'w1', 'tag-1')],
        );
        await renderApp({ initialEntry: '/tag/tag-1', session: SESSION });

        expect(await screen.findByText('Kitchen')).toBeInTheDocument();
        expect(screen.getByText('Pots and pans')).toBeInTheDocument();
        expect(screen.getByText('Yours')).toBeInTheDocument();
        expect(await screen.findByText('simmer')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Add words' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    });

    it("sorts the tag's words from a language header, through the server", async () => {
        const { wordFake } = setUp(
            [{ id: 'tag-1', authorId: ME, label: 'Kitchen', visibility: 'Public', wordIds: ['w1', 'w2'] }],
            [verbSeed('whisk', 'w1', 'tag-1'), verbSeed('bake', 'w2', 'tag-1')],
        );
        const user = userEvent.setup();
        await renderApp({ initialEntry: '/tag/tag-1', session: SESSION });

        await user.click(await screen.findByRole('button', { name: 'Sort EN from A to Z' }));

        await waitFor(() => expect(wordFake.simpleQueries.at(-1)).toContain('sort=EN&dir=asc'));
        const order = () => screen.getAllByRole('row').slice(1).map((row) => row.textContent?.match(/whisk|bake/)?.[0]);
        await waitFor(() => expect(order()).toEqual(['bake', 'whisk']));
    });

    it('Remove words shows the trash column and disables Add words; Cancel hides them again', async () => {
        setUp(
            [{ id: 'tag-1', authorId: ME, label: 'Kitchen', visibility: 'Public', wordIds: ['w1'] }],
            [verbSeed('simmer', 'w1', 'tag-1')],
        );
        const user = userEvent.setup();
        await renderApp({ initialEntry: '/tag/tag-1', session: SESSION });
        await screen.findByText('simmer');
        expect(screen.queryByRole('button', { name: 'Remove from tag' })).not.toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Remove words' }));
        expect(screen.getByRole('button', { name: 'Remove from tag' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Add words' })).toBeDisabled();

        await user.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(screen.queryByRole('button', { name: 'Remove from tag' })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Add words' })).toBeEnabled();
    });

    it('Edit opens the edit dialog directly and does not turn on remove mode', async () => {
        setUp([{ id: 'tag-1', authorId: ME, label: 'Kitchen', visibility: 'Public', wordIds: ['w1'] }], [verbSeed('simmer', 'w1', 'tag-1')]);
        const user = userEvent.setup();
        await renderApp({ initialEntry: '/tag/tag-1', session: SESSION });
        await screen.findByText('simmer');

        await user.click(screen.getByRole('button', { name: 'Edit' }));
        expect(screen.getByLabelText(/Label/)).toHaveValue('Kitchen');
        expect(screen.queryByRole('button', { name: 'Remove from tag' })).not.toBeInTheDocument();
    });

    it('shows a Cloned badge in the footer when the tag has provenance', async () => {
        setUp([
            {
                id: 'tag-1',
                authorId: ME,
                label: 'Kitchen',
                visibility: 'Public',
                sourceTag: { id: 'src-1', label: 'Original Kitchen' },
            },
        ]);
        await renderApp({ initialEntry: '/tag/tag-1', session: SESSION });

        const badge = await screen.findByText('Cloned');
        expect(badge).toHaveAttribute('title', 'Cloned from Original Kitchen');
        expect(badge.closest('.tagen-foot')).not.toBeNull();
    });

    it('editing the tag updates the header and shows a toast', async () => {
        setUp([{ id: 'tag-1', authorId: ME, label: 'Kitchen', visibility: 'Public' }]);
        const user = userEvent.setup();
        await renderApp({ initialEntry: '/tag/tag-1', session: SESSION });
        await screen.findByText('Kitchen');

        await user.click(screen.getByRole('button', { name: 'Edit' }));
        const labelInput = screen.getByLabelText(/Label/);
        await user.clear(labelInput);
        await user.type(labelInput, 'Cooking');
        await user.click(screen.getByRole('button', { name: 'Save changes' }));

        expect(await screen.findByText('"Cooking" updated')).toBeInTheDocument();
        expect(screen.getByText('Cooking')).toBeInTheDocument();
    });

    it('deleting the tag navigates back to /tags', async () => {
        setUp([{ id: 'tag-1', authorId: ME, label: 'Kitchen', visibility: 'Public' }]);
        const user = userEvent.setup();
        const { router } = await renderApp({ initialEntry: '/tag/tag-1', session: SESSION });
        await screen.findByText('Kitchen');

        await user.click(screen.getByRole('button', { name: 'Delete' }));
        expect(screen.getByText('Delete tag?')).toBeInTheDocument();
        await user.click(screen.getAllByRole('button', { name: 'Delete' }).at(-1)!);

        await waitFor(() => expect(router.state.location.pathname).toBe('/tags'));
    });

    // The tag fake (`makeTagHandlers`) and the word fake (`makeWordHandlers`)
    // are two independent stores with no cross-wiring — a `linkTagsToWords`/
    // `unlinkTagsFromWords` call updates the TAG's own `wordIds` set, not the
    // WORD's `tags` array the word fake filters `?tag=` by. So these two
    // tests assert on the request that actually reached the tag endpoint
    // (the real persistence round trip is the backend's own integration
    // tests' job), not on the table re-rendering afterward.
    it('adding words opens the picker, and saving sends the right link request', async () => {
        const { tagFake } = setUp(
            [{ id: 'tag-1', authorId: ME, label: 'Kitchen', visibility: 'Public' }],
            [verbSeed('simmer', 'w1')],
        );
        const user = userEvent.setup();
        await renderApp({ initialEntry: '/tag/tag-1', session: SESSION });
        await screen.findByText('Kitchen');
        expect(screen.getByText('Add your first words to this tag')).toBeInTheDocument();

        // Two "Add words" buttons exist here on purpose: the toolbar one and the
        // empty-state's own CTA, both wired to the same handler.
        await user.click(screen.getAllByRole('button', { name: 'Add words' })[0]);
        const row = (await screen.findByText('simmer')).closest('tr') as HTMLElement;
        await user.click(row);
        await user.click(screen.getByRole('button', { name: 'Add selected' }));

        expect(await screen.findByText('1 word added to "Kitchen"')).toBeInTheDocument();
        expect(tagFake.store.get('tag-1')?.wordIds.has('w1')).toBe(true);
    });

    it('removing a word from the tag shows a toast and unlinks it on the backend', async () => {
        const { tagFake } = setUp(
            [{ id: 'tag-1', authorId: ME, label: 'Kitchen', visibility: 'Public', wordIds: ['w1'] }],
            [verbSeed('simmer', 'w1', 'tag-1')],
        );
        const user = userEvent.setup();
        await renderApp({ initialEntry: '/tag/tag-1', session: SESSION });
        await screen.findByText('simmer');

        await user.click(screen.getByRole('button', { name: 'Remove words' }));
        await user.click(screen.getByRole('button', { name: 'Remove from tag' }));

        expect(await screen.findByText('"simmer" removed from "Kitchen" — it stays on your shelf')).toBeInTheDocument();
        expect(tagFake.store.get('tag-1')?.wordIds.has('w1')).toBe(false);
    });
});

describe('TagViewPage — followed tag', () => {
    it('shows Unfollow/Clone and the author row, and no owned actions', async () => {
        setUp([{ id: 'tag-1', authorId: OTHER, label: 'Travel', visibility: 'Public', followerIds: [ME] }]);
        await renderApp({ initialEntry: '/tag/tag-1', session: SESSION });

        expect(await screen.findByText('Followed')).toBeInTheDocument();
        expect(screen.getByText('mari').closest('.t-by')).toHaveTextContent(/^By\s*mari/);
        expect(screen.getByRole('button', { name: 'Unfollow' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Clone' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    });

    it('unfollowing asks for confirmation, then updates the relation to Discover', async () => {
        setUp([{ id: 'tag-1', authorId: OTHER, label: 'Travel', visibility: 'Public', followerIds: [ME] }]);
        const user = userEvent.setup();
        await renderApp({ initialEntry: '/tag/tag-1', session: SESSION });
        await screen.findByText('Followed');

        await user.click(screen.getByRole('button', { name: 'Unfollow' }));
        expect(screen.getByText('Unfollow tag?')).toBeInTheDocument();
        await user.click(screen.getAllByRole('button', { name: 'Unfollow' }).at(-1)!);

        expect(await screen.findByText('Unfollowed "Travel"')).toBeInTheDocument();
        await waitFor(() => expect(screen.getByText('Discover')).toBeInTheDocument());
    });
});

describe('TagViewPage — discover tag', () => {
    it('shows Follow/Clone; following it shows a toast and updates the relation', async () => {
        setUp([{ id: 'tag-1', authorId: OTHER, label: 'Travel', visibility: 'Public' }]);
        const user = userEvent.setup();
        await renderApp({ initialEntry: '/tag/tag-1', session: SESSION });

        expect(await screen.findByText('Discover')).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Follow' }));

        expect(await screen.findByText('You\'re now following "Travel"')).toBeInTheDocument();
        await waitFor(() => expect(screen.getByText('Followed')).toBeInTheDocument());
    });

    it('cloning opens the clone dialog and confirms', async () => {
        setUp([{ id: 'tag-1', authorId: OTHER, label: 'Travel', visibility: 'Public' }]);
        const user = userEvent.setup();
        await renderApp({ initialEntry: '/tag/tag-1', session: SESSION });
        await screen.findByText('Discover');

        await user.click(screen.getByRole('button', { name: 'Clone' }));
        expect(screen.getByText('Clone this tag')).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Create copy' }));

        expect(await screen.findByText('Copy of "Travel" created — it\'s all yours now')).toBeInTheDocument();
    });
});

describe('TagViewPage — a click on a row opens the word', () => {
    const otherWord = (): SeedWord => ({ ...verbSeed('wander', 'w9', 'tag-1'), user: OTHER });

    it('asks first; Open goes to the word page — also on a Public tag the user does not follow', async () => {
        setUp(
            [{ id: 'tag-1', authorId: OTHER, label: 'Travel', visibility: 'Public', wordIds: ['w9'] }],
            [otherWord()],
            {},
            ['w9'],
        );
        const user = userEvent.setup();
        const { router } = await renderApp({ initialEntry: '/tag/tag-1', session: SESSION });
        expect(await screen.findByText('Discover')).toBeInTheDocument();
        const row = (await screen.findByText('wander')).closest('tr')!;

        await user.click(row.querySelector('.owner-dot, .pos-abbr')!);
        expect(await screen.findByText('Open this word?')).toBeInTheDocument();
        expect(screen.getByText('Go to the page of "wander"?')).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Open' }));
        await waitFor(() => expect(router.state.location.pathname).toBe('/word/w9'));
    });

    it('Cancel stays on the tag page', async () => {
        setUp(
            [{ id: 'tag-1', authorId: ME, label: 'Kitchen', visibility: 'Public', wordIds: ['w1'] }],
            [verbSeed('simmer', 'w1', 'tag-1')],
        );
        const user = userEvent.setup();
        const { router } = await renderApp({ initialEntry: '/tag/tag-1', session: SESSION });
        const row = (await screen.findByText('simmer')).closest('tr')!;

        await user.click(row.querySelector('.owner-dot, .pos-abbr')!);
        await user.click(await screen.findByRole('button', { name: 'Cancel' }));

        expect(screen.queryByText('Open this word?')).not.toBeInTheDocument();
        expect(router.state.location.pathname).toBe('/tag/tag-1');
    });

    it('a click on a cell label opens the cell dialog, not the word — read-only for a word of someone else', async () => {
        setUp(
            [{ id: 'tag-1', authorId: OTHER, label: 'Travel', visibility: 'Public', wordIds: ['w9'] }],
            [otherWord()],
            {},
            ['w9'],
        );
        const user = userEvent.setup();
        await renderApp({ initialEntry: '/tag/tag-1', session: SESSION });

        await user.click(await screen.findByRole('button', { name: /wander/ }));

        const dialog = await screen.findByRole('dialog');
        await waitFor(() => expect(within(dialog).getAllByRole('button', { name: 'Close' }).length).toBeGreaterThan(1));
        expect(within(dialog).queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
        expect(screen.queryByText('Open this word?')).not.toBeInTheDocument();
    });

    it('in remove mode a click on a row does nothing', async () => {
        setUp(
            [{ id: 'tag-1', authorId: ME, label: 'Kitchen', visibility: 'Public', wordIds: ['w1'] }],
            [verbSeed('simmer', 'w1', 'tag-1')],
        );
        const user = userEvent.setup();
        await renderApp({ initialEntry: '/tag/tag-1', session: SESSION });
        const row = (await screen.findByText('simmer')).closest('tr')!;

        await user.click(screen.getByRole('button', { name: 'Remove words' }));
        await user.click(row.querySelector('.owner-dot, .pos-abbr')!);

        expect(screen.queryByText('Open this word?')).not.toBeInTheDocument();
    });
});

describe('TagViewPage — unavailable tag (D9)', () => {
    it('shows the words-hidden state instead of the table, and only Unfollow', async () => {
        setUp([
            { id: 'tag-1', authorId: OTHER, label: 'Travel', visibility: 'Private', followerIds: [ME] },
        ]);
        await renderApp({ initialEntry: '/tag/tag-1', session: SESSION });

        expect(await screen.findByText('Unavailable')).toBeInTheDocument();
        expect(screen.getByText('Words are hidden right now')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Unfollow' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Clone' })).not.toBeInTheDocument();
    });
});

describe('TagViewPage — author badge', () => {
    const theirTag: SeedTag = { id: 'tag-1', authorId: OTHER, label: 'Travel', visibility: 'Public' };

    it('shows the name in the accent style with the verified icon for a badged author', async () => {
        setUp([theirTag], [], { [OTHER]: ['official'] });
        await renderApp({ initialEntry: '/tag/tag-1', session: SESSION });

        const name = await screen.findByText('mari');
        expect(name).toHaveClass('t-by-verified');
        const icon = screen.getByRole('img', { name: 'Official Ladu account' });
        expect(name.closest('.t-by')).toContainElement(icon);
        expect(screen.queryByText('Official')).not.toBeInTheDocument();
    });

    it('shows a plain name and no icon for an author without a badge', async () => {
        setUp([theirTag]);
        await renderApp({ initialEntry: '/tag/tag-1', session: SESSION });

        expect(await screen.findByText('Travel')).toBeInTheDocument();
        expect(screen.getByText('mari')).not.toHaveClass('t-by-verified');
        expect(screen.queryByRole('img', { name: 'Official Ladu account' })).not.toBeInTheDocument();
    });
});

// A tag with 51 words: 50 on page 1 (newest first: word50 … word1), and `word0` alone on page 2.
const MANY = Array.from({ length: 51 }, (_, i) => i);
function manySetUp(extraWords: SeedWord[] = []) {
    return setUp(
        [{ id: 'tag-1', authorId: ME, label: 'Kitchen', visibility: 'Public', wordIds: MANY.map((i) => `w${i}`) }],
        [...MANY.map((i) => verbSeed(`word${i}`, `w${i}`, 'tag-1')), ...extraWords],
    );
}

describe('TagViewPage — numbered pages', () => {
    it('shows the first page, goes to page 2 with Next, and writes page=2 in the URL', async () => {
        const { wordFake } = manySetUp();
        const user = userEvent.setup();
        const { router } = await renderApp({ initialEntry: '/tag/tag-1', session: SESSION });

        await waitFor(() => expect(screen.getAllByRole('row')).toHaveLength(51)); // 50 words + header row
        expect(screen.getByTestId('pagination-range')).toHaveTextContent('Showing 1–50 of 51');
        expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Next page' }));

        expect(await screen.findByText('word0')).toBeInTheDocument();
        expect(screen.getAllByRole('row')).toHaveLength(2); // 1 word + header row
        expect(router.state.location.search).toMatchObject({ page: 2 });
        expect(wordFake.simpleQueries.at(-1)).toContain('page=2');
        expect(wordFake.simpleQueries.at(-1)).toContain('tag=tag-1');
    });

    it('opens the page that is in the URL, also under React StrictMode (dev)', async () => {
        manySetUp();
        const { router } = await renderApp({ initialEntry: '/tag/tag-1?page=2', session: SESSION, strictMode: true });

        expect(await screen.findByText('word0')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Page 2' })).toHaveAttribute('aria-current', 'page');
        expect(router.state.location.search).toMatchObject({ page: 2 });
    });

    it('goes to the last page when the page in the URL is past the end', async () => {
        manySetUp();
        const { router } = await renderApp({ initialEntry: '/tag/tag-1?page=9', session: SESSION });

        expect(await screen.findByText('word0')).toBeInTheDocument();
        await waitFor(() => expect(router.state.location.search).toMatchObject({ page: 2 }));
    });

    it('changes the page size, keeps it for next time and goes back to page 1', async () => {
        const { wordFake } = manySetUp();
        const user = userEvent.setup();
        const { router } = await renderApp({ initialEntry: '/tag/tag-1?page=2', session: SESSION });
        await screen.findByText('word0');

        await user.click(screen.getByRole('combobox', { name: 'Rows per page' }));
        await user.click(await screen.findByRole('option', { name: '100' }));

        await waitFor(() => expect(screen.getAllByRole('row')).toHaveLength(52)); // 51 words + header row
        expect(wordFake.simpleQueries.at(-1)).toContain('limit=100');
        expect(router.state.location.search).toMatchObject({ size: 100 });
        expect(router.state.location.search).not.toHaveProperty('page');
        expect(localStorage.getItem('ladu.pageSize')).toBe('100');
    });

    it('shows the whole tag for size=all, without page buttons', async () => {
        manySetUp();
        await renderApp({ initialEntry: '/tag/tag-1?size=all', session: SESSION });

        await waitFor(() => expect(screen.getAllByRole('row')).toHaveLength(52));
        expect(screen.queryByRole('navigation', { name: 'Pagination' })).not.toBeInTheDocument();
    });

    it('puts the sort in the URL and goes back to page 1', async () => {
        const { wordFake } = manySetUp();
        const user = userEvent.setup();
        const { router } = await renderApp({ initialEntry: '/tag/tag-1?page=2', session: SESSION });
        await screen.findByText('word0');

        await user.click(screen.getByRole('button', { name: 'Sort EN from A to Z' }));

        await waitFor(() => expect(router.state.location.search).toMatchObject({ sort: 'EN', dir: 'asc' }));
        expect(router.state.location.search).not.toHaveProperty('page');
        await waitFor(() => expect(wordFake.simpleQueries.at(-1)).toContain('sort=EN&dir=asc'));
    });

    it('reads the sort from the URL', async () => {
        const { wordFake } = manySetUp();
        await renderApp({ initialEntry: '/tag/tag-1?sort=EN&dir=desc', session: SESSION });

        expect(await screen.findByRole('button', { name: 'Sorted EN from Z to A. Remove the sort' })).toBeInTheDocument();
        expect(wordFake.simpleQueries.at(-1)).toContain('sort=EN&dir=desc');
    });
});

describe('TagViewPage — side menu', () => {
    it('offers only the parts of speech the tag holds (even one) and no Gender without nouns', async () => {
        setUp(
            [{ id: 'tag-1', authorId: ME, label: 'Kitchen', visibility: 'Public', wordIds: ['w1'], partsOfSpeech: ['Verb'] }],
            [verbSeed('simmer', 'w1', 'tag-1')],
        );
        await renderApp({ initialEntry: '/tag/tag-1', session: SESSION });
        await screen.findByText('simmer');

        const panel = screen.getByRole('complementary', { name: 'Filters' });
        const pos = within(panel).getByRole('heading', { name: 'Part of speech', level: 2 }).closest('section') as HTMLElement;
        expect(within(pos).getAllByRole('button', { name: /^(n|v|adj|adv)\.?$/i })).toHaveLength(1);
        expect(within(panel).queryByRole('heading', { name: 'Gender', level: 2 })).not.toBeInTheDocument();
        expect(within(panel).queryByRole('heading', { name: 'Tags' })).not.toBeInTheDocument();
    });

    it('offers Gender once the tag holds a noun', async () => {
        setUp(
            [{ id: 'tag-1', authorId: ME, label: 'Kitchen', visibility: 'Public', wordIds: ['w1'], partsOfSpeech: ['Noun', 'Verb'] }],
            [verbSeed('simmer', 'w1', 'tag-1')],
        );
        await renderApp({ initialEntry: '/tag/tag-1', session: SESSION });
        await screen.findByText('simmer');

        const panel = screen.getByRole('complementary', { name: 'Filters' });
        expect(within(panel).getByRole('heading', { name: 'Gender', level: 2 })).toBeInTheDocument();
    });

    it('puts the display options at the bottom: language order, badges and columns', async () => {
        setUp(
            [{ id: 'tag-1', authorId: ME, label: 'Kitchen', visibility: 'Public', wordIds: ['w1'], partsOfSpeech: ['Verb'] }],
            [verbSeed('simmer', 'w1', 'tag-1')],
        );
        await renderApp({ initialEntry: '/tag/tag-1', session: SESSION });
        await screen.findByText('simmer');

        const panel = screen.getByRole('complementary', { name: 'Filters' });
        const display = panel.querySelector('[data-section="display"]') as HTMLElement;
        for (const name of ['Language order', 'Badges', 'Columns']) {
            expect(within(display).getByRole('heading', { name })).toBeInTheDocument();
        }
        expect(within(display).getByRole('switch', { name: 'Progress' })).toBeInTheDocument();
        expect(within(display).getByRole('switch', { name: 'Owner' })).toBeInTheDocument();
    });

    it('a part-of-speech pick filters through the server and is written to the URL', async () => {
        const { wordFake } = setUp(
            [{ id: 'tag-1', authorId: ME, label: 'Kitchen', visibility: 'Public', wordIds: ['w1'], partsOfSpeech: ['Verb'] }],
            [verbSeed('simmer', 'w1', 'tag-1')],
        );
        const user = userEvent.setup();
        const { router } = await renderApp({ initialEntry: '/tag/tag-1', session: SESSION });
        await screen.findByText('simmer');

        await user.click(screen.getByRole('button', { name: 'v.' }));

        await waitFor(() => expect(router.state.location.search).toMatchObject({ pos: ['Verb'] }));
        await waitFor(() => expect(wordFake.simpleQueries.at(-1)).toContain('pos=Verb'));
    });
});

describe('TagViewPage — search in the URL', () => {
    it('writes the search to the URL after a pause, and goes back to page 1', async () => {
        const { wordFake } = manySetUp();
        const user = userEvent.setup();
        const { router } = await renderApp({ initialEntry: '/tag/tag-1?page=2', session: SESSION });
        await screen.findByText('word0');

        await user.type(screen.getByRole('textbox', { name: 'Search words in tag' }), 'word4');

        await waitFor(() => expect(router.state.location.search).toMatchObject({ q: 'word4' }));
        expect(router.state.location.search).not.toHaveProperty('page');
        await waitFor(() => expect(wordFake.simpleQueries.at(-1)).toContain('q=word4'));
        expect(await screen.findByText('11 results')).toBeInTheDocument(); // word4, word40 … word49
    });

    it('fills the search box from the URL and filters with it', async () => {
        const { wordFake } = manySetUp();
        await renderApp({ initialEntry: '/tag/tag-1?q=word3', session: SESSION });

        expect(await screen.findByRole('textbox', { name: 'Search words in tag' })).toHaveValue('word3');
        await waitFor(() => expect(wordFake.simpleQueries.at(-1)).toContain('q=word3'));
    });

    it('keeps the page when the box only mounts (nothing typed)', async () => {
        manySetUp();
        const { router } = await renderApp({ initialEntry: '/tag/tag-1?page=2', session: SESSION, strictMode: true });
        await screen.findByText('word0');
        await new Promise((resolve) => setTimeout(resolve, 450)); // longer than the 300 ms pause

        expect(router.state.location.search).toMatchObject({ page: 2 });
    });

    it('clearing the search takes q out of the URL', async () => {
        manySetUp();
        const user = userEvent.setup();
        const { router } = await renderApp({ initialEntry: '/tag/tag-1?q=zzz', session: SESSION });

        await user.click(await screen.findByRole('button', { name: 'Clear search' }));

        await waitFor(() => expect(router.state.location.search).not.toHaveProperty('q'));
    });
});

describe('TagViewPage — Add words with a tag of several pages', () => {
    it('does not offer a word the tag already has, even when it is on another page', async () => {
        manySetUp();
        const user = userEvent.setup();
        await renderApp({ initialEntry: '/tag/tag-1', session: SESSION });
        await screen.findByText('word50');

        await user.click(screen.getAllByRole('button', { name: 'Add words' })[0]);
        const dialog = await screen.findByRole('dialog');
        // `word0` is on page 2 of the tag: the page on screen does not have it, the tag does.
        await user.type(await within(dialog).findByRole('textbox', { name: 'Search your words to add now' }), 'word0');

        expect(await within(dialog).findByText('No words match')).toBeInTheDocument();
        expect(within(dialog).queryByText('word0')).not.toBeInTheDocument();
    });

    it('does not offer a word the tag has while a search narrows the page on screen', async () => {
        manySetUp([verbSeed('extra', 'w-extra')]);
        const user = userEvent.setup();
        await renderApp({ initialEntry: '/tag/tag-1?q=word3', session: SESSION });
        await waitFor(() => expect(screen.getByText('11 results')).toBeInTheDocument()); // word3, word30 … word39

        await user.click(screen.getAllByRole('button', { name: 'Add words' })[0]);
        const dialog = await screen.findByRole('dialog');
        await user.type(await within(dialog).findByRole('textbox', { name: 'Search your words to add now' }), 'word');

        expect(await within(dialog).findByText('No words match')).toBeInTheDocument();
    });

    it('still offers a word that is not on the tag', async () => {
        manySetUp([verbSeed('extra', 'w-extra')]);
        const user = userEvent.setup();
        await renderApp({ initialEntry: '/tag/tag-1', session: SESSION });
        await screen.findByText('word50');

        await user.click(screen.getAllByRole('button', { name: 'Add words' })[0]);
        const dialog = await screen.findByRole('dialog');

        expect(await within(dialog).findByText('extra')).toBeInTheDocument();
        expect(within(dialog).queryByText('word50')).not.toBeInTheDocument();
    });
});
