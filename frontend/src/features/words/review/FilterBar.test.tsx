import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { PartOfSpeech } from '@/ts/enums';
import { FilterBar, type FilterBarProps } from './FilterBar';

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
