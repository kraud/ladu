import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { server } from '@/test/msw/server';
import { makeTagHandlers, type SeedTag } from '@/test/msw/tagHandlers';
import { TagCombobox } from './TagCombobox';
import type { TagSummary } from '../types';

const ME = 'user-me';
const OTHER = 'user-other';

function setUp(seedTags: SeedTag[] = []) {
    const fake = makeTagHandlers({ callerId: ME, usernames: { [OTHER]: 'mari' }, seedTags });
    server.use(...fake.handlers);
    return fake;
}

describe('TagCombobox — filter mode', () => {
    it('lists owned and followed tags, and picking one calls onSelectedChange', async () => {
        setUp([{ id: 'tag-1', authorId: ME, label: 'Kitchen', visibility: 'Private' }]);
        const onSelectedChange = vi.fn();
        const user = userEvent.setup();
        renderWithProviders(<TagCombobox mode="filter" selected={[]} onSelectedChange={onSelectedChange} />);

        const row = (await screen.findByText('Kitchen')).closest('.pick-row') as HTMLElement;
        await user.click(row);
        expect(onSelectedChange).toHaveBeenCalledWith([expect.objectContaining({ id: 'tag-1', label: 'Kitchen' })]);
    });

    it('shows an unavailable followed tag disabled, and clicking it does not pick it', async () => {
        setUp([
            { id: 'tag-1', authorId: OTHER, label: 'Travel', visibility: 'Private', followerIds: [ME] },
        ]);
        const onSelectedChange = vi.fn();
        const user = userEvent.setup();
        renderWithProviders(<TagCombobox mode="filter" selected={[]} onSelectedChange={onSelectedChange} />);

        const row = (await screen.findByText('Travel')).closest('.pick-row') as HTMLElement;
        expect(row).toHaveAttribute('aria-disabled', 'true');
        await user.click(row);
        expect(onSelectedChange).not.toHaveBeenCalled();
    });

    it('shows the disabled tooltip on hover', async () => {
        setUp([
            { id: 'tag-1', authorId: OTHER, label: 'Travel', visibility: 'Private', followerIds: [ME] },
        ]);
        const user = userEvent.setup();
        renderWithProviders(<TagCombobox mode="filter" selected={[]} onSelectedChange={vi.fn()} />);

        const row = (await screen.findByText('Travel')).closest('.pick-row') as HTMLElement;
        await user.hover(row);
        expect(await screen.findByText('Unavailable — the owner made it Private')).toBeInTheDocument();
    });

    it('excludes an already-selected tag from the results', async () => {
        const fake = setUp([{ id: 'tag-1', authorId: ME, label: 'Kitchen', visibility: 'Private' }]);
        const selected: TagSummary[] = [
            {
                id: 'tag-1',
                label: 'Kitchen',
                description: null,
                visibility: 'Private',
                createdAt: '2026-01-01T00:00:00.000Z',
                updatedAt: '2026-01-01T00:00:00.000Z',
                author: { id: ME, username: 'kai' },
                wordCount: 0,
                followerCount: 0,
                isOwner: true,
                isFollowing: false,
                isAvailable: true,
                sourceTag: null,
            },
        ];
        renderWithProviders(<TagCombobox mode="filter" selected={selected} onSelectedChange={vi.fn()} />);

        await waitFor(() => expect(fake.listQueries.length).toBeGreaterThan(0));
        // Only the pill shows "Kitchen" — no matching pick-row underneath it.
        expect(screen.getAllByText('Kitchen')).toHaveLength(1);
        expect(document.querySelector('.pick-row')).not.toBeInTheDocument();
    });

    it('no quick-create row in filter mode, even with a non-matching query', async () => {
        setUp();
        const user = userEvent.setup();
        renderWithProviders(<TagCombobox mode="filter" selected={[]} onSelectedChange={vi.fn()} />);

        await user.type(screen.getByPlaceholderText('Filter by tag…'), 'Nonexistent');
        await waitFor(() => expect(screen.getByText('No tags match')).toBeInTheDocument());
        expect(screen.queryByText(/Create new tag/)).not.toBeInTheDocument();
    });
});

