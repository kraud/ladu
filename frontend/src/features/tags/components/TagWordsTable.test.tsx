import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { PartOfSpeech } from '@/ts/enums';
import type { WordSimpleBE } from '@/features/words/types';
import { TagWordsTable, type TagWordsTableProps } from './TagWordsTable';

function makeRow(id: string, label: string, user = 'owner-1', pos = PartOfSpeech.verb): WordSimpleBE {
    return {
        id,
        user,
        partOfSpeech: pos,
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
    editMode: false,
    showGender: true,
    onShowGenderChange: vi.fn(),
    showProgress: false,
    onShowProgressChange: vi.fn(),
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

    it('gives every language column an equal share of the table width', () => {
        const { container } = renderWithProviders(
            <TagWordsTable {...baseProps} rows={[makeRow('w1', 'run')]} total={1} languages={['EN', 'DE', 'ES']} />,
        );
        const langHeaders = container.querySelectorAll('th.lang-col');
        expect(langHeaders).toHaveLength(3);
        langHeaders.forEach((th) => {
            expect((th as HTMLElement).style.width).toBe(`${100 / 3}%`);
        });
    });
});

describe('TagWordsTable — remove column requires edit mode', () => {
    it('is absent when canRemove is false, edit mode or not', () => {
        renderWithProviders(<TagWordsTable {...baseProps} rows={[makeRow('w1', 'run')]} total={1} canRemove={false} editMode />);
        expect(screen.queryByRole('button', { name: 'Remove from tag' })).not.toBeInTheDocument();
    });

    it('is absent for an owned tag outside edit mode', () => {
        renderWithProviders(
            <TagWordsTable {...baseProps} rows={[makeRow('w1', 'run')]} total={1} canRemove editMode={false} />,
        );
        expect(screen.queryByRole('button', { name: 'Remove from tag' })).not.toBeInTheDocument();
    });

    it('is an icon-only button once canRemove and editMode are both true, and calls onRemove', async () => {
        const onRemove = vi.fn();
        const user = userEvent.setup();
        renderWithProviders(
            <TagWordsTable {...baseProps} rows={[makeRow('w1', 'run')]} total={1} canRemove editMode onRemove={onRemove} />,
        );

        const removeButton = screen.getByRole('button', { name: 'Remove from tag' });
        expect(removeButton).not.toHaveTextContent('Remove from tag');
        await user.click(removeButton);
        expect(onRemove).toHaveBeenCalledWith('w1', 'run');
    });
});

describe('TagWordsTable — cell add affordance requires edit mode', () => {
    /** No stored translation at all for EN — `hasTranslation` reads `storedLanguages`, not `dataEN`. */
    function ownWordWithNoEnglish(): WordSimpleBE {
        return {
            id: 'w1',
            user: 'owner-1',
            partOfSpeech: PartOfSpeech.noun,
            tags: [],
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
            storedLanguages: [],
        };
    }

    it('shows a dash instead of "+" for an empty own cell outside edit mode', () => {
        renderWithProviders(
            <TagWordsTable {...baseProps} rows={[ownWordWithNoEnglish()]} total={1} userId="owner-1" editMode={false} />,
        );
        expect(screen.queryByRole('button', { name: /Add.*translation/i })).not.toBeInTheDocument();
    });

    it('shows the "+" add-translation button once editMode is on', () => {
        renderWithProviders(
            <TagWordsTable {...baseProps} rows={[ownWordWithNoEnglish()]} total={1} userId="owner-1" editMode />,
        );
        expect(screen.getByRole('button', { name: /Add.*translation/i })).toBeInTheDocument();
    });
});

describe('TagWordsTable — display options', () => {
    it('shows the Display progress switch, and the gender switch only once a noun row is loaded', () => {
        const { rerender } = renderWithProviders(
            <TagWordsTable {...baseProps} rows={[makeRow('w1', 'run', 'owner-1', PartOfSpeech.verb)]} total={1} />,
        );
        expect(screen.getByText('Display progress')).toBeInTheDocument();
        expect(screen.queryByText('Display gender')).not.toBeInTheDocument();

        rerender(<TagWordsTable {...baseProps} rows={[makeRow('w1', 'tree', 'owner-1', PartOfSpeech.noun)]} total={1} />);
        expect(screen.getByText('Display gender')).toBeInTheDocument();
    });

    it('calls the change handlers when a switch is toggled', async () => {
        const onShowGenderChange = vi.fn();
        const user = userEvent.setup();
        renderWithProviders(
            <TagWordsTable
                {...baseProps}
                rows={[makeRow('w1', 'tree', 'owner-1', PartOfSpeech.noun)]}
                total={1}
                onShowGenderChange={onShowGenderChange}
            />,
        );

        await user.click(screen.getByText('Display gender'));
        expect(onShowGenderChange).toHaveBeenCalledWith(false);
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
