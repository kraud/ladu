import { render, screen, within } from '@testing-library/react';
import { CaretDownIcon, CaretLeftIcon, CaretRightIcon, CaretUpIcon } from '@phosphor-icons/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { useUiStore } from '@/stores/uiStore';
import { PartOfSpeech } from '@/ts/enums';
import { activeFilterCount, FilterBar, type FilterBarProps } from './FilterBar';

afterEach(() => {
    useUiStore.setState({ reviewSidebarCollapsed: false, reviewFilterPosition: 'top' });
});

const baseProps: FilterBarProps = {
    gender: [],
    pos: [],
    hasQuery: false,
    activeLanguages: ['EN', 'DE'],
    allLanguages: ['EN', 'DE', 'ES'],
    onGenderChange: vi.fn(),
    onPosChange: vi.fn(),
    onLanguagesChange: vi.fn(),
};

describe('FilterBar — collapse', () => {
    it('starts expanded (mockup default) and can be collapsed', async () => {
        const user = userEvent.setup();
        renderWithProviders(<FilterBar {...baseProps} />);
        expect(screen.getByText('Part of speech')).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Collapse filters' }));
        expect(screen.queryByText('Part of speech')).not.toBeInTheDocument();
        expect(screen.getByText('No filters applied')).toBeInTheDocument();
    });

    it('shows the active-filter count once collapsed, and re-expands', async () => {
        const user = userEvent.setup();
        renderWithProviders(<FilterBar {...baseProps} pos={[PartOfSpeech.noun]} hasQuery />);
        await user.click(screen.getByRole('button', { name: 'Collapse filters' }));

        expect(screen.getByText('2')).toBeInTheDocument();
        expect(screen.getByText('2 filters active')).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Show filters' }));
        expect(screen.getByText('Part of speech')).toBeInTheDocument();
    });

    it('counts each active gender value individually in the active-filter pill', async () => {
        const user = userEvent.setup();
        renderWithProviders(<FilterBar {...baseProps} gender={['der', 'die']} />);
        await user.click(screen.getByRole('button', { name: 'Collapse filters' }));
        expect(screen.getByText('2 filters active')).toBeInTheDocument();
    });

    it('shows the current language order as a hint when collapsed', async () => {
        const user = userEvent.setup();
        renderWithProviders(<FilterBar {...baseProps} activeLanguages={['DE', 'EN']} />);
        await user.click(screen.getByRole('button', { name: 'Collapse filters' }));
        expect(screen.getByText('DE → EN', { exact: false })).toBeInTheDocument();
    });
});

