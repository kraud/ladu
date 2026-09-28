import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { RelationBadge, TagBadges, VisibilityBadge, tagRelation } from './TagBadge';
import type { TagSummary } from '../types';

function makeTag(overrides: Partial<TagSummary> = {}): TagSummary {
    return {
        id: 'tag-1',
        label: 'Kitchen',
        description: null,
        visibility: 'Public',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        author: { id: 'author-1', username: 'kai' },
        wordCount: 0,
        followerCount: 0,
        isOwner: false,
        isFollowing: false,
        isAvailable: true,
        sourceTag: null,
        ...overrides,
    };
}

describe('tagRelation', () => {
    it('is owned when isOwner is true, regardless of isFollowing', () => {
        expect(tagRelation({ isOwner: true, isFollowing: true, isAvailable: true })).toBe('owned');
    });

    it('is followed when following an available tag', () => {
        expect(tagRelation({ isOwner: false, isFollowing: true, isAvailable: true })).toBe('followed');
    });

    it('is unavailable when following a tag that turned unavailable (D9)', () => {
        expect(tagRelation({ isOwner: false, isFollowing: true, isAvailable: false })).toBe('unavailable');
    });

    it('is discover when neither owning nor following', () => {
        expect(tagRelation({ isOwner: false, isFollowing: false, isAvailable: true })).toBe('discover');
    });
});

describe('RelationBadge', () => {
    it.each([
        ['owned', 'Owned'],
        ['followed', 'Followed'],
        ['unavailable', 'Unavailable'],
        ['discover', 'Discover'],
    ] as const)('renders the %s label', (relation, label) => {
        renderWithProviders(<RelationBadge relation={relation} />);
        expect(screen.getByText(label)).toBeInTheDocument();
    });
});

describe('VisibilityBadge', () => {
    it('renders Public with no lock icon', () => {
        const { container } = renderWithProviders(<VisibilityBadge visibility="Public" />);
        expect(screen.getByText('Public')).toBeInTheDocument();
        expect(container.querySelector('svg')).not.toBeInTheDocument();
    });

    it('renders Private with a lock icon', () => {
        const { container } = renderWithProviders(<VisibilityBadge visibility="Private" />);
        expect(screen.getByText('Private')).toBeInTheDocument();
        expect(container.querySelector('svg')).toBeInTheDocument();
    });
});

describe('TagBadges', () => {
    it('shows both the relation and visibility badges together', () => {
        renderWithProviders(<TagBadges tag={makeTag({ isOwner: true, visibility: 'Private' })} />);
        expect(screen.getByText('Owned')).toBeInTheDocument();
        expect(screen.getByText('Private')).toBeInTheDocument();
    });
});
