import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { server } from '@/test/msw/server';
import { makeTagHandlers } from '@/test/msw/tagHandlers';
import { CloneTagDialog } from './CloneTagDialog';
import type { TagSummary } from '../types';

const ME = 'user-me';
const OTHER = 'user-other';

function makeTag(overrides: Partial<TagSummary> = {}): TagSummary {
    return {
        id: 'tag-1',
        label: 'Kitchen',
        description: null,
        visibility: 'Public',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        author: { id: OTHER, username: 'mari', badges: [] },
        wordCount: 5,
        followerCount: 3,
        languages: [],
        isOwner: false,
        isFollowing: false,
        isAvailable: true,
        sourceTag: null,
        ...overrides,
    };
}

describe('CloneTagDialog', () => {
    it('renders nothing when there is no target tag', () => {
        const { container } = renderWithProviders(
            <CloneTagDialog open onOpenChange={vi.fn()} tag={null} />,
        );
        expect(container).toBeEmptyDOMElement();
    });

    it('shows tag label, author, and word/follower counts', () => {
        renderWithProviders(<CloneTagDialog open onOpenChange={vi.fn()} tag={makeTag()} />);
        expect(screen.getByText('Kitchen')).toBeInTheDocument();
        expect(screen.getByText('by mari')).toBeInTheDocument();
        expect(screen.getByText('5 words · 3 followers')).toBeInTheDocument();
    });

    it('defaults the copy to Private and does not show the ends-follow note for a Discover tag', () => {
        renderWithProviders(<CloneTagDialog open onOpenChange={vi.fn()} tag={makeTag()} />);
        expect(screen.getByRole('radio', { name: 'Private' })).toBeChecked();
        expect(screen.queryByText(/your follow of the original ends/i)).not.toBeInTheDocument();
    });

    it('shows the ends-follow note when cloning a followed tag', () => {
        renderWithProviders(
            <CloneTagDialog open onOpenChange={vi.fn()} tag={makeTag({ isFollowing: true, isAvailable: true })} />,
        );
        expect(screen.getByText(/your follow of the original ends/i)).toBeInTheDocument();
    });

    it('shows the ends-follow note for an unavailable (D9) tag too', () => {
        renderWithProviders(
            <CloneTagDialog
                open
                onOpenChange={vi.fn()}
                tag={makeTag({ isFollowing: true, isAvailable: false })}
            />,
        );
        expect(screen.getByText(/your follow of the original ends/i)).toBeInTheDocument();
    });

    it('confirms with the chosen visibility and calls onCloned', async () => {
        // A seed id distinct from the fake's own auto-generated `tag-<n>`
        // sequence — `nextId('tag')` would otherwise mint the clone the same
        // id as this seed on a fresh module counter, overwriting it in the
        // store instead of adding a second entry.
        const fake = makeTagHandlers({
            callerId: ME,
            seedTags: [{ id: 'seed-kitchen', authorId: OTHER, label: 'Kitchen', visibility: 'Public' }],
        });
        server.use(...fake.handlers);
        const user = userEvent.setup();
        const onCloned = vi.fn();
        const onOpenChange = vi.fn();

        renderWithProviders(
            <CloneTagDialog
                open
                onOpenChange={onOpenChange}
                tag={makeTag({ id: 'seed-kitchen' })}
                onCloned={onCloned}
            />,
        );

        await user.click(screen.getByRole('radio', { name: 'Public' }));
        await user.click(screen.getByRole('button', { name: 'Create copy' }));

        await waitFor(() => expect(onCloned).toHaveBeenCalled());
        expect(onOpenChange).toHaveBeenCalledWith(false);
        const clone = [...fake.store.values()].find((t) => t.id !== 'seed-kitchen');
        expect(clone?.visibility).toBe('Public');
        expect(clone?.sourceTag).toEqual({ id: 'seed-kitchen', label: 'Kitchen' });
    });

    describe('keep the tag', () => {
        function open() {
            const fake = makeTagHandlers({
                callerId: ME,
                seedTags: [{ id: 'seed-kitchen', authorId: OTHER, label: 'Kitchen', visibility: 'Public' }],
            });
            server.use(...fake.handlers);
            const onCloned = vi.fn();
            renderWithProviders(
                <CloneTagDialog open onOpenChange={vi.fn()} tag={makeTag({ id: 'seed-kitchen' })} onCloned={onCloned} />,
            );
            return { fake, onCloned };
        }

        it('is checked by default, with the visibility choice shown', () => {
            open();
            expect(screen.getByRole('checkbox', { name: 'Keep the tag' })).toBeChecked();
            expect(screen.getByText('Visibility of your copy')).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Create copy' })).toBeInTheDocument();
        });

        it('hides the visibility choice when unchecked, and copies only the words', async () => {
            const { fake, onCloned } = open();
            const user = userEvent.setup();

            await user.click(screen.getByRole('checkbox', { name: 'Keep the tag' }));
            expect(screen.queryByText('Visibility of your copy')).not.toBeInTheDocument();
            expect(screen.queryByRole('radio')).not.toBeInTheDocument();

            await user.click(screen.getByRole('button', { name: 'Copy words' }));

            await waitFor(() => expect(onCloned).toHaveBeenCalledWith({ tag: null, wordCount: 0 }));
            // The request carries no visibility, and no tag was created.
            expect(fake.requests.at(-1)?.body).toEqual({ keepTag: false });
            expect([...fake.store.values()]).toHaveLength(1);
        });

        it('brings the visibility choice back when checked again', async () => {
            open();
            const user = userEvent.setup();
            await user.click(screen.getByRole('checkbox', { name: 'Keep the tag' }));
            await user.click(screen.getByRole('checkbox', { name: 'Keep the tag' }));
            expect(screen.getByText('Visibility of your copy')).toBeInTheDocument();
        });
    });

    it('shows an inline error and stays open when the clone request fails', async () => {
        const fake = makeTagHandlers({
            callerId: ME,
            seedTags: [{ id: 'tag-1', authorId: ME, label: 'Kitchen', visibility: 'Public' }],
        });
        server.use(...fake.handlers);
        const user = userEvent.setup();
        const onOpenChange = vi.fn();

        // The caller already owns this tag — the fake 400s "You already own this tag".
        renderWithProviders(
            <CloneTagDialog open onOpenChange={onOpenChange} tag={makeTag({ author: { id: ME, username: 'kai', badges: [] } })} />,
        );

        await user.click(screen.getByRole('button', { name: 'Create copy' }));
        expect(await screen.findByText('You already own this tag.')).toBeInTheDocument();
        expect(onOpenChange).not.toHaveBeenCalledWith(false);
    });
});