describe('FilterBar — gender chips (per-language, revised per user review)', () => {
    it('shows a German group and a Spanish group, each labelled by the 2-letter language code', () => {
        renderWithProviders(<FilterBar {...baseProps} />);
        const genderGroup = screen.getByText('Gender').closest('.fb-group') as HTMLElement;
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

describe('FilterBar — no Tags group (D1)', () => {
    it('renders no Tags label', () => {
        renderWithProviders(<FilterBar {...baseProps} />);
        expect(screen.queryByText('Tags')).not.toBeInTheDocument();
    });
});

describe('FilterBar — sidebar position', () => {
    it('moves to a sidebar, stacking filter groups in a column, and back to the top', async () => {
        const user = userEvent.setup();
        renderWithProviders(<FilterBar {...baseProps} />);

        await user.click(screen.getByRole('button', { name: 'Move filters to sidebar' }));
        expect(useUiStore.getState().reviewFilterPosition).toBe('sidebar');
        expect(screen.getByText('Part of speech').closest('aside')).toBeInTheDocument();
        expect(screen.getByText('Gender').closest('.fb-body')).toHaveClass('fb-body--sidebar');

        await user.click(screen.getByRole('button', { name: 'Move filters to top' }));
        expect(useUiStore.getState().reviewFilterPosition).toBe('top');
        expect(screen.getByText('Part of speech').closest('aside')).not.toBeInTheDocument();
    });

    it('collapses to an icon rail once in sidebar position, hiding the title and hint text', async () => {
        const user = userEvent.setup();
        renderWithProviders(<FilterBar {...baseProps} pos={[PartOfSpeech.noun]} />);

        await user.click(screen.getByRole('button', { name: 'Move filters to sidebar' }));
        await user.click(screen.getByRole('button', { name: 'Collapse filters' }));

        expect(screen.queryByText('Filters')).not.toBeInTheDocument();
        expect(screen.queryByText('Part of speech')).not.toBeInTheDocument();
        expect(screen.getByText('1')).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Show filters' }));
        expect(screen.getByText('Filters')).toBeInTheDocument();
    });
});

describe('FilterBar — menu layout (the phone\'s side menu)', () => {
    it('renders just the groups in a column: no card, header, collapse or position toggle', () => {
        const { container } = renderWithProviders(<FilterBar {...baseProps} layout="menu" />);

        expect(screen.getByText('Gender')).toBeInTheDocument();
        expect(screen.getByText('Part of speech')).toBeInTheDocument();
        expect(screen.getByText('Language order')).toBeInTheDocument();
        expect(screen.getByText('Gender').closest('.fb-body')).toHaveClass('fb-body--sidebar');

        expect(container.querySelector('.filterbar')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /filters/i })).not.toBeInTheDocument();
        expect(screen.queryByText('Filters')).not.toBeInTheDocument();
    });

    it('ignores the stored top/sidebar position and still reports changes', async () => {
        useUiStore.setState({ reviewFilterPosition: 'sidebar', reviewSidebarCollapsed: true });
        const onPosChange = vi.fn();
        const user = userEvent.setup();
        renderWithProviders(<FilterBar {...baseProps} layout="menu" onPosChange={onPosChange} />);

        expect(screen.getByText('Part of speech')).toBeInTheDocument(); // a collapsed sidebar would hide it
        await user.click(screen.getByRole('button', { name: 'n.' }));
        expect(onPosChange).toHaveBeenCalledWith([PartOfSpeech.noun]);
    });
});

describe('activeFilterCount', () => {
    it('counts each gender and part-of-speech value, plus the search text', () => {
        expect(activeFilterCount([], [], false)).toBe(0);
        expect(activeFilterCount(['der', 'die'], [PartOfSpeech.noun], true)).toBe(4);
    });
});

describe('FilterBar — collapse arrow direction', () => {
    /** The rendered `<svg>` markup of an icon at the size the toggle uses, to compare against the button's. */
    function iconMarkup(Icon: typeof CaretUpIcon) {
        const { container, unmount } = render(<Icon size={16} />);
        const markup = container.innerHTML;
        unmount();
        return markup;
    }

    function toggleIcon(name: string) {
        return screen.getByRole('button', { name }).innerHTML;
    }

    it('points up (collapse) and down (expand) while the bar is above the table', async () => {
        const user = userEvent.setup();
        renderWithProviders(<FilterBar {...baseProps} />);

        expect(toggleIcon('Collapse filters')).toBe(iconMarkup(CaretUpIcon));
        await user.click(screen.getByRole('button', { name: 'Collapse filters' }));
        expect(toggleIcon('Show filters')).toBe(iconMarkup(CaretDownIcon));
    });

    it('points left (collapse) and right (expand) once the bar is a sidebar', async () => {
        const user = userEvent.setup();
        renderWithProviders(<FilterBar {...baseProps} />);
        await user.click(screen.getByRole('button', { name: 'Move filters to sidebar' }));

        expect(toggleIcon('Collapse filters')).toBe(iconMarkup(CaretLeftIcon));
        await user.click(screen.getByRole('button', { name: 'Collapse filters' }));
        expect(toggleIcon('Show filters')).toBe(iconMarkup(CaretRightIcon));
    });

    it('goes back to up/down when the bar moves back above the table', async () => {
        const user = userEvent.setup();
        renderWithProviders(<FilterBar {...baseProps} />);
        await user.click(screen.getByRole('button', { name: 'Move filters to sidebar' }));
        await user.click(screen.getByRole('button', { name: 'Move filters to top' }));

        expect(toggleIcon('Collapse filters')).toBe(iconMarkup(CaretUpIcon));
    });
});

describe('FilterBar — Language order heading layout', () => {
    const head = () => screen.getByText('Language order').parentElement!;

    it('is a row above the table', () => {
        renderWithProviders(<FilterBar {...baseProps} />);
        expect(head()).not.toHaveClass('flex-col');
    });

    it('is a column (title above hint) once the filters are a sidebar, and a row again above the table', async () => {
        const user = userEvent.setup();
        renderWithProviders(<FilterBar {...baseProps} />);

        await user.click(screen.getByRole('button', { name: 'Move filters to sidebar' }));
        expect(head()).toHaveClass('flex-col', 'items-start');

        await user.click(screen.getByRole('button', { name: 'Move filters to top' }));
        expect(head()).not.toHaveClass('flex-col');
    });

    it('the other groups keep their own heading rows in the sidebar', async () => {
        const user = userEvent.setup();
        renderWithProviders(<FilterBar {...baseProps} gender={['der']} />);
        await user.click(screen.getByRole('button', { name: 'Move filters to sidebar' }));

        // Gender's heading row holds the title and its Clear link side by side.
        expect(screen.getByText('Gender').parentElement).not.toHaveClass('flex-col');
    });

    it('is a column in the phone menu too, whatever the stored desktop position', () => {
        useUiStore.setState({ reviewFilterPosition: 'top' });
        renderWithProviders(<FilterBar {...baseProps} layout="menu" />);
        expect(head()).toHaveClass('flex-col', 'items-start');
    });
});

describe('FilterBar — no reflow while the sidebar expands', () => {
    // jsdom cannot measure layout, so this pins the classes that prevent the flash: the aside
    // animates its width from the 56px rail, and groups that follow it reflow into a very tall
    // narrow column for the first frames. Measured in a browser: the height was 636px on the first
    // frame and 382px at rest; now it is 382px throughout.
    it('in the sidebar, the groups have the final expanded width and the aside clips while it grows', async () => {
        const user = userEvent.setup();
        renderWithProviders(<FilterBar {...baseProps} />);
        await user.click(screen.getByRole('button', { name: 'Move filters to sidebar' }));

        expect(screen.getByText('Gender').closest('.fb-body')).toHaveClass('w-[calc(16rem-2px-2rem)]');
        expect(screen.getByText('Gender').closest('aside')).toHaveClass('overflow-x-hidden', 'transition-[width]');
    });

    it('above the table the groups keep their natural, wrapping width', () => {
        renderWithProviders(<FilterBar {...baseProps} />);
        expect(screen.getByText('Gender').closest('.fb-body')).not.toHaveClass('w-[calc(16rem-2px-2rem)]');
    });
});
