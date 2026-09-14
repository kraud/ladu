import { useState } from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { RowSelectionState } from '@tanstack/react-table';
import { renderWithProviders } from '@/test/render';
import { PartOfSpeech } from '@/ts/enums';
import type { LangKey, WordSimpleBE } from '@/features/words/types';
import { ReviewTable, type ReviewTableProps } from './ReviewTable';

function makeRow(overrides: Partial<WordSimpleBE> = {}): WordSimpleBE {
    return {
        id: 'word-1',
        user: 'me',
        partOfSpeech: PartOfSpeech.verb,
        tags: [],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        storedLanguages: [],
        ...overrides,
    };
}

const baseProps: ReviewTableProps = {
    rows: [],
    languages: ['EN', 'DE'],
    userId: 'me',
    userName: 'Kai Rebane',
    showGender: true,
    showProgress: true,
    isPending: false,
    isFetchingNextPage: false,
    isError: false,
    error: undefined,
    hasNextPage: false,
    total: 0,
    onFetchNextPage: vi.fn(),
    onRetry: vi.fn(),
    rowSelection: {},
    onRowSelectionChange: vi.fn(),
    hasActiveFilters: false,
    onClearFilters: vi.fn(),
    onAddWord: vi.fn(),
};

/** Wraps ReviewTable with locally-owned selection state, for the "survives a data replace" test. */
function ControlledTable(props: Omit<ReviewTableProps, 'rowSelection' | 'onRowSelectionChange'>) {
    const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
    return <ReviewTable {...props} rowSelection={rowSelection} onRowSelectionChange={setRowSelection} />;
}

describe('ReviewTable — headers', () => {
    it('renders one language column per entry, in order', () => {
        renderWithProviders(
            <ReviewTable {...baseProps} rows={[makeRow()]} languages={['DE', 'EN'] as LangKey[]} />,
        );
        const headers = screen.getAllByRole('columnheader').map((h) => h.textContent);
        // select, type, DE, EN
        expect(headers[2]).toContain('DE');
        expect(headers[3]).toContain('EN');
    });

    it('marks the select and Type columns `.shrink-col` so neither takes width the language columns need', () => {
        renderWithProviders(<ReviewTable {...baseProps} rows={[makeRow()]} />);
        const headers = screen.getAllByRole('columnheader');
        expect(headers[0]).toHaveClass('shrink-col');
        expect(headers[1]).toHaveClass('shrink-col');
        const selectCell = document.querySelector('tbody tr td:nth-child(1)');
        const typeCell = document.querySelector('tbody tr td:nth-child(2)');
        expect(selectCell).toHaveClass('shrink-col');
        expect(typeCell).toHaveClass('shrink-col');
    });
});

describe('ReviewTable — selection', () => {
    it('survives a data replace (stable-id selection via getRowId)', async () => {
        const user = userEvent.setup();
        const row = makeRow({ id: 'word-a', dataEN: 'a' });
        const { rerender } = renderWithProviders(<ControlledTable {...baseProps} rows={[row]} />);

        const checkboxes = screen.getAllByRole('checkbox');
        await user.click(checkboxes[1]); // row checkbox (index 0 is select-all)
        expect(checkboxes[1]).toBeChecked();

        // A fresh array/object instance for the same word id (e.g. a refetch).
        const replacedRow = { ...row, dataEN: 'a' };
        rerender(<ControlledTable {...baseProps} rows={[replacedRow]} />);

        const afterCheckboxes = screen.getAllByRole('checkbox');
        expect(afterCheckboxes[1]).toBeChecked();
    });

    it('disables the checkbox for a row the caller does not own', () => {
        // Base UI's Checkbox renders `role="checkbox"` on a <span>, not a
        // native <input>/<button> — `disabled` is exposed via aria/data
        // attributes rather than the DOM `disabled` property.
        const row = makeRow({ id: 'word-b', user: 'someone-else', dataEN: 'b' });
        renderWithProviders(<ReviewTable {...baseProps} rows={[row]} userId="me" />);

        const checkboxes = screen.getAllByRole('checkbox');
        expect(checkboxes[1]).toHaveAttribute('aria-disabled', 'true');
        expect(checkboxes[1]).toHaveAttribute('data-disabled');
    });
});

describe('ReviewTable — loading state', () => {
    it('renders skeleton rows matching the column count while pending', () => {
        renderWithProviders(<ReviewTable {...baseProps} isPending rows={[]} languages={['EN', 'DE']} />);
        // 8 skeleton rows x 4 columns (select, type, EN, DE) = 32 skeleton cells.
        expect(document.querySelectorAll('tbody tr').length).toBe(8);
        expect(document.querySelectorAll('tbody tr:first-child td').length).toBe(4);
    });
});

describe('ReviewTable — empty states', () => {
    it('shows the "no words yet" state with no active filters', () => {
        renderWithProviders(<ReviewTable {...baseProps} rows={[]} hasActiveFilters={false} />);
        expect(screen.getByText('No words yet')).toBeInTheDocument();
        expect(screen.getByText('Add a word')).toBeInTheDocument();
    });

    it('shows the "no matches" state with active filters, and Clear filters calls back', async () => {
        const onClearFilters = vi.fn();
        const user = userEvent.setup();
        renderWithProviders(
            <ReviewTable {...baseProps} rows={[]} hasActiveFilters onClearFilters={onClearFilters} />,
        );

        expect(screen.getByText('No words match your filters')).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Clear filters' }));
        expect(onClearFilters).toHaveBeenCalled();
    });

    it('shows the error state and Try again calls onRetry', async () => {
        const onRetry = vi.fn();
        const user = userEvent.setup();
        renderWithProviders(<ReviewTable {...baseProps} isError error={new Error('boom')} onRetry={onRetry} />);

        await user.click(screen.getByRole('button', { name: 'Try again' }));
        expect(onRetry).toHaveBeenCalled();
    });
});

describe('ReviewTable — Load more', () => {
    it('is hidden when there is no next page', () => {
        renderWithProviders(<ReviewTable {...baseProps} rows={[makeRow()]} hasNextPage={false} />);
        expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
    });

    it('is shown and calls onFetchNextPage when there is a next page', async () => {
        const onFetchNextPage = vi.fn();
        const user = userEvent.setup();
        renderWithProviders(
            <ReviewTable
                {...baseProps}
                rows={[makeRow()]}
                hasNextPage
                total={5}
                onFetchNextPage={onFetchNextPage}
            />,
        );

        const button = screen.getByRole('button', { name: 'Load more' });
        await user.click(button);
        expect(onFetchNextPage).toHaveBeenCalled();
    });
});
