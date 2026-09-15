import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { useUiStore } from '@/stores/uiStore';
import { WordEditorLayout } from './WordEditorLayout';

afterEach(() => {
    useUiStore.setState({ wordSidebarCollapsed: false });
});

describe('WordEditorLayout', () => {
    it('renders both the sidebar and the content', () => {
        renderWithProviders(
            <WordEditorLayout sidebar={<div>Sidebar content</div>}>
                <div>Translation cards</div>
            </WordEditorLayout>,
        );
        expect(screen.getByText('Sidebar content')).toBeInTheDocument();
        expect(screen.getByText('Translation cards')).toBeInTheDocument();
    });

    it('starts expanded and toggles the shared uiStore collapse flag', async () => {
        const user = userEvent.setup();
        renderWithProviders(
            <WordEditorLayout sidebar={<div>Sidebar content</div>}>
                <div>Translation cards</div>
            </WordEditorLayout>,
        );

        const toggle = screen.getByRole('button', { name: 'Collapse sidebar' });
        expect(toggle).toHaveAttribute('aria-expanded', 'true');
        expect(useUiStore.getState().wordSidebarCollapsed).toBe(false);

        await user.click(toggle);
        expect(useUiStore.getState().wordSidebarCollapsed).toBe(true);
        expect(screen.getByRole('button', { name: 'Expand sidebar' })).toHaveAttribute('aria-expanded', 'false');
    });

    it('the mobile trigger opens the drawer, tracked by aria-expanded and aria-controls', async () => {
        const user = userEvent.setup();
        renderWithProviders(
            <WordEditorLayout sidebar={<div>Sidebar content</div>}>
                <div>Translation cards</div>
            </WordEditorLayout>,
        );

        const trigger = screen.getByRole('button', { name: 'Open menu' });
        expect(trigger).toHaveAttribute('aria-expanded', 'false');

        await user.click(trigger);
        expect(trigger).toHaveAttribute('aria-expanded', 'true');
        expect(trigger.getAttribute('aria-controls')).toBe(
            screen.getByText('Sidebar content').closest('aside')!.id,
        );
    });

    it('the aside\'s own close button closes the drawer', async () => {
        const user = userEvent.setup();
        renderWithProviders(
            <WordEditorLayout sidebar={<div>Sidebar content</div>}>
                <div>Translation cards</div>
            </WordEditorLayout>,
        );

        await user.click(screen.getByRole('button', { name: 'Open menu' }));
        await user.click(screen.getByRole('button', { name: 'Close menu' }));
        expect(screen.getByRole('button', { name: 'Open menu' })).toHaveAttribute('aria-expanded', 'false');
    });

    // The backdrop is a mouse-only dismiss (aria-hidden, untabbable — see
    // `WordEditorLayout.tsx`), so it's not reachable via `getByRole` and is
    // queried directly instead.
    it('clicking the backdrop closes the drawer', async () => {
        const user = userEvent.setup();
        const { container } = renderWithProviders(
            <WordEditorLayout sidebar={<div>Sidebar content</div>}>
                <div>Translation cards</div>
            </WordEditorLayout>,
        );

        await user.click(screen.getByRole('button', { name: 'Open menu' }));
        const backdrop = container.querySelector('button[aria-hidden="true"]') as HTMLElement;
        expect(backdrop).toBeInTheDocument();
        await user.click(backdrop);
        expect(screen.getByRole('button', { name: 'Open menu' })).toHaveAttribute('aria-expanded', 'false');
    });

    it('Escape closes the mobile drawer', async () => {
        const user = userEvent.setup();
        renderWithProviders(
            <WordEditorLayout sidebar={<div>Sidebar content</div>}>
                <div>Translation cards</div>
            </WordEditorLayout>,
        );

        await user.click(screen.getByRole('button', { name: 'Open menu' }));
        await user.keyboard('{Escape}');
        expect(screen.getByRole('button', { name: 'Open menu' })).toHaveAttribute('aria-expanded', 'false');
    });
});
