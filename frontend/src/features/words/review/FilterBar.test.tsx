import { screen, within } from '@testing-library/react';
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
