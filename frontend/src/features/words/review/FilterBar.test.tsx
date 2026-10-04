import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { server } from '@/test/msw/server';
import { makeTagHandlers } from '@/test/msw/tagHandlers';
import { useUiStore } from '@/stores/uiStore';
import { PartOfSpeech } from '@/ts/enums';
import { SidebarLayout } from '@/components/layout/sidebar/SidebarLayout';
import { activeFilterCount, useFilterSections, type FilterBarProps } from './FilterBar';

afterEach(() => {
    useUiStore.getState().setSidebarCollapsed('review', false);
});

/** The hook's sections, inside the real layout (headings, rail and counters come from it). */
function FilterBar(props: FilterBarProps) {
    const sections = useFilterSections(props);
    return (
        <SidebarLayout id="review" label="Filters" sections={sections}>
            <div />
        </SidebarLayout>
    );
}

// The Tags section's `TagCombobox` always fires a real `useTags` search on
// mount (D15/D17) — every test in this file renders `FilterBar`, so every
// test needs a tag fake registered, even the ones that never touch it.
beforeEach(() => {
    server.use(...makeTagHandlers({ callerId: 'u1' }).handlers);
});

const baseProps: FilterBarProps = {
    gender: [],
    pos: [],
    hasQuery: false,
    selectedTags: [],
    activeLanguages: ['EN', 'DE'],
    allLanguages: ['EN', 'DE', 'ES'],
    onGenderChange: vi.fn(),
    onPosChange: vi.fn(),
    onSelectedTagsChange: vi.fn(),
    onLanguagesChange: vi.fn(),
};

describe('FilterBar — sections', () => {
    it('shows Gender, Part of speech, Tags and Language order as sections, in a column', () => {
        renderWithProviders(<FilterBar {...baseProps} />);
        const panel = screen.getByRole('complementary', { name: 'Filters' });
        for (const name of ['Gender', 'Part of speech', 'Tags', 'Language order']) {
            expect(within(panel).getByRole('heading', { name })).toBeInTheDocument();
        }
        // The layout draws the frame: no collapse-to-top or move-to-top controls any more.
        expect(screen.queryByRole('button', { name: /Move filters/ })).not.toBeInTheDocument();
    });

    it('the language-order section shows its heading once, not twice', () => {
        renderWithProviders(<FilterBar {...baseProps} />);
        expect(screen.getAllByText('Language order')).toHaveLength(1);
    });
});

describe('FilterBar — collapsed rail', () => {
    it('shows one button per group, and a counter on each group that is filtering', () => {
        useUiStore.getState().setSidebarCollapsed('review', true);
        renderWithProviders(
            <FilterBar {...baseProps} gender={['der', 'die']} pos={[PartOfSpeech.noun]} hasQuery />,
        );
        for (const name of ['Gender', 'Part of speech', 'Tags', 'Language order']) {
            expect(screen.getByRole('button', { name })).toBeInTheDocument();
        }
        expect(screen.getByTestId('gender-count')).toHaveTextContent('2');
        expect(screen.getByTestId('pos-count')).toHaveTextContent('1');
        // Idle groups show no counter; the search box is the toolbar's, not a group's.
        expect(screen.queryByTestId('tags-count')).not.toBeInTheDocument();
        expect(screen.queryByTestId('language-order-count')).not.toBeInTheDocument();
    });

    it('a rail button expands the panel to the filters', async () => {
        const user = userEvent.setup();
        useUiStore.getState().setSidebarCollapsed('review', true);
        renderWithProviders(<FilterBar {...baseProps} />);
        await user.click(screen.getByRole('button', { name: 'Part of speech' }));
        expect(screen.getByRole('button', { name: 'n.' })).toBeInTheDocument();
    });
});

describe('activeFilterCount', () => {
    it('adds each gender, part-of-speech and tag pick, plus the search box when it has text', () => {
        expect(activeFilterCount([], [], false)).toBe(0);
        expect(activeFilterCount(['der', 'die'], [PartOfSpeech.noun], true, 3)).toBe(7);
    });
});