describe('TagCombobox — add mode', () => {
    it('shows a followed tag disabled with a read-only tooltip', async () => {
        setUp([{ id: 'tag-1', authorId: OTHER, label: 'Travel', visibility: 'Public', followerIds: [ME] }]);
        const user = userEvent.setup();
        renderWithProviders(<TagCombobox mode="add" selected={[]} onSelectedChange={vi.fn()} />);

        const row = (await screen.findByText('Travel')).closest('.pick-row') as HTMLElement;
        expect(row).toHaveAttribute('aria-disabled', 'true');
        await user.hover(row);
        expect(await screen.findByText('Followed tag — read-only, owned by mari')).toBeInTheDocument();
    });

    it('owned tags are pickable', async () => {
        setUp([{ id: 'tag-1', authorId: ME, label: 'Kitchen', visibility: 'Private' }]);
        const onSelectedChange = vi.fn();
        const user = userEvent.setup();
        renderWithProviders(<TagCombobox mode="add" selected={[]} onSelectedChange={onSelectedChange} />);

        const row = (await screen.findByText('Kitchen')).closest('.pick-row') as HTMLElement;
        expect(row).not.toHaveAttribute('aria-disabled');
        await user.click(row);
        expect(onSelectedChange).toHaveBeenCalledWith([expect.objectContaining({ id: 'tag-1' })]);
    });

    it('offers an inline "Create new tag" row when the query has no exact match, and creating adds it to selection', async () => {
        const fake = setUp();
        const onSelectedChange = vi.fn();
        const user = userEvent.setup();
        renderWithProviders(<TagCombobox mode="add" selected={[]} onSelectedChange={onSelectedChange} />);

        await user.type(screen.getByPlaceholderText('Search tags to add…'), 'Kitchen');
        const createRow = await screen.findByText('Create new tag "Kitchen"');
        await user.click(createRow);

        await waitFor(() => expect(onSelectedChange).toHaveBeenCalled());
        expect(onSelectedChange).toHaveBeenCalledWith([expect.objectContaining({ label: 'Kitchen', visibility: 'Private' })]);
        expect(fake.store.size).toBe(1);
    });

    it('does not offer quick-create once an exact-label match exists', async () => {
        setUp([{ id: 'tag-1', authorId: ME, label: 'Kitchen', visibility: 'Private' }]);
        const user = userEvent.setup();
        renderWithProviders(<TagCombobox mode="add" selected={[]} onSelectedChange={vi.fn()} />);

        await user.type(screen.getByPlaceholderText('Search tags to add…'), 'Kitchen');
        await screen.findByText('Kitchen');
        expect(screen.queryByText(/Create new tag/)).not.toBeInTheDocument();
    });
});

describe('TagCombobox — remove mode', () => {
    it('is scoped to owned tags and further narrowed by restrictToIds', async () => {
        setUp([
            { id: 'tag-1', authorId: ME, label: 'Kitchen', visibility: 'Private' },
            { id: 'tag-2', authorId: ME, label: 'Garage', visibility: 'Private' },
        ]);
        renderWithProviders(
            <TagCombobox mode="remove" selected={[]} onSelectedChange={vi.fn()} restrictToIds={new Set(['tag-1'])} />,
        );

        expect(await screen.findByText('Kitchen')).toBeInTheDocument();
        expect(screen.queryByText('Garage')).not.toBeInTheDocument();
    });

    it('never disables a row (D10 — an own word can only carry the caller\'s own tags)', async () => {
        setUp([{ id: 'tag-1', authorId: ME, label: 'Kitchen', visibility: 'Private' }]);
        renderWithProviders(
            <TagCombobox mode="remove" selected={[]} onSelectedChange={vi.fn()} restrictToIds={new Set(['tag-1'])} />,
        );

        const row = (await screen.findByText('Kitchen')).closest('.pick-row') as HTMLElement;
        expect(row).not.toHaveAttribute('aria-disabled');
    });
});

describe('TagCombobox — clear button', () => {
    it('appears once there is a query and resets it', async () => {
        setUp();
        const user = userEvent.setup();
        renderWithProviders(<TagCombobox mode="filter" selected={[]} onSelectedChange={vi.fn()} />);

        expect(screen.queryByRole('button', { name: 'Clear search' })).not.toBeInTheDocument();
        const input = screen.getByPlaceholderText('Filter by tag…');
        await user.type(input, 'Kit');
        expect(screen.getByRole('button', { name: 'Clear search' })).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Clear search' }));
        expect(input).toHaveValue('');
    });
});

describe('TagCombobox — selected pills', () => {
    it('shows a removable pill per selected tag, and removing calls onSelectedChange', async () => {
        setUp();
        const onSelectedChange = vi.fn();
        const user = userEvent.setup();
        const selected: TagSummary[] = [
            {
                id: 'tag-1',
                label: 'Kitchen',
                description: null,
                visibility: 'Private',
                createdAt: '2026-01-01T00:00:00.000Z',
                updatedAt: '2026-01-01T00:00:00.000Z',
                author: { id: ME, username: 'kai' },
                wordCount: 0,
                followerCount: 0,
                isOwner: true,
                isFollowing: false,
                isAvailable: true,
                sourceTag: null,
            },
        ];
        renderWithProviders(<TagCombobox mode="filter" selected={selected} onSelectedChange={onSelectedChange} />);

        await user.click(screen.getByRole('button', { name: 'Remove Kitchen' }));
        expect(onSelectedChange).toHaveBeenCalledWith([]);
    });
});
