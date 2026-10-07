import { screen, waitFor } from '@testing-library/react';
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

function setUp(seedTags: SeedTag[] = [], seedWords: SeedWord[] = [], authorBadges: Record<string, string[]> = {}) {
    const tagFake = makeTagHandlers({ callerId: ME, usernames: { [OTHER]: 'mari' }, seedTags, authorBadges });
    const wordFake = makeWordHandlers({ callerId: ME, seed: seedWords });
    server.use(...tagFake.handlers, ...wordFake.handlers);
    return { tagFake, wordFake };
}

describe('TagViewPage — not found', () => {
    it('shows the not-found state for an unknown tag id, with a link back to /tags', async () => {
        setUp([]);
        await renderApp({ initialEntry: '/tag/does-not-exist', session: SESSION });

        expect(await screen.findByText("You can't see this tag")).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Back to /tags' })).toHaveAttribute('href', '/tags');
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
