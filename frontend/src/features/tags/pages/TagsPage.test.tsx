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

function setUp(seedTags: SeedTag[] = [], authorBadges: Record<string, string[]> = {}) {
    const fake = makeTagHandlers({ callerId: ME, usernames: { [OTHER]: 'mari' }, seedTags, authorBadges });
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

        await user.click(screen.getByRole('button', { name: 'Yours' }));

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

    it('with "Keep the tag" unchecked, copies only the words and says how many', async () => {
        setUp([{ ...discoverTag('Travel'), wordIds: ['w1', 'w2'] }]);
        const user = userEvent.setup();
        await renderApp({ initialEntry: '/tags?scope=discover', session: SESSION });
        await screen.findByText('Travel');

        await user.click(screen.getByRole('button', { name: 'Clone' }));
        await user.click(screen.getByRole('checkbox', { name: 'Keep the tag' }));
        await user.click(screen.getByRole('button', { name: 'Copy words' }));

        expect(await screen.findByText('2 words copied to your account')).toBeInTheDocument();
    });
});

describe('TagsPage — author badge', () => {
    it('shows the badge on a card whose author has one, and not on the others', async () => {
        setUp(
            [
                { id: 'tag-a', authorId: OTHER, label: 'Travel', visibility: 'Public' },
                { id: 'tag-b', authorId: 'user-plain', label: 'Cooking', visibility: 'Public' },
            ],
            { [OTHER]: ['official'] },
        );
        await renderApp({ initialEntry: '/tags?scope=discover', session: SESSION });

        expect(await screen.findByText('Cooking')).toBeInTheDocument();
        // One icon on the page (after the title), on the badged author's card.
        const badges = screen.getAllByRole('img', { name: 'Official Ladu account' });
        expect(badges).toHaveLength(1);
        badges.forEach((badge) => expect(badge.closest('.tagcard')).toHaveTextContent('Travel'));
    });
});

