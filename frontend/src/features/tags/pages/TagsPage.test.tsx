import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderApp } from '@/test/render';
import { server } from '@/test/msw/server';
import { makeTagHandlers, type SeedTag } from '@/test/msw/tagHandlers';
import { makeWordHandlers } from '@/test/msw/wordHandlers';
import { futureToken } from '@/test/tokens';

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

function ownedTag(label: string, id = `tag-${label}`, extra: Partial<SeedTag> = {}): SeedTag {
    return { id, authorId: ME, label, visibility: 'Private', ...extra };
}

function followedTag(label: string, id = `tag-${label}`): SeedTag {
    return { id, authorId: OTHER, label, visibility: 'Public', followerIds: [ME] };
}

function discoverTag(label: string, id = `tag-${label}`): SeedTag {
    return { id, authorId: OTHER, label, visibility: 'Public' };
}

function setUp(seedTags: SeedTag[] = []) {
    const fake = makeTagHandlers({ callerId: ME, usernames: { [OTHER]: 'mari' }, seedTags });
    // The create-tag dialog embeds `WordPicker`, which queries `/api/words/simple`
    // as soon as it mounts — registered for every test so opening "New tag"
    // never hits an unhandled request, even in tests that don't care about words.
    const words = makeWordHandlers({ callerId: ME, seed: [] });
    server.use(...fake.handlers, ...words.handlers);
    return fake;
}

describe('TagsPage — listing and scopes', () => {
    it('scope=all shows both owned and followed tags', async () => {
        setUp([ownedTag('Kitchen'), followedTag('Travel')]);
        await renderApp({ initialEntry: '/tags', session: SESSION });

        expect(await screen.findByText('Kitchen')).toBeInTheDocument();
        expect(screen.getByText('Travel')).toBeInTheDocument();
    });

    it('clicking the Owned chip narrows the list and writes ?scope= to the URL', async () => {
        const fake = setUp([ownedTag('Kitchen'), followedTag('Travel')]);
        const user = userEvent.setup();
        const { router } = await renderApp({ initialEntry: '/tags', session: SESSION });
        await screen.findByText('Travel');

        await user.click(screen.getByRole('button', { name: 'Owned' }));

        await waitFor(() => expect(screen.queryByText('Travel')).not.toBeInTheDocument());
        expect(screen.getByText('Kitchen')).toBeInTheDocument();
        expect(router.state.location.search).toEqual({ scope: 'owned' });
        expect(fake.listQueries.some((q) => q.includes('scope=owned'))).toBe(true);
    });

    it('a ?scope= already in the URL is honoured on load', async () => {
        setUp([ownedTag('Kitchen'), followedTag('Travel')]);
        await renderApp({ initialEntry: '/tags?scope=followed', session: SESSION });

        expect(await screen.findByText('Travel')).toBeInTheDocument();
        expect(screen.queryByText('Kitchen')).not.toBeInTheDocument();
    });

    it('typing in the search box narrows results after the debounce', async () => {
        const fake = setUp([ownedTag('Kitchen'), ownedTag('Garage')]);
        const user = userEvent.setup();
        await renderApp({ initialEntry: '/tags', session: SESSION });
        await screen.findByText('Garage');

        await user.type(screen.getByPlaceholderText('Search by label or description…'), 'Kitch');

        // `Garage` disappearing only proves the pending refetch cleared the old
        // page — the new page can still be a beat behind (a skeleton grid),
        // so wait for it too rather than asserting synchronously right after.
        await waitFor(() => expect(screen.queryByText('Garage')).not.toBeInTheDocument(), { timeout: 2000 });
        expect(await screen.findByText('Kitchen')).toBeInTheDocument();
        expect(fake.listQueries.some((q) => q.includes('q=Kitch'))).toBe(true);
    });

    it('Load more appends the next page', async () => {
        const seed = Array.from({ length: 25 }, (_, i) => ownedTag(String(i), `tag-${i}`));
        setUp(seed);
        const user = userEvent.setup();
        await renderApp({ initialEntry: '/tags', session: SESSION });

        await waitFor(() => expect(screen.getByText('24 of 25 tags')).toBeInTheDocument());
        await user.click(screen.getByRole('button', { name: 'Load more' }));

        await waitFor(() => expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument());
    });
});

