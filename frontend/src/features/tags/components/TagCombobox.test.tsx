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

function makeTag(overrides: Partial<TagSummary> & Pick<TagSummary, 'id' | 'label'>): TagSummary {
    return {
        description: null,
        visibility: 'Private',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        author: { id: ME, username: 'kai', badges: [] },
        wordCount: 0,
        followerCount: 0,
        languages: [],
        isOwner: true,
        isFollowing: false,
        isAvailable: true,
        sourceTag: null,
        ...overrides,
    };
}

/** Opens the popover so its options render, then (optionally) types a query. */
async function openAndSearch(user: ReturnType<typeof userEvent.setup>, placeholder: string, query?: string) {
    const input = screen.getByRole('combobox', { name: placeholder });
    await user.click(input);
    if (query) await user.type(input, query);
    return input;
}

describe('TagCombobox — filter mode', () => {
    it('lists owned and followed tags, and picking one calls onSelectedChange', async () => {
        setUp([{ id: 'tag-1', authorId: ME, label: 'Kitchen', visibility: 'Private' }]);
        const onSelectedChange = vi.fn();
        const user = userEvent.setup();
        renderWithProviders(<TagCombobox mode="filter" selected={[]} onSelectedChange={onSelectedChange} />);

        await openAndSearch(user, 'Filter by tag…');
        await user.click(await screen.findByRole('option', { name: /Kitchen/ }));
        expect(onSelectedChange.mock.calls[0][0]).toEqual([expect.objectContaining({ id: 'tag-1', label: 'Kitchen' })]);
    });

    it('shows an unavailable followed tag disabled, and clicking it does not pick it', async () => {
        setUp([{ id: 'tag-1', authorId: OTHER, label: 'Travel', visibility: 'Private', followerIds: [ME] }]);
        const onSelectedChange = vi.fn();
        const user = userEvent.setup();
        renderWithProviders(<TagCombobox mode="filter" selected={[]} onSelectedChange={onSelectedChange} />);

        await openAndSearch(user, 'Filter by tag…');
        const option = await screen.findByRole('option', { name: /Travel/ });
        expect(option).toHaveAttribute('data-disabled', '');
        await user.click(option);
        expect(onSelectedChange).not.toHaveBeenCalled();
    });

    it('shows the disabled tooltip on hover', async () => {
        setUp([{ id: 'tag-1', authorId: OTHER, label: 'Travel', visibility: 'Private', followerIds: [ME] }]);
        const user = userEvent.setup();
        renderWithProviders(<TagCombobox mode="filter" selected={[]} onSelectedChange={vi.fn()} />);

        await openAndSearch(user, 'Filter by tag…');
        const option = await screen.findByRole('option', { name: /Travel/ });
        await user.hover(option);
        expect(await screen.findByText('Unavailable — the owner made it Private')).toBeInTheDocument();
    });

    it('excludes an already-selected tag from the results', async () => {
        const fake = setUp([{ id: 'tag-1', authorId: ME, label: 'Kitchen', visibility: 'Private' }]);
        const selected: TagSummary[] = [makeTag({ id: 'tag-1', label: 'Kitchen' })];
        const user = userEvent.setup();
        renderWithProviders(<TagCombobox mode="filter" selected={selected} onSelectedChange={vi.fn()} />);

        await openAndSearch(user, 'Filter by tag…');
        await waitFor(() => expect(fake.listQueries.length).toBeGreaterThan(0));
        // Only the chip shows "Kitchen" — no matching option underneath it.
        expect(screen.getAllByText('Kitchen')).toHaveLength(1);
        expect(screen.queryByRole('option')).not.toBeInTheDocument();
    });

    it('excludeIds keeps tags chosen elsewhere out of the options, with no chip in the box', async () => {
        const fake = setUp([
            { id: 'tag-1', authorId: ME, label: 'Kitchen', visibility: 'Private' },
            { id: 'tag-2', authorId: ME, label: 'Travel', visibility: 'Private' },
        ]);
        const user = userEvent.setup();
        renderWithProviders(
            <TagCombobox mode="filter" selected={[]} excludeIds={new Set(['tag-1'])} onSelectedChange={vi.fn()} />,
        );

        await openAndSearch(user, 'Filter by tag…');
        await waitFor(() => expect(fake.listQueries.length).toBeGreaterThan(0));
        expect(await screen.findByRole('option', { name: /Travel/ })).toBeInTheDocument();
        expect(screen.queryByRole('option', { name: /Kitchen/ })).not.toBeInTheDocument();
        expect(screen.queryByText('Kitchen')).not.toBeInTheDocument();
    });

    it('no quick-create row in filter mode, even with a non-matching query', async () => {
        setUp();
        const user = userEvent.setup();
        renderWithProviders(<TagCombobox mode="filter" selected={[]} onSelectedChange={vi.fn()} />);

        await openAndSearch(user, 'Filter by tag…', 'Nonexistent');
        await waitFor(() => expect(screen.getByText('No tags match')).toBeInTheDocument());
        expect(screen.queryByText(/Create new tag/)).not.toBeInTheDocument();
    });
});

