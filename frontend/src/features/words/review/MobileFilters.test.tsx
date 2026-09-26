import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { PartOfSpeech } from '@/ts/enums';
import { MobileFilters, type MobileFiltersProps } from './MobileFilters';

const baseProps: MobileFiltersProps = {
    gender: [],
    pos: [],
    hasQuery: false,
    activeLanguages: ['EN', 'DE'],
    allLanguages: ['EN', 'DE', 'ES'],
    onGenderChange: vi.fn(),
    onPosChange: vi.fn(),
    onLanguagesChange: vi.fn(),
    showGenderSwitch: true,
    showGender: true,
    onShowGenderChange: vi.fn(),
    showProgress: false,
    onShowProgressChange: vi.fn(),
};

describe('MobileFilters', () => {
    it('shows only a Filters button until it is opened', () => {
        renderWithProviders(<MobileFilters {...baseProps} />);
        expect(screen.getByRole('button', { name: 'Filters' })).toBeInTheDocument();
        expect(screen.queryByText('Part of speech')).not.toBeInTheDocument();
        expect(screen.queryByText('Display progress')).not.toBeInTheDocument();
    });

    it('shows how many filters are active on the button, so a closed menu never hides them', () => {
        renderWithProviders(
            <MobileFilters {...baseProps} gender={['der']} pos={[PartOfSpeech.noun, PartOfSpeech.verb]} hasQuery />,
        );
        expect(screen.getByRole('button', { name: /Filters/ })).toHaveTextContent('4');
    });

    it('opens a menu with the groups in one column, then the display switches', async () => {
        const user = userEvent.setup();
        renderWithProviders(<MobileFilters {...baseProps} />);
        await user.click(screen.getByRole('button', { name: 'Filters' }));

        const menu = await screen.findByRole('dialog');
        const body = within(menu).getByText('Gender').closest('.fb-body')!;
        expect(body).toHaveClass('fb-body--sidebar'); // flex-direction: column
        expect(within(menu).getByText('Part of speech')).toBeInTheDocument();
        expect(within(menu).getByText('Language order')).toBeInTheDocument();
        // No inline-bar chrome: the menu opens and closes itself.
        expect(within(menu).queryByRole('button', { name: /Collapse filters|Move filters/ })).not.toBeInTheDocument();
        expect(menu.querySelector('.filterbar')).not.toBeInTheDocument();

        expect(within(menu).getByText('Display gender')).toBeInTheDocument();
        expect(within(menu).getByText('Display progress')).toBeInTheDocument();
    });

    it('a chip and a switch in the menu report their changes', async () => {
        const user = userEvent.setup();
        const onPosChange = vi.fn();
        const onShowProgressChange = vi.fn();
        renderWithProviders(
            <MobileFilters {...baseProps} onPosChange={onPosChange} onShowProgressChange={onShowProgressChange} />,
        );
        await user.click(screen.getByRole('button', { name: 'Filters' }));
        const menu = await screen.findByRole('dialog');

        await user.click(within(menu).getByRole('button', { name: 'n.' }));
        expect(onPosChange).toHaveBeenCalledWith([PartOfSpeech.noun]);

        await user.click(within(menu).getByText('Display progress').closest('button')!);
        expect(onShowProgressChange).toHaveBeenCalledWith(true);
    });

    it('omits the Display gender switch when no noun is on screen', async () => {
        const user = userEvent.setup();
        renderWithProviders(<MobileFilters {...baseProps} showGenderSwitch={false} />);
        await user.click(screen.getByRole('button', { name: 'Filters' }));
        const menu = await screen.findByRole('dialog');
        expect(within(menu).queryByText('Display gender')).not.toBeInTheDocument();
        expect(within(menu).getByText('Display progress')).toBeInTheDocument();
    });

    it('closes from its own close button', async () => {
        const user = userEvent.setup();
        renderWithProviders(<MobileFilters {...baseProps} />);
        await user.click(screen.getByRole('button', { name: 'Filters' }));
        const menu = await screen.findByRole('dialog');
        await user.click(within(menu).getByRole('button', { name: 'Close' }));
        await vi.waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });
});