describe('TagsPage — author filter', () => {
    const BADGED = { [OTHER]: ['official'] };
    const PLAIN = 'user-plain';
    const seedDiscover = (): SeedTag[] => [
        { id: 'tag-official', authorId: OTHER, label: 'Travel', visibility: 'Public' },
        { id: 'tag-plain', authorId: PLAIN, label: 'Cooking', visibility: 'Public' },
    ];
    const verifiedBox = () => screen.getByRole('checkbox', { name: 'Verified' });

    it('starts unchecked, shows every author and sends no badge parameter', async () => {
        const fake = setUp(seedDiscover(), BADGED);
        await renderApp({ initialEntry: '/tags?scope=discover', session: SESSION });

        expect(await screen.findByText('Travel')).toBeInTheDocument();
        expect(screen.getByText('Cooking')).toBeInTheDocument();
        expect(verifiedBox()).not.toBeChecked();
        expect(fake.listQueries.some((query) => query.includes('badge'))).toBe(false);
    });

    it('ticking Verified keeps only tags of badged authors and writes ?badge= to the URL', async () => {
        const fake = setUp(seedDiscover(), BADGED);
        const user = userEvent.setup();
        const { router } = await renderApp({ initialEntry: '/tags?scope=discover', session: SESSION });
        await screen.findByText('Cooking');

        await user.click(verifiedBox());

        await waitFor(() => expect(screen.queryByText('Cooking')).not.toBeInTheDocument());
        expect(screen.getByText('Travel')).toBeInTheDocument();
        expect(verifiedBox()).toBeChecked();
        expect(router.state.location.search).toEqual({ scope: 'discover', badge: 'official' });
        expect(fake.listQueries.some((query) => query.includes('badge=official'))).toBe(true);
        // The count follows the filter.
        expect(screen.getByText('1 of 1 tags')).toBeInTheDocument();
    });

    it('a ?badge= already in the URL is honoured on load (the view survives a reload)', async () => {
        const fake = setUp(seedDiscover(), BADGED);
        await renderApp({ initialEntry: '/tags?scope=discover&badge=official', session: SESSION });

        expect(await screen.findByText('Travel')).toBeInTheDocument();
        expect(screen.queryByText('Cooking')).not.toBeInTheDocument();
        expect(verifiedBox()).toBeChecked();
        expect(fake.listQueries.every((query) => query.includes('badge=official'))).toBe(true);
    });

    it('unticking Verified removes the filter and the URL parameter', async () => {
        setUp(seedDiscover(), BADGED);
        const user = userEvent.setup();
        const { router } = await renderApp({ initialEntry: '/tags?scope=discover&badge=official', session: SESSION });
        await screen.findByText('Travel');

        await user.click(verifiedBox());

        expect(await screen.findByText('Cooking')).toBeInTheDocument();
        expect(router.state.location.search).toEqual({ scope: 'discover' });
        expect(router.state.location.search).not.toHaveProperty('badge', 'official');
    });

    it('keeps the badge when the scope changes, and keeps the scope when the badge changes', async () => {
        setUp([...seedDiscover(), { id: 'tag-mine', authorId: ME, label: 'Mine', visibility: 'Private' }], { ...BADGED, [ME]: ['official'] });
        const user = userEvent.setup();
        const { router } = await renderApp({ initialEntry: '/tags?scope=discover&badge=official', session: SESSION });
        await screen.findByText('Travel');

        await user.click(screen.getByRole('button', { name: 'Yours' }));

        expect(await screen.findByText('Mine')).toBeInTheDocument();
        expect(router.state.location.search).toEqual({ scope: 'owned', badge: 'official' });
    });

    it('combines with the search box', async () => {
        const fake = setUp(
            [
                { id: 'tag-a', authorId: OTHER, label: 'Travel words', visibility: 'Public' },
                { id: 'tag-b', authorId: OTHER, label: 'Cooking words', visibility: 'Public' },
                { id: 'tag-c', authorId: PLAIN, label: 'Travel plain', visibility: 'Public' },
            ],
            BADGED,
        );
        const user = userEvent.setup();
        await renderApp({ initialEntry: '/tags?scope=discover&badge=official', session: SESSION });
        await screen.findByText('Cooking words');

        await user.type(screen.getByRole('textbox', { name: 'Search tags' }), 'travel');

        // Wait for the settled result, not just for the old card to leave (the list shows
        // skeletons while the debounced request is in flight).
        await waitFor(() => {
            expect(screen.queryByText('Cooking words')).not.toBeInTheDocument();
            expect(screen.getByText('Travel words')).toBeInTheDocument();
        });
        expect(screen.queryByText('Travel plain')).not.toBeInTheDocument();
        expect(fake.listQueries.some((query) => query.includes('q=travel') && query.includes('badge=official'))).toBe(true);
    });

    it('shows its own empty state when no author has the badge, and "Show all tags" clears the filter', async () => {
        setUp([{ id: 'tag-plain', authorId: PLAIN, label: 'Cooking', visibility: 'Public' }]);
        const user = userEvent.setup();
        const { router } = await renderApp({ initialEntry: '/tags?scope=discover&badge=official', session: SESSION });

        expect(await screen.findByText('No verified tags match')).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Show all tags' }));

        expect(await screen.findByText('Cooking')).toBeInTheDocument();
        expect(router.state.location.search).toEqual({ scope: 'discover' });
        expect(verifiedBox()).not.toBeChecked();
    });

    it('drops a badge type this build does not know', async () => {
        const fake = setUp(seedDiscover(), BADGED);
        const { router } = await renderApp({ initialEntry: '/tags?scope=discover&badge=teacher', session: SESSION });

        expect(await screen.findByText('Cooking')).toBeInTheDocument();
        expect(screen.getByText('Travel')).toBeInTheDocument();
        expect(router.state.location.search).toEqual({ scope: 'discover' });
        expect(fake.listQueries.some((query) => query.includes('badge'))).toBe(false);
    });
});
