import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
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
        author: { id: 'author-1', username: 'kai' },
        wordCount: 4,
        followerCount: 2,
        isOwner: false,
        isFollowing: false,
        isAvailable: true,
        sourceTag: null,
        ...overrides,
    };
}

describe('TagCard — owned', () => {
    it('shows Edit/Delete/View words and no author row', () => {
        renderWithProviders(<TagCard tag={makeTag({ isOwner: true })} onView={vi.fn()} />);
        expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'View words' })).toBeInTheDocument();
        expect(screen.queryByText('by kai')).not.toBeInTheDocument();
    });

    it('shows a "Cloned from" line when the tag has provenance', () => {
        renderWithProviders(
            <TagCard
                tag={makeTag({ isOwner: true, sourceTag: { id: 'src-1', label: 'Original Kitchen' } })}
                onView={vi.fn()}
            />,
        );
        expect(screen.getByText('Original Kitchen')).toBeInTheDocument();
    });

    it('clicking Edit calls onEdit with the tag, not onView', async () => {
        const onEdit = vi.fn();
        const onView = vi.fn();
        const user = userEvent.setup();
        const tag = makeTag({ isOwner: true });
        renderWithProviders(<TagCard tag={tag} onView={onView} onEdit={onEdit} />);

        await user.click(screen.getByRole('button', { name: 'Edit' }));
        expect(onEdit).toHaveBeenCalledWith(tag);
        expect(onView).not.toHaveBeenCalled();
    });
});

describe('TagCard — followed', () => {
    it('shows Unfollow/Clone/View words and the author row', () => {
        renderWithProviders(<TagCard tag={makeTag({ isFollowing: true, isAvailable: true })} onView={vi.fn()} />);
        expect(screen.getByRole('button', { name: 'Unfollow' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Clone' })).toBeInTheDocument();
        expect(screen.getByText('by kai')).toBeInTheDocument();
    });
});

describe('TagCard — discover', () => {
    it('shows Follow/Clone/View words', () => {
        renderWithProviders(<TagCard tag={makeTag()} onView={vi.fn()} />);
        expect(screen.getByRole('button', { name: 'Follow' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Clone' })).toBeInTheDocument();
    });
});

describe('TagCard — unavailable (D9)', () => {
    it('shows only Unfollow, hides the follower count, and shows the unavailable note', () => {
        const tag = makeTag({ isFollowing: true, isAvailable: false, followerCount: 9 });
        renderWithProviders(<TagCard tag={tag} onView={vi.fn()} />);

        expect(screen.getByRole('button', { name: 'Unfollow' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Clone' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Follow' })).not.toBeInTheDocument();
        expect(screen.queryByText('9')).not.toBeInTheDocument();
        expect(
            screen.getByText(/the owner made this tag Private/i),
        ).toBeInTheDocument();
    });
});

describe('TagCard — opening', () => {
    it('clicking the card body calls onView', async () => {
        const onView = vi.fn();
        const user = userEvent.setup();
        const tag = makeTag();
        renderWithProviders(<TagCard tag={tag} onView={onView} />);

        await user.click(screen.getByRole('link', { name: 'Open Kitchen' }));
        expect(onView).toHaveBeenCalledWith(tag);
    });

    it('clicking "View words" also calls onView', async () => {
        const onView = vi.fn();
        const user = userEvent.setup();
        const tag = makeTag({ isOwner: true });
        renderWithProviders(<TagCard tag={tag} onView={onView} />);

        await user.click(screen.getByRole('button', { name: 'View words' }));
        expect(onView).toHaveBeenCalledWith(tag);
    });
});

describe('TagCard — no description', () => {
    it('shows the italic placeholder', () => {
        renderWithProviders(<TagCard tag={makeTag({ description: null })} onView={vi.fn()} />);
        expect(screen.getByText('No description')).toBeInTheDocument();
    });
});