describe('FilterBar — gender chips (per-language, revised per user review)', () => {
    it('shows a German group and a Spanish group, each labelled by the 2-letter language code', () => {
        renderWithProviders(<FilterBar {...baseProps} />);
        const genderGroup = screen.getByRole('heading', { name: 'Gender' }).closest('section') as HTMLElement;
        expect(within(genderGroup).getByText('DE')).toBeInTheDocument();
        expect(within(genderGroup).getByText('ES')).toBeInTheDocument();
    });

    it('toggles a single German value on, independent of any other language', async () => {
        const onGenderChange = vi.fn();
        const user = userEvent.setup();
        renderWithProviders(<FilterBar {...baseProps} onGenderChange={onGenderChange} />);

        await user.click(screen.getByRole('button', { name: 'der' }));
        expect(onGenderChange).toHaveBeenCalledWith(['der']);
    });

    it('toggling a Spanish value does not touch an already-active German one', async () => {
        const onGenderChange = vi.fn();
        const user = userEvent.setup();
        renderWithProviders(<FilterBar {...baseProps} gender={['der']} onGenderChange={onGenderChange} />);

        await user.click(screen.getByRole('button', { name: 'el' }));
        expect(onGenderChange).toHaveBeenCalledWith(['der', 'el']);
    });

    it('the Spanish neuter chip is its own distinct value, el/la', async () => {
        const onGenderChange = vi.fn();
        const user = userEvent.setup();
        renderWithProviders(<FilterBar {...baseProps} onGenderChange={onGenderChange} />);

        await user.click(screen.getByRole('button', { name: 'el/la' }));
        expect(onGenderChange).toHaveBeenCalledWith(['el/la']);
    });

    it('clicking an active value removes just that value, reporting undefined at zero', async () => {
        const onGenderChange = vi.fn();
        const user = userEvent.setup();
        renderWithProviders(<FilterBar {...baseProps} gender={['der']} onGenderChange={onGenderChange} />);

        await user.click(screen.getByRole('button', { name: 'der' }));
        expect(onGenderChange).toHaveBeenCalledWith(undefined);
    });

    it('shows Clear only once a gender filter is active, and Clear resets it', async () => {
        const onGenderChange = vi.fn();
        const user = userEvent.setup();
        const { rerender } = renderWithProviders(
            <FilterBar {...baseProps} onGenderChange={onGenderChange} />,
        );
        expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument();

        rerender(<FilterBar {...baseProps} gender={['der', 'el']} onGenderChange={onGenderChange} />);
        await user.click(screen.getByRole('button', { name: 'Clear' }));
        expect(onGenderChange).toHaveBeenCalledWith(undefined);
    });
});

describe('FilterBar — part of speech chips', () => {
    it('toggles a PoS value on', async () => {
        const onPosChange = vi.fn();
        const user = userEvent.setup();
        renderWithProviders(<FilterBar {...baseProps} onPosChange={onPosChange} />);

        await user.click(screen.getByRole('button', { name: 'n.' }));
        expect(onPosChange).toHaveBeenCalledWith([PartOfSpeech.noun]);
    });

    it('toggles a PoS value off, reporting undefined at zero', async () => {
        const onPosChange = vi.fn();
        const user = userEvent.setup();
        renderWithProviders(<FilterBar {...baseProps} pos={[PartOfSpeech.noun]} onPosChange={onPosChange} />);

        await user.click(screen.getByRole('button', { name: 'n.' }));
        expect(onPosChange).toHaveBeenCalledWith(undefined);
    });
});

describe('FilterBar — Tags group (D15/D17)', () => {
    it('renders a Tags group with the filter-mode combobox', async () => {
        renderWithProviders(<FilterBar {...baseProps} />);
        const tagsGroup = screen.getByRole('heading', { name: 'Tags' }).closest('section') as HTMLElement;
        expect(within(tagsGroup).getByPlaceholderText('Filter by tag…')).toBeInTheDocument();
    });

    it('picking a tag calls onSelectedTagsChange with the union so far (additive, D15)', async () => {
        server.use(...makeTagHandlers({ callerId: 'u1', seedTags: [{ authorId: 'u1', label: 'Kitchen', visibility: 'Private' }] }).handlers);
        const onSelectedTagsChange = vi.fn();
        const user = userEvent.setup();
        renderWithProviders(<FilterBar {...baseProps} onSelectedTagsChange={onSelectedTagsChange} />);

        await user.click(screen.getByPlaceholderText('Filter by tag…'));
        await user.click(await screen.findByRole('option', { name: /Kitchen/ }));

        expect(onSelectedTagsChange.mock.calls[0][0]).toEqual([expect.objectContaining({ label: 'Kitchen' })]);
    });

    it('shows Clear only once a tag is selected, and Clear empties the selection', async () => {
        const onSelectedTagsChange = vi.fn();
        const user = userEvent.setup();
        const tag = {
            id: 'tag-1',
            label: 'Kitchen',
            description: null,
            visibility: 'Public' as const,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
            author: { id: 'u1', username: 'kai' },
            wordCount: 0,
            followerCount: 0,
            isOwner: true,
            isFollowing: false,
            isAvailable: true,
            sourceTag: null,
        };
        const { rerender } = renderWithProviders(
            <FilterBar {...baseProps} onSelectedTagsChange={onSelectedTagsChange} />,
        );
        const tagsGroup = () => screen.getByRole('heading', { name: 'Tags' }).closest('section') as HTMLElement;
        expect(within(tagsGroup()).queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument();

        rerender(<FilterBar {...baseProps} selectedTags={[tag]} onSelectedTagsChange={onSelectedTagsChange} />);
        await user.click(within(tagsGroup()).getByRole('button', { name: 'Clear' }));
        expect(onSelectedTagsChange).toHaveBeenCalledWith([]);
    });
});
