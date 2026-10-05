import { useState } from 'react';
import { screen, within } from '@testing-library/react';
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
    showOwner: true,
    showPos: true,
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
        // select, owner, type, DE, EN
        expect(headers[3]).toContain('DE');
        expect(headers[4]).toContain('EN');
    });

    it('marks the select, owner and Type columns `.shrink-col` so none takes width the language columns need', () => {
        renderWithProviders(<ReviewTable {...baseProps} rows={[makeRow()]} />);
        const headers = screen.getAllByRole('columnheader');
        for (const index of [0, 1, 2]) {
            expect(headers[index]).toHaveClass('shrink-col');
            expect(document.querySelector(`tbody tr td:nth-child(${index + 1})`)).toHaveClass('shrink-col');
        }
    });

    it('leaves out the owner and Type columns when their switches are off', () => {
        renderWithProviders(<ReviewTable {...baseProps} rows={[makeRow()]} showOwner={false} showPos={false} />);
        // select, EN, DE, Tags
        expect(screen.getAllByRole('columnheader')).toHaveLength(4);
        expect(document.querySelector('.owner-dot')).not.toBeInTheDocument();
        expect(document.querySelector('.pos-abbr')).not.toBeInTheDocument();
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

describe('ReviewTable — phone selection (compact)', () => {
    const rows = [makeRow({ id: 'a', dataEN: 'apple', storedLanguages: ['English'] }), makeRow({ id: 'b', dataEN: 'bread', storedLanguages: ['English'] })];

    async function longPress(user: ReturnType<typeof userEvent.setup>, target: Element) {
        await user.pointer({ keys: '[MouseLeft>]', target });
        await new Promise((resolve) => setTimeout(resolve, 600));
        await user.pointer({ keys: '[/MouseLeft]', target });
    }

    it('has no checkboxes', () => {
        renderWithProviders(<ReviewTable {...baseProps} rows={rows} compact />);
        expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    });

    it('a long press selects the first row, then a tap selects another and a tap on a selected one unselects it', async () => {
        const user = userEvent.setup();
        renderWithProviders(<ControlledTable {...baseProps} rows={rows} compact />);
        const [first, second] = Array.from(document.querySelectorAll('tbody tr'));

        await longPress(user, first!);
        expect(first).toHaveClass('selected');
        expect(second).not.toHaveClass('selected');

        await user.click(second!);
        expect(second).toHaveClass('selected');

        await user.click(second!);
        expect(second).not.toHaveClass('selected');
        expect(first).toHaveClass('selected');
    });

    it('a short tap with nothing selected does not select', async () => {
        const user = userEvent.setup();
        renderWithProviders(<ControlledTable {...baseProps} rows={rows} compact />);
        const [first] = Array.from(document.querySelectorAll('tbody tr'));

        await user.click(first!);
        expect(first).not.toHaveClass('selected');
    });

    it('a tap while selecting does not open the cell', async () => {
        const onOpenCell = vi.fn();
        const user = userEvent.setup();
        renderWithProviders(<ControlledTable {...baseProps} rows={rows} compact onOpenCell={onOpenCell} />);
        const [first, second] = Array.from(document.querySelectorAll('tbody tr'));

        await longPress(user, first!);
        await user.click(within(second as HTMLElement).getByRole('button', { name: /bread/ }));

        expect(onOpenCell).not.toHaveBeenCalled();
        expect(second).toHaveClass('selected');
    });
});

describe('ReviewTable — loading state', () => {
    it('renders skeleton rows matching the column count while pending', () => {
        renderWithProviders(<ReviewTable {...baseProps} isPending rows={[]} languages={['EN', 'DE']} />);
        // 8 skeleton rows x 6 columns (select, owner, type, EN, DE, Tags).
        expect(document.querySelectorAll('tbody tr').length).toBe(8);
        expect(document.querySelectorAll('tbody tr:first-child td').length).toBe(6);
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

describe('ReviewTable — Tags column (D1/D7/D14)', () => {
    const tag = (id: string, label: string, visibility: 'Public' | 'Private' = 'Public') => ({
        id,
        label,
        visibility,
        authorId: 'me',
    });

    it('is the last column, marked shrink-col', () => {
        renderWithProviders(<ReviewTable {...baseProps} rows={[makeRow()]} languages={['EN']} />);
        const headers = screen.getAllByRole('columnheader');
        expect(headers.at(-1)).toHaveTextContent('Tags');
        expect(headers.at(-1)).toHaveClass('shrink-col');
    });

    it('shows nothing for a word of someone else without tags, and an add button for an own word', () => {
        renderWithProviders(
            <ReviewTable
                {...baseProps}
                rows={[makeRow({ id: 'a', user: 'me', tags: [] }), makeRow({ id: 'b', user: 'other', tags: [] })]}
            />,
        );
        const cells = document.querySelectorAll<HTMLElement>('tbody tr td:last-child');
        expect(within(cells[0]!).getByRole('button', { name: 'Add tags to this word' })).toBeInTheDocument();
        expect(cells[1]).toBeEmptyDOMElement();
    });

    it('shows only the newest tag (the first) and a "+N" badge in one row', () => {
        renderWithProviders(
            <ReviewTable
                {...baseProps}
                rows={[makeRow({ tags: [tag('t1', 'Kitchen'), tag('t2', 'Exam prep'), tag('t3', 'Chapter 1')] })]}
            />,
        );
        expect(screen.getByText('Kitchen')).toBeInTheDocument();
        expect(screen.queryByText('Exam prep')).not.toBeInTheDocument();
        expect(screen.queryByText('Chapter 1')).not.toBeInTheDocument();
        expect(screen.getByText('+2')).toBeInTheDocument();
    });

    it('shows no "+N" with a single tag', () => {
        renderWithProviders(<ReviewTable {...baseProps} rows={[makeRow({ tags: [tag('t1', 'Kitchen')] })]} />);
        expect(screen.queryByText(/^\+/)).not.toBeInTheDocument();
    });

    it('shows a lock icon on a Private tag chip', () => {
        renderWithProviders(
            <ReviewTable {...baseProps} rows={[makeRow({ tags: [tag('t1', 'Medical', 'Private')] })]} />,
        );
        const chip = screen.getByText('Medical').closest('.tagchip') as HTMLElement;
        expect(chip.querySelector('svg')).toBeInTheDocument();
    });

    it('a click anywhere on the cell opens the tags dialog of that word', async () => {
        const onOpenTags = vi.fn();
        const user = userEvent.setup();
        renderWithProviders(
            <ReviewTable
                {...baseProps}
                rows={[makeRow({ id: 'w9', tags: [tag('t1', 'Kitchen'), tag('t2', 'Garage')] })]}
                onOpenTags={onOpenTags}
            />,
        );
        await user.click(screen.getByText('+1'));
        expect(onOpenTags).toHaveBeenCalledWith('w9');
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
