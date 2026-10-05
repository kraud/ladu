import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { server } from '@/test/msw/server';
import { makeTagHandlers } from '@/test/msw/tagHandlers';
import { useUiStore } from '@/stores/uiStore';
import { SidebarLayout } from '@/components/layout/sidebar/SidebarLayout';
import { useWordSidebarSections, type SidebarFieldsProps } from './SidebarFields';
import type { WordTagRef } from '../types';

const ME = 'user-me';
const TAG_A: WordTagRef = { id: 'tag-1', label: 'Kitchen', visibility: 'Private', authorId: ME };
const TAG_B: WordTagRef = { id: 'tag-2', label: 'Travel', visibility: 'Public', authorId: ME };

// The embedded `TagCombobox` (mode="add") always fires a real `useTags` search
// on mount (D15/D17) — every editable-mode test needs a tag fake registered.
function setUpTags() {
    server.use(...makeTagHandlers({ callerId: ME }).handlers);
}

afterEach(() => {
    useUiStore.getState().setSidebarCollapsed('word', false);
});

/** The hook's sections, rendered inside the real layout (the rail and the headings come from it). */
function SidebarFields(props: SidebarFieldsProps) {
    const sections = useWordSidebarSections(props);
    return (
        <SidebarLayout id="word" label="Word options" sections={sections}>
            <div />
        </SidebarLayout>
    );
}

describe('SidebarFields — editable (create/edit)', () => {
    it('renders a labeled clue textarea and the inline tag combobox', () => {
        setUpTags();
        renderWithProviders(
            <SidebarFields clue="" onClueChange={vi.fn()} tagPicker={{ selected: [], onSelectedChange: vi.fn() }} />,
        );
        expect(screen.getByLabelText('Clue')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Tags' })).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Search tags to add…')).toBeInTheDocument();
    });

    it('calls onClueChange as the user types', async () => {
        setUpTags();
        const user = userEvent.setup();
        const onClueChange = vi.fn();
        renderWithProviders(
            <SidebarFields clue="" onClueChange={onClueChange} tagPicker={{ selected: [], onSelectedChange: vi.fn() }} />,
        );
        await user.type(screen.getByLabelText('Clue'), 'a');
        expect(onClueChange).toHaveBeenCalledWith('a');
    });

    it('renders each selected tag as a chip inside the combobox, with a lock icon on a Private tag, and removing one calls onSelectedChange', async () => {
        setUpTags();
        const user = userEvent.setup();
        const onSelectedChange = vi.fn();
        renderWithProviders(
            <SidebarFields clue="" onClueChange={vi.fn()} tagPicker={{ selected: [TAG_A, TAG_B], onSelectedChange }} />,
        );
        expect(screen.getByText('Kitchen')).toBeInTheDocument();
        expect(screen.getByText('Travel')).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Remove Kitchen' }));
        expect(onSelectedChange.mock.calls[0][0]).toEqual([expect.objectContaining({ id: 'tag-2' })]);
    });
});

