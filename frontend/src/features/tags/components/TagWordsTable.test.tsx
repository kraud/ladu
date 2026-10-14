import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { mockMobileViewport } from '@/test/viewport';
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
    isFetching: false,
    isError: false,
    error: undefined,
    total: 0,
    page: 1,
    pageSize: 50,
    onPageChange: vi.fn(),
    onPageSizeChange: vi.fn(),
    onRetry: vi.fn(),
    query: '',
    debouncedQuery: '',
    onQueryChange: vi.fn(),
    canRemove: false,
    removeMode: false,
    onRemoveModeChange: vi.fn(),
    showGender: true,
    showProgress: false,
    showOwner: false,
    showPos: true,
    userName: 'Owner',
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

    it('shows the number of results while a search is active (all pages, not the page on screen)', () => {
        renderWithProviders(
            <TagWordsTable {...baseProps} rows={[makeRow('w1', 'run')]} total={5} debouncedQuery="run" query="run" />,
        );
        expect(screen.getByText('5 results')).toBeInTheDocument();
    });

    it('says "1 result" for a single match', () => {
        renderWithProviders(
            <TagWordsTable {...baseProps} rows={[makeRow('w1', 'run')]} total={1} debouncedQuery="run" query="run" />,
        );
        expect(screen.getByText('1 result')).toBeInTheDocument();
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

describe('TagWordsTable — remove mode', () => {
    it('is absent when canRemove is false, remove mode or not', () => {
        renderWithProviders(<TagWordsTable {...baseProps} rows={[makeRow('w1', 'run')]} total={1} canRemove={false} removeMode />);
        expect(screen.queryByRole('button', { name: 'Remove from tag' })).not.toBeInTheDocument();
    });

    it('is absent for an owned tag outside remove mode', () => {
        renderWithProviders(
            <TagWordsTable {...baseProps} rows={[makeRow('w1', 'run')]} total={1} canRemove removeMode={false} />,
        );
        expect(screen.queryByRole('button', { name: 'Remove from tag' })).not.toBeInTheDocument();
    });

    it('is an icon-only button in remove mode, in the first column, and calls onRemove', async () => {
        const onRemove = vi.fn();
        const user = userEvent.setup();
        renderWithProviders(
            <TagWordsTable {...baseProps} rows={[makeRow('w1', 'run')]} total={1} canRemove removeMode onRemove={onRemove} />,
        );

        const removeButton = screen.getByRole('button', { name: 'Remove from tag' });
        expect(removeButton).not.toHaveTextContent('Remove from tag');
        // First column: always in view, however many language columns follow.
        expect(removeButton.closest('td')).toBe(removeButton.closest('tr')!.firstElementChild);
        await user.click(removeButton);
        expect(onRemove).toHaveBeenCalledWith('w1', 'run');
    });
});

describe('TagWordsTable — cell add affordance', () => {
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

    it('shows a dash instead of "+" for an empty own cell on a tag that is not owned', () => {
        renderWithProviders(
            <TagWordsTable {...baseProps} rows={[ownWordWithNoEnglish()]} total={1} userId="owner-1" canRemove={false} />,
        );
        expect(screen.queryByRole('button', { name: /Add.*translation/i })).not.toBeInTheDocument();
    });

    it('shows the "+" add-translation button on an owned tag', () => {
        renderWithProviders(
            <TagWordsTable {...baseProps} rows={[ownWordWithNoEnglish()]} total={1} userId="owner-1" canRemove />,
        );
        expect(screen.getByRole('button', { name: /Add.*translation/i })).toBeInTheDocument();
    });
});

describe('TagWordsTable — toolbar buttons', () => {
    const rows = [makeRow('w1', 'run')];

    it('shows Add words and Remove words next to the search for an owned tag', () => {
        renderWithProviders(<TagWordsTable {...baseProps} rows={rows} total={1} canRemove onAddWords={vi.fn()} />);
        expect(screen.getByRole('button', { name: 'Add words' })).toBeEnabled();
        expect(screen.getByRole('button', { name: 'Remove words' })).toBeEnabled();
    });

    it('shows neither on a tag that is not owned', () => {
        renderWithProviders(<TagWordsTable {...baseProps} rows={rows} total={1} canRemove={false} />);
        expect(screen.queryByRole('button', { name: 'Add words' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Remove words' })).not.toBeInTheDocument();
    });

    it('Remove words asks to turn remove mode on', async () => {
        const onRemoveModeChange = vi.fn();
        const user = userEvent.setup();
        renderWithProviders(
            <TagWordsTable {...baseProps} rows={rows} total={1} canRemove onRemoveModeChange={onRemoveModeChange} />,
        );
        await user.click(screen.getByRole('button', { name: 'Remove words' }));
        expect(onRemoveModeChange).toHaveBeenCalledWith(true);
    });

    it('in remove mode the button reads Cancel and Add words is disabled', async () => {
        const onRemoveModeChange = vi.fn();
        const user = userEvent.setup();
        renderWithProviders(
            <TagWordsTable {...baseProps} rows={rows} total={1} canRemove removeMode onRemoveModeChange={onRemoveModeChange} />,
        );
        expect(screen.queryByRole('button', { name: 'Remove words' })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Add words' })).toBeDisabled();
        await user.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(onRemoveModeChange).toHaveBeenCalledWith(false);
    });

    it('disables Remove words when the tag has no words', () => {
        renderWithProviders(<TagWordsTable {...baseProps} rows={[]} total={0} canRemove onAddWords={vi.fn()} />);
        expect(screen.getByRole('button', { name: 'Remove words' })).toBeDisabled();
    });
});

describe('TagWordsTable — display options', () => {
    it('shows the owner dot and the Type column only while their switches are on', () => {
        const rows = [makeRow('w1', 'run', 'owner-1', PartOfSpeech.verb)];
        const { container, rerender } = renderWithProviders(
            <TagWordsTable {...baseProps} rows={rows} total={1} showOwner showPos />,
        );
        expect(container.querySelector('.owner-dot')).toBeInTheDocument();
        expect(container.querySelector('.pos-abbr')).toBeInTheDocument();

        rerender(<TagWordsTable {...baseProps} rows={rows} total={1} showOwner={false} showPos={false} />);
        expect(container.querySelector('.owner-dot')).not.toBeInTheDocument();
        expect(container.querySelector('.pos-abbr')).not.toBeInTheDocument();
    });

    it('renders `leading` before the search box', () => {
        renderWithProviders(<TagWordsTable {...baseProps} rows={[makeRow('w1', 'run')]} total={1} leading={<button type="button">Lead</button>} />);
        const lead = screen.getByRole('button', { name: 'Lead' });
        const search = screen.getByRole('textbox');
        expect(lead.compareDocumentPosition(search) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
});

describe('TagWordsTable — empty states', () => {
    it('shows the owned empty state with an Add words CTA', async () => {
        const onAddWords = vi.fn();
        const user = userEvent.setup();
        renderWithProviders(<TagWordsTable {...baseProps} canRemove onAddWords={onAddWords} />);

        expect(screen.getByText('Add your first words to this tag')).toBeInTheDocument();
        await user.click(screen.getAllByRole('button', { name: 'Add words' }).at(-1)!); // toolbar + empty-state CTA
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

    it('shows the range of the page and the page buttons, and no Load more', () => {
        renderWithProviders(<TagWordsTable {...baseProps} rows={[makeRow('w1', 'run')]} total={120} page={2} />);

        expect(screen.getByTestId('pagination-range')).toHaveTextContent('Showing 51–100 of 120');
        expect(screen.getByRole('button', { name: 'Page 2' })).toHaveAttribute('aria-current', 'page');
        expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
    });

    it('calls onPageChange for Next and for a page number', async () => {
        const onPageChange = vi.fn();
        const user = userEvent.setup();
        renderWithProviders(
            <TagWordsTable {...baseProps} rows={[makeRow('w1', 'run')]} total={120} onPageChange={onPageChange} />,
        );

        await user.click(screen.getByRole('button', { name: 'Next page' }));
        expect(onPageChange).toHaveBeenLastCalledWith(2);
        await user.click(screen.getByRole('button', { name: 'Page 3' }));
        expect(onPageChange).toHaveBeenLastCalledWith(3);
    });

    it('calls onPageSizeChange from the Rows per page menu', async () => {
        const onPageSizeChange = vi.fn();
        const user = userEvent.setup();
        renderWithProviders(
            <TagWordsTable {...baseProps} rows={[makeRow('w1', 'run')]} total={120} onPageSizeChange={onPageSizeChange} />,
        );

        await user.click(screen.getByRole('combobox', { name: 'Rows per page' }));
        await user.click(await screen.findByRole('option', { name: 'All' }));
        expect(onPageSizeChange).toHaveBeenCalledWith('all');
    });

    it('dims the rows while the next page loads', () => {
        const { container } = renderWithProviders(
            <TagWordsTable {...baseProps} rows={[makeRow('w1', 'run')]} total={120} isFetching />,
        );
        expect(container.querySelector('.tablewrap')).toHaveAttribute('aria-busy', 'true');
    });

    it('is not the empty state for a page past the last one', () => {
        renderWithProviders(<TagWordsTable {...baseProps} rows={[]} total={120} page={9} />);
        expect(screen.queryByText('No words here yet')).not.toBeInTheDocument();
        expect(screen.getByTestId('pagination-range')).toBeInTheDocument();
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

describe('TagWordsTable — phone', () => {
    it('keeps Add/Remove words on one row', () => {
        mockMobileViewport();
        renderWithProviders(
            <TagWordsTable {...baseProps} rows={[makeRow('w1', 'run')]} total={1} canRemove onAddWords={vi.fn()} />,
        );
        const add = screen.getByRole('button', { name: 'Add words' });
        const remove = screen.getByRole('button', { name: 'Remove words' });
        expect(add.parentElement).toBe(remove.parentElement);
    });
});
