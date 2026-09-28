import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { PartOfSpeech } from '@/ts/enums';
import type { WordSimpleBE } from '@/features/words/types';
import { TagWordsTable, type TagWordsTableProps } from './TagWordsTable';

function makeRow(id: string, label: string, user = 'owner-1'): WordSimpleBE {
    return {
        id,
        user,
        partOfSpeech: PartOfSpeech.verb,
        tags: [],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        storedLanguages: ['English'],
        dataEN: label,
    };
}

const baseProps: TagWordsTableProps = {
    rows: [],
    languages: ['EN'],
    userId: 'owner-1',
    isPending: false,
    isFetchingNextPage: false,
    isError: false,
    error: undefined,
    hasNextPage: false,
    total: 0,
    onFetchNextPage: vi.fn(),
    onRetry: vi.fn(),
    query: '',
    debouncedQuery: '',
    onQueryChange: vi.fn(),
    canRemove: false,
};

describe('TagWordsTable — rendering rows', () => {
    it('renders each row and the word count when not searching', () => {
        renderWithProviders(
            <TagWordsTable {...baseProps} rows={[makeRow('w1', 'run'), makeRow('w2', 'jump')]} total={2} />,
        );
        expect(screen.getByText('run')).toBeInTheDocument();
        expect(screen.getByText('jump')).toBeInTheDocument();
        expect(screen.getByText('2 words')).toBeInTheDocument();
    });

    it('shows a narrowed result count while a search is active', () => {
        renderWithProviders(
            <TagWordsTable {...baseProps} rows={[makeRow('w1', 'run')]} total={5} debouncedQuery="run" query="run" />,
        );
        expect(screen.getByText('1 of 5 words')).toBeInTheDocument();
    });
});

describe('TagWordsTable — remove column', () => {
    it('omits the remove column when canRemove is false', () => {
        renderWithProviders(<TagWordsTable {...baseProps} rows={[makeRow('w1', 'run')]} total={1} canRemove={false} />);
        expect(screen.queryByRole('button', { name: 'Remove from tag' })).not.toBeInTheDocument();
    });

    it('calls onRemove with the word id and its headline label', async () => {
        const onRemove = vi.fn();
        const user = userEvent.setup();
        renderWithProviders(
            <TagWordsTable {...baseProps} rows={[makeRow('w1', 'run')]} total={1} canRemove onRemove={onRemove} />,
        );

        await user.click(screen.getByRole('button', { name: 'Remove from tag' }));
        expect(onRemove).toHaveBeenCalledWith('w1', 'run');
    });
});

describe('TagWordsTable — empty states', () => {
    it('shows the owned empty state with an Add words CTA', async () => {
        const onAddWords = vi.fn();
        const user = userEvent.setup();
        renderWithProviders(<TagWordsTable {...baseProps} canRemove onAddWords={onAddWords} />);

        expect(screen.getByText('Add your first words to this tag')).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Add words' }));
        expect(onAddWords).toHaveBeenCalled();
    });

    it('shows the non-owner empty state with no CTA', () => {
        renderWithProviders(<TagWordsTable {...baseProps} canRemove={false} />);
        expect(screen.getByText('No words here yet')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Add words' })).not.toBeInTheDocument();
    });

    it('shows the search-specific empty state, and clearing calls onQueryChange', async () => {
        const onQueryChange = vi.fn();
        const user = userEvent.setup();
        renderWithProviders(
            <TagWordsTable {...baseProps} query="zzz" debouncedQuery="zzz" onQueryChange={onQueryChange} />,
        );

        expect(screen.getByText('Nothing matches "zzz"')).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Clear search' }));
        expect(onQueryChange).toHaveBeenCalledWith('');
    });
});

describe('TagWordsTable — loading and pagination', () => {
    it('shows a skeleton table while pending', () => {
        const { container } = renderWithProviders(<TagWordsTable {...baseProps} isPending />);
        expect(container.querySelector('[data-slot="skeleton"]')).toBeInTheDocument();
    });

    it('shows Load more when there is a next page, and calls onFetchNextPage', async () => {
        const onFetchNextPage = vi.fn();
        const user = userEvent.setup();
        renderWithProviders(
            <TagWordsTable
                {...baseProps}
                rows={[makeRow('w1', 'run')]}
                total={5}
                hasNextPage
                onFetchNextPage={onFetchNextPage}
            />,
        );

        expect(screen.getByText('Showing 1 of 5 words')).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Load more' }));
        expect(onFetchNextPage).toHaveBeenCalled();
    });
});

describe('TagWordsTable — error state', () => {
    it('shows an error state and retries', async () => {
        const onRetry = vi.fn();
        const user = userEvent.setup();
        renderWithProviders(<TagWordsTable {...baseProps} isError error={new Error('Network down')} onRetry={onRetry} />);

        expect(screen.getByText('Network down')).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Try again' }));
        expect(onRetry).toHaveBeenCalled();
    });
});
