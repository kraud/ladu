import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { useUiStore } from '@/stores/uiStore';
import { SidebarFields } from './SidebarFields';

afterEach(() => {
    useUiStore.setState({ wordSidebarCollapsed: false });
});

describe('SidebarFields — editable (create/edit)', () => {
    it('renders a labeled clue textarea and the disabled tags placeholder', () => {
        renderWithProviders(<SidebarFields clue="" onClueChange={vi.fn()} />);
        expect(screen.getByLabelText('Clue')).toBeInTheDocument();
        expect(screen.getByText('Tags')).toBeInTheDocument();
        expect(screen.getByText('Coming soon')).toBeInTheDocument();
    });

    it('calls onClueChange as the user types', async () => {
        const user = userEvent.setup();
        const onClueChange = vi.fn();
        renderWithProviders(<SidebarFields clue="" onClueChange={onClueChange} />);
        await user.type(screen.getByLabelText('Clue'), 'a');
        expect(onClueChange).toHaveBeenCalledWith('a');
    });
});

describe('SidebarFields — read-only (view)', () => {
    it('shows the clue as text, not an input, when set', () => {
        renderWithProviders(<SidebarFields clue="a small building" />);
        expect(screen.getByText('a small building')).toBeInTheDocument();
        expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });

    it('omits the clue slot entirely when unset, but still shows the tags placeholder', () => {
        renderWithProviders(<SidebarFields clue="" />);
        expect(screen.queryByText('Clue')).not.toBeInTheDocument();
        expect(screen.getByText('Tags')).toBeInTheDocument();
    });

    it('collapsed with no clue: only the Tags button (nothing to open under Clue)', () => {
        useUiStore.setState({ wordSidebarCollapsed: true });
        renderWithProviders(<SidebarFields clue="" />);
        expect(screen.queryByRole('button', { name: 'Clue' })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Tags' })).toBeInTheDocument();
    });
});

describe('SidebarFields — collapsed rail', () => {
    it('is the app default: the store starts collapsed', () => {
        expect(useUiStore.getInitialState().wordSidebarCollapsed).toBe(true);
    });

    function iconClass(button: HTMLElement) {
        return button.querySelector('svg')?.innerHTML ?? '';
    }

    it('shows a Clue and a Tags button instead of the fields', () => {
        useUiStore.setState({ wordSidebarCollapsed: true });
        renderWithProviders(<SidebarFields clue="" onClueChange={vi.fn()} />);
        expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Clue' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Tags' })).toBeInTheDocument();
    });

    it('swaps the Clue icon once the clue has text (pencil-simple -> pencil-simple-line)', () => {
        useUiStore.setState({ wordSidebarCollapsed: true });
        const { rerender } = renderWithProviders(<SidebarFields clue="" onClueChange={vi.fn()} />);
        const empty = iconClass(screen.getByRole('button', { name: 'Clue' }));
        expect(screen.getByRole('button', { name: 'Clue' })).not.toHaveAttribute('data-filled');

        rerender(<SidebarFields clue="a small building" onClueChange={vi.fn()} />);
        const filled = iconClass(screen.getByRole('button', { name: 'Clue' }));
        expect(screen.getByRole('button', { name: 'Clue' })).toHaveAttribute('data-filled', 'true');
        expect(filled).not.toBe(empty);
    });

    it('swaps the Tags icon to duotone and shows a count once there are tags', () => {
        useUiStore.setState({ wordSidebarCollapsed: true });
        const { rerender } = renderWithProviders(<SidebarFields clue="" onClueChange={vi.fn()} />);
        const plain = iconClass(screen.getByRole('button', { name: 'Tags' }));
        expect(screen.queryByTestId('tag-count')).not.toBeInTheDocument();

        rerender(<SidebarFields clue="" onClueChange={vi.fn()} tagCount={3} />);
        expect(screen.getByTestId('tag-count')).toHaveTextContent('3');
        expect(iconClass(screen.getByRole('button', { name: 'Tags' }))).not.toBe(plain);
    });

    it('the Clue button expands the sidebar and focuses the clue field', async () => {
        const user = userEvent.setup();
        useUiStore.setState({ wordSidebarCollapsed: true });
        renderWithProviders(<SidebarFields clue="" onClueChange={vi.fn()} />);

        await user.click(screen.getByRole('button', { name: 'Clue' }));
        expect(useUiStore.getState().wordSidebarCollapsed).toBe(false);
        expect(screen.getByLabelText('Clue')).toHaveFocus();
    });

    it('the Tags button expands the sidebar without moving focus into the clue', async () => {
        const user = userEvent.setup();
        useUiStore.setState({ wordSidebarCollapsed: true });
        renderWithProviders(<SidebarFields clue="" onClueChange={vi.fn()} />);

        await user.click(screen.getByRole('button', { name: 'Tags' }));
        expect(useUiStore.getState().wordSidebarCollapsed).toBe(false);
        expect(screen.getByLabelText('Clue')).not.toHaveFocus();
    });
});
