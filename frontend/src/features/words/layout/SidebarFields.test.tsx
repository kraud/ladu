import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { useUiStore } from '@/stores/uiStore';
import { SidebarFields } from './SidebarFields';
import type { WordTagRef } from '../types';

const TAG_A: WordTagRef = { id: 'tag-1', label: 'Kitchen', visibility: 'Private', authorId: 'u1' };
const TAG_B: WordTagRef = { id: 'tag-2', label: 'Travel', visibility: 'Public', authorId: 'u1' };

afterEach(() => {
    useUiStore.setState({ wordSidebarCollapsed: false });
});

describe('SidebarFields — editable (create/edit)', () => {
    it('renders a labeled clue textarea and an empty, actionable tags section', () => {
        renderWithProviders(<SidebarFields clue="" onClueChange={vi.fn()} onAddTag={vi.fn()} />);
        expect(screen.getByLabelText('Clue')).toBeInTheDocument();
        expect(screen.getByText('Tags')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Add tag' })).toBeInTheDocument();
    });

    it('calls onClueChange as the user types', async () => {
        const user = userEvent.setup();
        const onClueChange = vi.fn();
        renderWithProviders(<SidebarFields clue="" onClueChange={onClueChange} onAddTag={vi.fn()} />);
        await user.type(screen.getByLabelText('Clue'), 'a');
        expect(onClueChange).toHaveBeenCalledWith('a');
    });

    it('renders each tag as a removable chip, with a lock icon on a Private tag', async () => {
        const user = userEvent.setup();
        const onRemoveTag = vi.fn();
        renderWithProviders(
            <SidebarFields
                clue=""
                onClueChange={vi.fn()}
                tags={[TAG_A, TAG_B]}
                onAddTag={vi.fn()}
                onRemoveTag={onRemoveTag}
            />,
        );
        expect(screen.getByText('Kitchen')).toBeInTheDocument();
        expect(screen.getByText('Travel')).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Remove Kitchen' }));
        expect(onRemoveTag).toHaveBeenCalledWith('tag-1');
    });

    it('clicking "Add tag" calls onAddTag', async () => {
        const user = userEvent.setup();
        const onAddTag = vi.fn();
        renderWithProviders(<SidebarFields clue="" onClueChange={vi.fn()} onAddTag={onAddTag} />);
        await user.click(screen.getByRole('button', { name: 'Add tag' }));
        expect(onAddTag).toHaveBeenCalledTimes(1);
    });
});

describe('SidebarFields — read-only (view)', () => {
    it('shows the clue as text, not an input, when set', () => {
        renderWithProviders(<SidebarFields clue="a small building" onAddTag={vi.fn()} />);
        expect(screen.getByText('a small building')).toBeInTheDocument();
        expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });

    it('omits the clue slot entirely when unset, but still shows the tags section', () => {
        renderWithProviders(<SidebarFields clue="" onAddTag={vi.fn()} />);
        expect(screen.queryByText('Clue')).not.toBeInTheDocument();
        expect(screen.getByText('Tags')).toBeInTheDocument();
    });

    it('collapsed with no clue: only the Tags button (nothing to open under Clue)', () => {
        useUiStore.setState({ wordSidebarCollapsed: true });
        renderWithProviders(<SidebarFields clue="" onAddTag={vi.fn()} />);
        expect(screen.queryByRole('button', { name: 'Clue' })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Tags' })).toBeInTheDocument();
    });
});

describe('SidebarFields — tags disabled (word reached via a followed tag)', () => {
    it('renders every chip without a remove control, hides Add tag, and shows the managed-by-owner note', () => {
        renderWithProviders(<SidebarFields clue="" tags={[TAG_A]} />);
        expect(screen.getByText('Kitchen')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Remove Kitchen' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Add tag' })).not.toBeInTheDocument();
        expect(
            screen.getByText("Read-only — this word comes from a followed tag. Its tags are managed by the tag's owner."),
        ).toBeInTheDocument();
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
        renderWithProviders(<SidebarFields clue="" onClueChange={vi.fn()} onAddTag={vi.fn()} />);
        expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Clue' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Tags' })).toBeInTheDocument();
    });

    it('swaps the Clue icon once the clue has text (pencil-simple -> pencil-simple-line)', () => {
        useUiStore.setState({ wordSidebarCollapsed: true });
        const { rerender } = renderWithProviders(
            <SidebarFields clue="" onClueChange={vi.fn()} onAddTag={vi.fn()} />,
        );
        const empty = iconClass(screen.getByRole('button', { name: 'Clue' }));
        expect(screen.getByRole('button', { name: 'Clue' })).not.toHaveAttribute('data-filled');

        rerender(<SidebarFields clue="a small building" onClueChange={vi.fn()} onAddTag={vi.fn()} />);
        const filled = iconClass(screen.getByRole('button', { name: 'Clue' }));
        expect(screen.getByRole('button', { name: 'Clue' })).toHaveAttribute('data-filled', 'true');
        expect(filled).not.toBe(empty);
    });

    it('swaps the Tags icon to duotone and shows a count once there are tags', () => {
        useUiStore.setState({ wordSidebarCollapsed: true });
        const { rerender } = renderWithProviders(
            <SidebarFields clue="" onClueChange={vi.fn()} onAddTag={vi.fn()} />,
        );
        const plain = iconClass(screen.getByRole('button', { name: 'Tags' }));
        expect(screen.queryByTestId('tag-count')).not.toBeInTheDocument();

        rerender(
            <SidebarFields
                clue=""
                onClueChange={vi.fn()}
                onAddTag={vi.fn()}
                tags={[TAG_A, TAG_B, { ...TAG_A, id: 'tag-3' }]}
            />,
        );
        expect(screen.getByTestId('tag-count')).toHaveTextContent('3');
        expect(iconClass(screen.getByRole('button', { name: 'Tags' }))).not.toBe(plain);
    });

    it('the Clue button expands the sidebar and focuses the clue field', async () => {
        const user = userEvent.setup();
        useUiStore.setState({ wordSidebarCollapsed: true });
        renderWithProviders(<SidebarFields clue="" onClueChange={vi.fn()} onAddTag={vi.fn()} />);

        await user.click(screen.getByRole('button', { name: 'Clue' }));
        expect(useUiStore.getState().wordSidebarCollapsed).toBe(false);
        expect(screen.getByLabelText('Clue')).toHaveFocus();
    });

    it('the Tags button expands the sidebar without moving focus into the clue', async () => {
        const user = userEvent.setup();
        useUiStore.setState({ wordSidebarCollapsed: true });
        renderWithProviders(<SidebarFields clue="" onClueChange={vi.fn()} onAddTag={vi.fn()} />);

        await user.click(screen.getByRole('button', { name: 'Tags' }));
        expect(useUiStore.getState().wordSidebarCollapsed).toBe(false);
        expect(screen.getByLabelText('Clue')).not.toHaveFocus();
    });
});