describe('SidebarFields — read-only (view)', () => {
    it('shows the clue as text, not an input, when set', () => {
        renderWithProviders(<SidebarFields clue="a small building" />);
        expect(screen.getByText('a small building')).toBeInTheDocument();
        expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });

    it('omits the clue slot entirely when unset, but still shows the tags section', () => {
        renderWithProviders(<SidebarFields clue="" />);
        expect(screen.queryByRole('heading', { name: 'Clue' })).not.toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Tags' })).toBeInTheDocument();
    });

    it('collapsed with no clue: only the Tags button (nothing to open under Clue)', () => {
        useUiStore.getState().setSidebarCollapsed('word', true);
        renderWithProviders(<SidebarFields clue="" />);
        expect(screen.queryByRole('button', { name: 'Clue' })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Tags' })).toBeInTheDocument();
    });

    it('renders every chip without a remove control (no tagPicker at all), and shows the given hint', () => {
        renderWithProviders(<SidebarFields clue="" tags={[TAG_A]} tagsHint="Edit the word to change tags." />);
        expect(screen.getByText('Kitchen')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Remove Kitchen' })).not.toBeInTheDocument();
        expect(screen.getByText('Edit the word to change tags.')).toBeInTheDocument();
    });
});

describe('SidebarFields — linked words placeholder', () => {
    it('shows a Linked words section with a coming-soon note, in edit and in view', () => {
        setUpTags();
        const { unmount } = renderWithProviders(
            <SidebarFields clue="" onClueChange={vi.fn()} tagPicker={{ selected: [], onSelectedChange: vi.fn() }} />,
        );
        expect(screen.getByRole('heading', { name: 'Linked words' })).toBeInTheDocument();
        expect(screen.getByText('Coming soon.')).toBeInTheDocument();
        unmount();

        renderWithProviders(<SidebarFields clue="" />);
        expect(screen.getByRole('heading', { name: 'Linked words' })).toBeInTheDocument();
    });

    it('has a rail button too, with no count and no filled mark', () => {
        useUiStore.getState().setSidebarCollapsed('word', true);
        renderWithProviders(<SidebarFields clue="" />);
        expect(screen.getByRole('button', { name: 'Linked words' })).not.toHaveAttribute('data-filled');
    });
});

describe('SidebarFields — collapsed rail', () => {
    it('is the app default: the store starts collapsed', () => {
        expect(useUiStore.getInitialState().sidebarCollapsed.word).toBe(true);
    });

    function iconClass(button: HTMLElement) {
        return button.querySelector('svg')?.innerHTML ?? '';
    }

    it('shows a Clue and a Tags button instead of the fields', () => {
        useUiStore.getState().setSidebarCollapsed('word', true);
        renderWithProviders(<SidebarFields clue="" onClueChange={vi.fn()} />);
        expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Clue' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Tags' })).toBeInTheDocument();
    });

    it('swaps the Clue icon once the clue has text (pencil-simple -> pencil-simple-line)', () => {
        useUiStore.getState().setSidebarCollapsed('word', true);
        const { rerender } = renderWithProviders(<SidebarFields clue="" onClueChange={vi.fn()} />);
        const empty = iconClass(screen.getByRole('button', { name: 'Clue' }));
        expect(screen.getByRole('button', { name: 'Clue' })).not.toHaveAttribute('data-filled');

        rerender(<SidebarFields clue="a small building" onClueChange={vi.fn()} />);
        const filled = iconClass(screen.getByRole('button', { name: 'Clue' }));
        expect(screen.getByRole('button', { name: 'Clue' })).toHaveAttribute('data-filled', 'true');
        expect(filled).not.toBe(empty);
    });

    it('swaps the Tags icon to duotone and shows a count once there are read-only tags', () => {
        useUiStore.getState().setSidebarCollapsed('word', true);
        const { rerender } = renderWithProviders(<SidebarFields clue="" onClueChange={vi.fn()} />);
        const plain = iconClass(screen.getByRole('button', { name: 'Tags' }));
        expect(screen.queryByTestId('tags-count')).not.toBeInTheDocument();

        rerender(<SidebarFields clue="" onClueChange={vi.fn()} tags={[TAG_A, TAG_B, { ...TAG_A, id: 'tag-3' }]} />);
        expect(screen.getByTestId('tags-count')).toHaveTextContent('3');
        expect(iconClass(screen.getByRole('button', { name: 'Tags' }))).not.toBe(plain);
    });

    it('the count reflects an editable tagPicker selection just the same', () => {
        useUiStore.getState().setSidebarCollapsed('word', true);
        renderWithProviders(
            <SidebarFields clue="" onClueChange={vi.fn()} tagPicker={{ selected: [TAG_A, TAG_B], onSelectedChange: vi.fn() }} />,
        );
        expect(screen.getByTestId('tags-count')).toHaveTextContent('2');
    });

    it('the Clue button expands the sidebar and focuses the clue field', async () => {
        const user = userEvent.setup();
        useUiStore.getState().setSidebarCollapsed('word', true);
        renderWithProviders(<SidebarFields clue="" onClueChange={vi.fn()} />);

        await user.click(screen.getByRole('button', { name: 'Clue' }));
        expect(useUiStore.getState().sidebarCollapsed.word).toBe(false);
        expect(screen.getByLabelText('Clue')).toHaveFocus();
    });

    it('the Tags button expands the sidebar without moving focus into the clue', async () => {
        const user = userEvent.setup();
        useUiStore.getState().setSidebarCollapsed('word', true);
        renderWithProviders(<SidebarFields clue="" onClueChange={vi.fn()} />);

        await user.click(screen.getByRole('button', { name: 'Tags' }));
        expect(useUiStore.getState().sidebarCollapsed.word).toBe(false);
        expect(screen.getByLabelText('Clue')).not.toHaveFocus();
    });
});