describe('TagCombobox — add mode', () => {
    it('shows a followed tag disabled with a read-only tooltip', async () => {
        setUp([{ id: 'tag-1', authorId: OTHER, label: 'Travel', visibility: 'Public', followerIds: [ME] }]);
        const user = userEvent.setup();
        renderWithProviders(<TagCombobox mode="add" selected={[]} onSelectedChange={vi.fn()} />);

        await openAndSearch(user, 'Search tags to add…');
        const option = await screen.findByRole('option', { name: /Travel/ });
        expect(option).toHaveAttribute('data-disabled', '');
        await user.hover(option);
        expect(await screen.findByText('Followed tag — read-only, owned by mari')).toBeInTheDocument();
    });

    it('owned tags are pickable', async () => {
        setUp([{ id: 'tag-1', authorId: ME, label: 'Kitchen', visibility: 'Private' }]);
        const onSelectedChange = vi.fn();
        const user = userEvent.setup();
        renderWithProviders(<TagCombobox mode="add" selected={[]} onSelectedChange={onSelectedChange} />);

        await openAndSearch(user, 'Search tags to add…');
        const option = await screen.findByRole('option', { name: /Kitchen/ });
        expect(option).not.toHaveAttribute('data-disabled');
        await user.click(option);
        expect(onSelectedChange.mock.calls[0][0]).toEqual([expect.objectContaining({ id: 'tag-1' })]);
    });

    it('offers an inline "Create new tag" row when the query has no exact match, and creating adds it to selection', async () => {
        const fake = setUp();
        const onSelectedChange = vi.fn();
        const user = userEvent.setup();
        renderWithProviders(<TagCombobox mode="add" selected={[]} onSelectedChange={onSelectedChange} />);

        await openAndSearch(user, 'Search tags to add…', 'Kitchen');
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

        await openAndSearch(user, 'Search tags to add…', 'Kitchen');
        await screen.findByRole('option', { name: /Kitchen/ });
        expect(screen.queryByText(/Create new tag/)).not.toBeInTheDocument();
    });
});

describe('TagCombobox — remove mode', () => {
    it('is scoped to owned tags and further narrowed by restrictToIds', async () => {
        setUp([
            { id: 'tag-1', authorId: ME, label: 'Kitchen', visibility: 'Private' },
            { id: 'tag-2', authorId: ME, label: 'Garage', visibility: 'Private' },
        ]);
        const user = userEvent.setup();
        renderWithProviders(
            <TagCombobox mode="remove" selected={[]} onSelectedChange={vi.fn()} restrictToIds={new Set(['tag-1'])} />,
        );

        await openAndSearch(user, 'Search tags to remove…');
        expect(await screen.findByRole('option', { name: /Kitchen/ })).toBeInTheDocument();
        expect(screen.queryByRole('option', { name: /Garage/ })).not.toBeInTheDocument();
    });

    it("never disables a row (D10 — an own word can only carry the caller's own tags)", async () => {
        setUp([{ id: 'tag-1', authorId: ME, label: 'Kitchen', visibility: 'Private' }]);
        const user = userEvent.setup();
        renderWithProviders(
            <TagCombobox mode="remove" selected={[]} onSelectedChange={vi.fn()} restrictToIds={new Set(['tag-1'])} />,
        );

        await openAndSearch(user, 'Search tags to remove…');
        const option = await screen.findByRole('option', { name: /Kitchen/ });
        expect(option).not.toHaveAttribute('data-disabled');
    });
});

describe('TagCombobox — clear button', () => {
    it('appears once there is a query and resets it', async () => {
        setUp();
        const user = userEvent.setup();
        renderWithProviders(<TagCombobox mode="filter" selected={[]} onSelectedChange={vi.fn()} />);

        expect(screen.queryByRole('button', { name: 'Clear search' })).not.toBeInTheDocument();
        const input = await openAndSearch(user, 'Filter by tag…', 'Kit');
        expect(screen.getByRole('button', { name: 'Clear search' })).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Clear search' }));
        expect(input).toHaveValue('');
    });
});

describe('TagCombobox — selected chips', () => {
    it('shows a removable chip per selected tag, and removing calls onSelectedChange', async () => {
        setUp();
        const onSelectedChange = vi.fn();
        const user = userEvent.setup();
        const selected: TagSummary[] = [makeTag({ id: 'tag-1', label: 'Kitchen' })];
        renderWithProviders(<TagCombobox mode="filter" selected={selected} onSelectedChange={onSelectedChange} />);

        await user.click(screen.getByRole('button', { name: 'Remove Kitchen' }));
        expect(onSelectedChange.mock.calls[0][0]).toEqual([]);
    });
});
