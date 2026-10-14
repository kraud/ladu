import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { server } from '@/test/msw/server';
import { makeTagHandlers, type SeedTag } from '@/test/msw/tagHandlers';
import { futureToken } from '@/test/tokens';
import { BulkActionBar, type BulkActionBarProps } from './BulkActionBar';

const ME = 'u1';
const SESSION = {
    id: ME,
    name: 'Kai Rebane',
    email: 'kai@example.com',
    username: 'kai',
    languages: ['English'],
    uiLanguage: 'English',
    nativeLanguage: null,
    verified: true,
    token: futureToken(),
};

const baseProps: BulkActionBarProps = {
    selectedCount: 0,
    selectedWordIds: [],
    canEdit: true,
    onView: vi.fn(),
    onPractice: vi.fn(),
    onDelete: vi.fn(),
    onTagsApplied: vi.fn(),
};

function setUpTags(seedTags: SeedTag[] = []) {
    const fake = makeTagHandlers({ callerId: ME, seedTags });
    server.use(...fake.handlers);
    return fake;
}

describe('BulkActionBar', () => {
    it('renders nothing at zero selection', () => {
        const { container } = renderWithProviders(<BulkActionBar {...baseProps} />);
        expect(container).toBeEmptyDOMElement();
    });

    it('shows the count and leaves View out unless exactly one is selected', () => {
        renderWithProviders(<BulkActionBar {...baseProps} selectedCount={3} />);
        expect(screen.getByText('3')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'View' })).not.toBeInTheDocument();
    });

    it('has no Remove tags button', () => {
        renderWithProviders(<BulkActionBar {...baseProps} selectedCount={2} />);
        expect(screen.queryByRole('button', { name: 'Remove tags' })).not.toBeInTheDocument();
    });

    it('shows Unselect only when it can clear (phone), and it calls back', async () => {
        const onClear = vi.fn();
        const user = userEvent.setup();
        const { rerender } = renderWithProviders(<BulkActionBar {...baseProps} selectedCount={2} />);
        expect(screen.queryByRole('button', { name: 'Unselect' })).not.toBeInTheDocument();

        rerender(<BulkActionBar {...baseProps} selectedCount={2} onClear={onClear} />);
        await user.click(screen.getByRole('button', { name: 'Unselect' }));
        expect(onClear).toHaveBeenCalled();
    });

    it('without canEdit, hides Add tags and Delete and shows the hint; Practice stays', () => {
        renderWithProviders(<BulkActionBar {...baseProps} selectedCount={2} canEdit={false} />);
        expect(screen.queryByRole('button', { name: 'Add tags' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Practice' })).toBeInTheDocument();
        expect(
            screen.getByText('Add tags and Delete are available only when all selected words are your own.'),
        ).toBeInTheDocument();
    });

    it('with canEdit, shows Add tags and Delete and no hint', () => {
        renderWithProviders(<BulkActionBar {...baseProps} selectedCount={2} />);
        expect(screen.getByRole('button', { name: 'Add tags' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
        expect(screen.queryByText(/available only when all selected words/)).not.toBeInTheDocument();
    });

    it('shows "(+ all pages)" only when allPages is set, and the click calls back', async () => {
        const onSelect = vi.fn();
        const user = userEvent.setup();
        const { rerender } = renderWithProviders(<BulkActionBar {...baseProps} selectedCount={50} />);
        expect(screen.queryByText('(+ all pages)')).not.toBeInTheDocument();

        rerender(<BulkActionBar {...baseProps} selectedCount={50} allPages={{ total: 120, isSelecting: false, onSelect }} />);
        await user.click(screen.getByRole('button', { name: 'Select all 120 matching words' }));
        expect(screen.getByText('(+ all pages)')).toBeInTheDocument();
        expect(onSelect).toHaveBeenCalled();
    });

    it('disables "(+ all pages)" while the words load', () => {
        renderWithProviders(
            <BulkActionBar {...baseProps} selectedCount={50} allPages={{ total: 120, isSelecting: true, onSelect: vi.fn() }} />,
        );
        expect(screen.getByRole('button', { name: 'Select all 120 matching words' })).toBeDisabled();
    });

    it('Practice is available from one selected word and calls back', async () => {
        const onPractice = vi.fn();
        const user = userEvent.setup();
        renderWithProviders(<BulkActionBar {...baseProps} selectedCount={1} onPractice={onPractice} />);

        await user.click(screen.getByRole('button', { name: 'Practice' }));
        expect(onPractice).toHaveBeenCalled();
    });

    it('shows View at exactly one selection, and it calls back', async () => {
        const onView = vi.fn();
        const user = userEvent.setup();
        renderWithProviders(<BulkActionBar {...baseProps} selectedCount={1} onView={onView} />);

        const viewButton = screen.getByRole('button', { name: 'View' });
        await user.click(viewButton);
        expect(onView).toHaveBeenCalled();
    });

    it('Delete opens a confirm dialog; confirming calls onDelete', async () => {
        const onDelete = vi.fn();
        const user = userEvent.setup();
        renderWithProviders(<BulkActionBar {...baseProps} selectedCount={2} onDelete={onDelete} />);

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
        renderWithProviders(<BulkActionBar {...baseProps} selectedCount={1} onDelete={onDelete} />);

        await user.click(screen.getByRole('button', { name: 'Delete' }));
        await user.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(onDelete).not.toHaveBeenCalled();
        expect(screen.queryByText('Delete 1 word?')).not.toBeInTheDocument();
    });

    it('Add tags opens TagPickerDialog in add mode, and applying it reports back', async () => {
        setUpTags([{ id: 'tag-1', authorId: ME, label: 'Kitchen', visibility: 'Private' }]);
        const user = userEvent.setup();
        const onTagsApplied = vi.fn();
        renderWithProviders(
            <BulkActionBar {...baseProps} selectedCount={2} selectedWordIds={['w1', 'w2']} onTagsApplied={onTagsApplied} />,
            { session: SESSION },
        );

        await user.click(screen.getByRole('button', { name: 'Add tags' }));
        expect(screen.getByText('Add tags to 2 words')).toBeInTheDocument();

        await user.click(screen.getByPlaceholderText('Search tags to add…'));
        await user.click(await screen.findByRole('option', { name: /Kitchen/ }));
        await user.click(screen.getByRole('button', { name: 'Apply' }));

        await waitFor(() => expect(onTagsApplied).toHaveBeenCalledWith([expect.objectContaining({ id: 'tag-1' })]));
        expect(screen.queryByText('Add tags to 2 words')).not.toBeInTheDocument();
    });
});
