import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import type { PageSize } from '@/lib/pagination';
import { TablePagination } from './TablePagination';

function setup(props: { page?: number; pageSize?: PageSize; total?: number; disabled?: boolean } = {}) {
    const onPageChange = vi.fn();
    const onPageSizeChange = vi.fn();
    renderWithProviders(
        <TablePagination
            page={props.page ?? 1}
            pageSize={props.pageSize ?? 100}
            total={props.total ?? 1143}
            disabled={props.disabled}
            onPageChange={onPageChange}
            onPageSizeChange={onPageSizeChange}
        />,
    );
    return { onPageChange, onPageSizeChange };
}

describe('TablePagination', () => {
    it('shows the range of the current page', () => {
        setup({ page: 3 });
        expect(screen.getByTestId('pagination-range')).toHaveTextContent('Showing 201–300 of 1143');
    });

    it('marks the current page and goes to a page number', async () => {
        const user = userEvent.setup();
        const { onPageChange } = setup({ page: 1 });

        expect(screen.getByRole('button', { name: 'Page 1' })).toHaveAttribute('aria-current', 'page');
        await user.click(screen.getByRole('button', { name: 'Page 2' }));
        expect(onPageChange).toHaveBeenCalledWith(2);
    });

    it('goes to the previous and next page', async () => {
        const user = userEvent.setup();
        const { onPageChange } = setup({ page: 5 });

        await user.click(screen.getByRole('button', { name: 'Next page' }));
        expect(onPageChange).toHaveBeenLastCalledWith(6);
        await user.click(screen.getByRole('button', { name: 'Previous page' }));
        expect(onPageChange).toHaveBeenLastCalledWith(4);
    });

    it('disables Previous on the first page and Next on the last page', () => {
        setup({ page: 1 });
        expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Next page' })).toBeEnabled();
    });

    it('disables Next on the last page', () => {
        setup({ page: 12 });
        expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Previous page' })).toBeEnabled();
    });

    it('leaves out the page buttons when there is one page, but keeps the size menu', () => {
        setup({ total: 30, pageSize: 50 });
        expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
        expect(screen.getByRole('combobox', { name: 'Rows per page' })).toBeInTheDocument();
    });

    it('has no page buttons for "All"', () => {
        setup({ pageSize: 'all' });
        expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
        expect(screen.getByTestId('pagination-range')).toHaveTextContent('Showing 1–1143 of 1143');
        expect(screen.getByRole('combobox', { name: 'Rows per page' })).toHaveTextContent('All');
    });

    it('says so when there are no rows', () => {
        setup({ total: 0 });
        expect(screen.getByTestId('pagination-range')).toHaveTextContent('No rows');
    });

    it('offers 50, 100, 200 and All, and reports the choice', async () => {
        const user = userEvent.setup();
        const { onPageSizeChange } = setup({ pageSize: 100 });

        await user.click(screen.getByRole('combobox', { name: 'Rows per page' }));
        expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['50', '100', '200', 'All']);

        await user.click(screen.getByRole('option', { name: 'All' }));
        expect(onPageSizeChange).toHaveBeenCalledWith('all');
    });

    it('leaves out the range text in compact mode', () => {
        renderWithProviders(
            <TablePagination page={1} pageSize={50} total={500} compact onPageChange={vi.fn()} onPageSizeChange={vi.fn()} />,
        );
        expect(screen.queryByTestId('pagination-range')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Next page' })).toBeInTheDocument();
    });

    it('disables the page buttons while disabled', () => {
        setup({ page: 2, disabled: true });
        expect(screen.getByRole('button', { name: 'Page 3' })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
    });
});
