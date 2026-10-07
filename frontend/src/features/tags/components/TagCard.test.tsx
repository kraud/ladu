import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Outlet, RouterProvider, createMemoryHistory, createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import { I18nextProvider } from 'react-i18next';
import { render } from '@testing-library/react';
import { createTestI18n } from '@/test/render';
import { TagCard } from './TagCard';
import type { TagSummary } from '../types';

function makeTag(overrides: Partial<TagSummary> = {}): TagSummary {
    return {
        id: 'tag-1',
        label: 'Kitchen',
        description: 'Words about the kitchen',
        visibility: 'Public',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        author: { id: 'author-1', username: 'kai', badges: [] },
        wordCount: 4,
        followerCount: 2,
        isOwner: false,
        isFollowing: false,
        isAvailable: true,
        sourceTag: null,
        ...overrides,
    };
}

/** `TagCard` holds a router `Link`, so it needs a minimal router around it. */
async function renderCard(ui: ReactElement) {
    const rootRoute = createRootRoute({
        component: () => (
            <>
                {ui}
                <Outlet />
            </>
        ),
    });
    const tagRoute = createRoute({ getParentRoute: () => rootRoute, path: '/tag/$tagId', component: () => <p>tag page</p> });
    const router = createRouter({
        routeTree: rootRoute.addChildren([tagRoute]),
        history: createMemoryHistory({ initialEntries: ['/'] }),
    });
    await router.load();
    render(
        <I18nextProvider i18n={createTestI18n()}>
            <RouterProvider router={router} />
        </I18nextProvider>,
    );
    await screen.findByRole('link', { name: /^Open / });
    return router;
}

describe('TagCard — owned', () => {
    it('shows the Yours badge and no footer buttons', async () => {
        await renderCard(<TagCard tag={makeTag({ isOwner: true })} />);
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
        expect(screen.getByText('Yours')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'View words' })).not.toBeInTheDocument();
        expect(screen.queryByText('by kai')).not.toBeInTheDocument();
    });

    it('shows a Cloned badge, not a banner, when the tag has provenance', async () => {
        await renderCard(
            <TagCard tag={makeTag({ isOwner: true, sourceTag: { id: 'src-1', label: 'Original Kitchen' } })} />,
        );
        expect(screen.getByText('Cloned')).toHaveAttribute('title', 'Cloned from Original Kitchen');
        expect(screen.queryByText('Original Kitchen')).not.toBeInTheDocument();
    });

    it('showActions={false} hides the footer of a followed card', async () => {
        await renderCard(<TagCard tag={makeTag({ isFollowing: true })} showActions={false} />);
        expect(screen.queryByRole('button', { name: 'Unfollow' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Clone' })).not.toBeInTheDocument();
    });
});

describe('TagCard — followed', () => {
    it('shows Unfollow/Clone and the author on the stats line', async () => {
        await renderCard(<TagCard tag={makeTag({ isFollowing: true, isAvailable: true })} />);
        expect(screen.getByRole('button', { name: 'Unfollow' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Clone' })).toBeInTheDocument();
        expect(screen.getByText('kai').closest('.t-stats')).not.toBeNull();
    });
});

describe('TagCard — verified author', () => {
    const badged = { id: 'author-1', username: 'kai', badges: ['official'] };
    const verified = () => screen.queryAllByRole('img', { name: 'Official Ladu account' });

    it('shows the author name in the accent style, with no icon beside it and no Official label', async () => {
        await renderCard(<TagCard tag={makeTag({ author: badged })} />);
        const by = screen.getByText('kai');
        expect(by).toHaveClass('t-by-verified');
        expect(by.querySelector('.t-verified')).toBeNull();
        expect(by.parentElement).toHaveTextContent('by kai');
        expect(screen.queryByText('Official')).not.toBeInTheDocument();
    });

    it('also marks the title of a Public tag', async () => {
        await renderCard(<TagCard tag={makeTag({ author: badged })} />);
        expect(screen.getByText('Kitchen').querySelector('.t-verified')).not.toBeNull();
        expect(verified()).toHaveLength(1);
    });

    it('does not mark the title of a Private tag', async () => {
        await renderCard(<TagCard tag={makeTag({ author: badged, visibility: 'Private' })} />);
        expect(screen.getByText('Kitchen').querySelector('.t-verified')).toBeNull();
    });

    it('shows no icon and a plain name when the author has no badge', async () => {
        await renderCard(<TagCard tag={makeTag()} />);
        expect(screen.getByText('kai')).not.toHaveClass('t-by-verified');
        expect(verified()).toHaveLength(0);
    });

    it('marks the title of the caller\'s own Public tag when they are verified, with no "by" label', async () => {
        await renderCard(<TagCard tag={makeTag({ isOwner: true, author: badged })} />);
        expect(verified()).toHaveLength(1);
        expect(screen.queryByText('kai')).not.toBeInTheDocument();
        expect(screen.queryByText('by', { exact: false })).not.toBeInTheDocument();
    });
});

describe('TagCard — discover', () => {
    it('shows Follow/Clone', async () => {
        await renderCard(<TagCard tag={makeTag()} />);
        expect(screen.getByRole('button', { name: 'Follow' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Clone' })).toBeInTheDocument();
    });
});

describe('TagCard — unavailable (D9)', () => {
    it('shows only Unfollow, hides the follower count, and shows the unavailable note', async () => {
        const tag = makeTag({ isFollowing: true, isAvailable: false, followerCount: 9 });
        await renderCard(<TagCard tag={tag} />);

        expect(screen.getByRole('button', { name: 'Unfollow' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Clone' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Follow' })).not.toBeInTheDocument();
        expect(screen.queryByText('9')).not.toBeInTheDocument();
        expect(screen.getByText(/the owner made this tag Private/i)).toBeInTheDocument();
    });
});

describe('TagCard — opening', () => {
    it('is a real link to the tag page, so it opens in a new tab', async () => {
        await renderCard(<TagCard tag={makeTag()} />);
        expect(screen.getByRole('link', { name: 'Open Kitchen' })).toHaveAttribute('href', '/tag/tag-1');
    });

    it('clicking the title navigates to the tag page', async () => {
        const user = userEvent.setup();
        await renderCard(<TagCard tag={makeTag()} />);
        await user.click(screen.getByRole('link', { name: 'Open Kitchen' }));
        expect(await screen.findByText('tag page')).toBeInTheDocument();
    });
});

describe('TagCard — no description', () => {
    it('shows the italic placeholder', async () => {
        await renderCard(<TagCard tag={makeTag({ description: null })} />);
        expect(screen.getByText('No description')).toBeInTheDocument();
    });
});

describe('TagCard — long description', () => {
    it('shows more/less only when the text is cut off', async () => {
        const user = userEvent.setup();
        const spy = vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(300);
        const client = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(100);
        try {
            await renderCard(<TagCard tag={makeTag()} />);
            await user.click(await screen.findByRole('button', { name: 'more' }));
            const less = screen.getByRole('button', { name: 'less' });
            expect(less).toHaveAttribute('aria-expanded', 'true');
            // Open: the button sits inside the text, after the last word.
            expect(less.closest('p')).toHaveTextContent(/Words about the kitchen\s*less/);
        } finally {
            spy.mockRestore();
            client.mockRestore();
        }
    });

    it('shows no button when the text fits', async () => {
        await renderCard(<TagCard tag={makeTag()} />);
        expect(screen.queryByRole('button', { name: 'more' })).not.toBeInTheDocument();
    });
});
