import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PlusIcon } from '@phosphor-icons/react';
import { SidebarAction } from './SidebarAction';

describe('SidebarAction', () => {
    it('renders a button with the label as its accessible name', () => {
        render(
            <SidebarAction icon={<PlusIcon />} onClick={vi.fn()}>
                Add translation
            </SidebarAction>,
        );
        expect(screen.getByRole('button', { name: 'Add translation' })).toBeInTheDocument();
    });

    it('fires onClick', async () => {
        const user = userEvent.setup();
        const onClick = vi.fn();
        render(
            <SidebarAction icon={<PlusIcon />} onClick={onClick}>
                Add translation
            </SidebarAction>,
        );
        await user.click(screen.getByRole('button', { name: 'Add translation' }));
        expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('respects disabled', () => {
        render(
            <SidebarAction icon={<PlusIcon />} onClick={vi.fn()} disabled>
                Add translation
            </SidebarAction>,
        );
        expect(screen.getByRole('button', { name: 'Add translation' })).toBeDisabled();
    });

    // The label stays the button's accessible name whether or not the parent
    // sidebar is a collapsed icon rail — `sr-only` hides it visually, not
    // from the accessibility tree — so `getByRole('button', { name })`
    // queries never need to branch on collapsed state.
    it('keeps the same accessible name collapsed as expanded', () => {
        const { rerender } = render(
            <SidebarAction icon={<PlusIcon />} onClick={vi.fn()} collapsed={false}>
                Add translation
            </SidebarAction>,
        );
        expect(screen.getByRole('button', { name: 'Add translation' })).toBeInTheDocument();

        rerender(
            <SidebarAction icon={<PlusIcon />} onClick={vi.fn()} collapsed>
                Add translation
            </SidebarAction>,
        );
        expect(screen.getByRole('button', { name: 'Add translation' })).toBeInTheDocument();
    });

    it('collapsed: visually hides the label (sr-only) and shows it in a hover tooltip instead', async () => {
        const user = userEvent.setup();
        render(
            <SidebarAction icon={<PlusIcon />} onClick={vi.fn()} collapsed>
                Add translation
            </SidebarAction>,
        );

        const label = screen.getByText('Add translation');
        expect(label).toHaveClass('sr-only');

        // The label above is the button's own (sr-only) content, not yet a
        // floating tooltip — this asserts a second copy appears on hover
        // (Base UI's tooltip content carries no `role="tooltip"`, so this is
        // queried by text, matching `CompletionRing.test.tsx`'s own pattern).
        expect(screen.getAllByText('Add translation')).toHaveLength(1);
        await user.hover(screen.getByRole('button', { name: 'Add translation' }));
        await waitFor(() => expect(screen.getAllByText('Add translation')).toHaveLength(2));
    });

    it('collapsed: shows the hint alongside the label in the tooltip', async () => {
        const user = userEvent.setup();
        render(
            <SidebarAction icon={<PlusIcon />} onClick={vi.fn()} collapsed hint="Add at least 2 translations">
                Save
            </SidebarAction>,
        );

        await user.hover(screen.getByRole('button', { name: 'Save' }));
        expect(await screen.findByText('Add at least 2 translations')).toBeInTheDocument();
    });
});
