import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { BulkActionBar } from './BulkActionBar';

describe('BulkActionBar', () => {
    it('renders nothing at zero selection', () => {
        const { container } = renderWithProviders(
            <BulkActionBar selectedCount={0} onView={vi.fn()} onDelete={vi.fn()} />,
        );
        expect(container).toBeEmptyDOMElement();
    });

    it('shows the count and disables View unless exactly one is selected', () => {
        renderWithProviders(<BulkActionBar selectedCount={3} onView={vi.fn()} onDelete={vi.fn()} />);
        expect(screen.getByText('3')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'View' })).toBeDisabled();
    });

    it('enables View at exactly one selection, and it calls back', async () => {
        const onView = vi.fn();
        const user = userEvent.setup();
        renderWithProviders(<BulkActionBar selectedCount={1} onView={onView} onDelete={vi.fn()} />);

        const viewButton = screen.getByRole('button', { name: 'View' });
        expect(viewButton).toBeEnabled();
        await user.click(viewButton);
        expect(onView).toHaveBeenCalled();
    });

    it('Delete opens a confirm dialog; confirming calls onDelete', async () => {
        const onDelete = vi.fn();
        const user = userEvent.setup();
        renderWithProviders(<BulkActionBar selectedCount={2} onView={vi.fn()} onDelete={onDelete} />);

        await user.click(screen.getByRole('button', { name: 'Delete' }));
        expect(onDelete).not.toHaveBeenCalled();
        expect(screen.getByText('Delete 2 words?')).toBeInTheDocument();

        // Two "Delete" buttons now exist: the bulk bar's own, and the dialog's
        // confirm action (`confirmLabel` reuses the same copy) — the dialog's
        // is the one that renders second.
        const deleteButtons = screen.getAllByRole('button', { name: 'Delete' });
        await user.click(deleteButtons[deleteButtons.length - 1]);
        expect(onDelete).toHaveBeenCalled();
    });

    it('Cancel leaves the selection untouched', async () => {
        const onDelete = vi.fn();
        const user = userEvent.setup();
        renderWithProviders(<BulkActionBar selectedCount={1} onView={vi.fn()} onDelete={onDelete} />);

        await user.click(screen.getByRole('button', { name: 'Delete' }));
        await user.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(onDelete).not.toHaveBeenCalled();
        expect(screen.queryByText('Delete 1 word?')).not.toBeInTheDocument();
    });
});