describe('TagsPage — empty states', () => {
    it('owned scope with nothing shows the "make your first tag" CTA', async () => {
        setUp([]);
        await renderApp({ initialEntry: '/tags', session: SESSION });
        expect(await screen.findByText('No tags yet')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Make your first tag' })).toBeInTheDocument();
    });

    it('followed scope with nothing points at Discover', async () => {
        setUp([]);
        const user = userEvent.setup();
        await renderApp({ initialEntry: '/tags?scope=followed', session: SESSION });

        expect(await screen.findByText("You're not following any tags yet")).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Find tags in Discover' }));
        await waitFor(() => expect(screen.getByRole('button', { name: 'Discover', pressed: true })).toBeInTheDocument());
    });

    it('a search with no matches shows the clear-search CTA', async () => {
        setUp([ownedTag('Kitchen')]);
        const user = userEvent.setup();
        await renderApp({ initialEntry: '/tags', session: SESSION });
        await screen.findByText('Kitchen');

        await user.type(screen.getByPlaceholderText('Search by label or description…'), 'zzz');
        expect(await screen.findByText('No tags match "zzz"')).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Clear search' }));
        expect(await screen.findByText('Kitchen')).toBeInTheDocument();
    });
});

describe('TagsPage — create', () => {
    it('New tag opens the create dialog; submitting closes it and shows a success toast', async () => {
        setUp([]);
        const user = userEvent.setup();
        await renderApp({ initialEntry: '/tags', session: SESSION });
        await screen.findByText('No tags yet');

        await user.click(screen.getByRole('button', { name: 'New tag' }));
        await user.type(screen.getByLabelText(/Label/), 'Kitchen');
        await user.click(screen.getByRole('button', { name: 'Create tag' }));

        await waitFor(() => expect(screen.queryByRole('button', { name: 'Create tag' })).not.toBeInTheDocument());
        expect(await screen.findByText('Tag "Kitchen" created')).toBeInTheDocument();
    });
});

describe('TagsPage — follow / unfollow', () => {
    it('Follow on a discover card follows immediately (no confirm dialog) and toasts', async () => {
        setUp([discoverTag('Travel')]);
        const user = userEvent.setup();
        await renderApp({ initialEntry: '/tags?scope=discover', session: SESSION });
        await screen.findByText('Travel');

        await user.click(screen.getByRole('button', { name: 'Follow' }));
        expect(await screen.findByText('You\'re now following "Travel"')).toBeInTheDocument();
    });

    it('Unfollow asks for confirmation before it takes effect', async () => {
        setUp([followedTag('Travel')]);
        const user = userEvent.setup();
        await renderApp({ initialEntry: '/tags?scope=followed', session: SESSION });
        await screen.findByText('Travel');

        await user.click(screen.getByRole('button', { name: 'Unfollow' }));
        expect(screen.getByText('Unfollow tag?')).toBeInTheDocument();
        expect(screen.getByText(/You'll stop following "Travel" by mari/)).toBeInTheDocument();

        const confirmButtons = screen.getAllByRole('button', { name: 'Unfollow' });
        await user.click(confirmButtons[confirmButtons.length - 1]);

        expect(await screen.findByText('Unfollowed "Travel"')).toBeInTheDocument();
        await waitFor(() => expect(screen.queryByText('Travel')).not.toBeInTheDocument());
    });
});

describe('TagsPage — delete', () => {
    it('Delete asks for confirmation with a pluralized word count, then deletes', async () => {
        setUp([ownedTag('Kitchen', 'tag-1', { wordIds: ['w1', 'w2', 'w3'] })]);
        const user = userEvent.setup();
        await renderApp({ initialEntry: '/tags', session: SESSION });
        await screen.findByText('Kitchen');

        await user.click(screen.getByRole('button', { name: 'Delete' }));
        expect(screen.getByText('Delete tag?')).toBeInTheDocument();
        expect(screen.getByText(/"Kitchen" holds 3 words/)).toBeInTheDocument();

        await user.click(screen.getAllByRole('button', { name: 'Delete' }).at(-1)!);

        expect(await screen.findByText('Tag "Kitchen" deleted — its words stay on your shelf')).toBeInTheDocument();
        await waitFor(() => expect(screen.queryByText('Kitchen')).not.toBeInTheDocument());
    });

    it('uses the singular wording for a tag holding exactly one word', async () => {
        setUp([ownedTag('Kitchen', 'tag-1', { wordIds: ['w1'] })]);
        const user = userEvent.setup();
        await renderApp({ initialEntry: '/tags', session: SESSION });
        await screen.findByText('Kitchen');

        await user.click(screen.getByRole('button', { name: 'Delete' }));
        expect(screen.getByText(/"Kitchen" holds 1 word\./)).toBeInTheDocument();
    });
});

describe('TagsPage — clone', () => {
    it('Clone on a discover card opens the clone dialog and confirms', async () => {
        setUp([discoverTag('Travel')]);
        const user = userEvent.setup();
        await renderApp({ initialEntry: '/tags?scope=discover', session: SESSION });
        await screen.findByText('Travel');

        await user.click(screen.getByRole('button', { name: 'Clone' }));
        expect(screen.getByText('Clone this tag')).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Create copy' }));
        expect(await screen.findByText('Copy of "Travel" created — it\'s all yours now')).toBeInTheDocument();
    });
});

describe('TagsPage — edit', () => {
    it('Edit on an owned card opens the form pre-filled, and saving updates the card', async () => {
        setUp([ownedTag('Kitchen')]);
        const user = userEvent.setup();
        await renderApp({ initialEntry: '/tags', session: SESSION });
        await screen.findByText('Kitchen');

        await user.click(screen.getByRole('button', { name: 'Edit' }));
        const labelInput = screen.getByLabelText(/Label/);
        expect(labelInput).toHaveValue('Kitchen');

        await user.clear(labelInput);
        await user.type(labelInput, 'Cooking');
        await user.click(screen.getByRole('button', { name: 'Save changes' }));

        expect(await screen.findByText('"Cooking" updated')).toBeInTheDocument();
        expect(screen.getByText('Cooking')).toBeInTheDocument();
    });
});
