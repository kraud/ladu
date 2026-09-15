import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { SidebarFields } from './SidebarFields';

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

    // `hidden` is a real `display:none` in the app, restored below 920px via
    // `max-[920px]:flex` — but `vite.config.ts` sets `test.css: false`, so
    // jsdom never applies that, and the field stays queryable/present here.
    // The class itself is what's under test.
    it('collapsed: marks the block hidden (desktop only — restored on the mobile drawer)', () => {
        const { container } = renderWithProviders(<SidebarFields clue="" onClueChange={vi.fn()} collapsed />);
        expect(container.firstElementChild).toHaveClass('hidden', 'max-[920px]:flex');
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

    it('collapsed with no clue: renders nothing', () => {
        const { container } = renderWithProviders(<SidebarFields clue="" collapsed />);
        expect(container).toBeEmptyDOMElement();
    });
});
