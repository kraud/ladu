import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { useUiStore } from '@/stores/uiStore';
import { mockMobileViewport } from '@/test/viewport';
import { WordEditorLayout } from './WordEditorLayout';

afterEach(() => {
    useUiStore.setState({ wordSidebarCollapsed: false });
});

const ACTIONS = [
    { key: 'a', label: 'Change word type', icon: null, onClick: vi.fn() },
    { key: 'b', label: 'Delete', icon: null, onClick: vi.fn(), variant: 'destructive' as const },
];

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

    describe('bottom bar', () => {
        it('desktop: shows the actions, the required note, the reason and the primary button in the bar', async () => {
            const user = userEvent.setup();
            const onPrimary = vi.fn();
            renderWithProviders(
                <WordEditorLayout
                    sidebar={<div>Sidebar content</div>}
                    actions={ACTIONS}
                    primary={{ label: 'Save word', icon: null, onClick: onPrimary, disabled: true }}
                    statusText="Add at least 2 translations before you can save."
                    showRequiredHint
                >
                    <div>Translation cards</div>
                </WordEditorLayout>,
            );

            const bar = screen.getByTestId('word-editor-bar');
            expect(within(bar).getByRole('button', { name: 'Change word type' })).toBeInTheDocument();
            expect(within(bar).getByRole('button', { name: 'Delete' })).toBeInTheDocument();
            expect(within(bar).getByText('Fields marked with * are required.')).toBeInTheDocument();
            expect(within(bar).getByRole('status')).toHaveTextContent('Add at least 2 translations before you can save.');
            expect(within(bar).getByRole('button', { name: 'Save word' })).toBeDisabled();
            // The sidebar itself no longer holds any action.
            expect(within(screen.getByText('Sidebar content').closest('aside')!).queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
            expect(onPrimary).not.toHaveBeenCalled();

            await user.click(within(bar).getByRole('button', { name: 'Delete' }));
            expect(ACTIONS[1]!.onClick).toHaveBeenCalledTimes(1);
        });

        it('shows no reason when the primary button is enabled', () => {
            renderWithProviders(
                <WordEditorLayout
                    sidebar={<div>Sidebar content</div>}
                    primary={{ label: 'Save word', icon: null, onClick: vi.fn() }}
                >
                    <div>Translation cards</div>
                </WordEditorLayout>,
            );
            expect(screen.queryByRole('status')).not.toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Save word' })).toBeEnabled();
        });

        it('phone: the bar keeps only the reason and the primary button; the actions move into the drawer', async () => {
            mockMobileViewport();
            const user = userEvent.setup();
            renderWithProviders(
                <WordEditorLayout
                    sidebar={<div>Sidebar content</div>}
                    actions={ACTIONS}
                    primary={{ label: 'Save word', icon: null, onClick: vi.fn(), disabled: true }}
                    statusText="Make a change to enable saving."
                    showRequiredHint
                >
                    <div>Translation cards</div>
                </WordEditorLayout>,
            );

            const bar = screen.getByTestId('word-editor-bar');
            expect(within(bar).queryByRole('button', { name: 'Change word type' })).not.toBeInTheDocument();
            expect(within(bar).queryByText('Fields marked with * are required.')).not.toBeInTheDocument();
            expect(within(bar).getByRole('status')).toHaveTextContent('Make a change to enable saving.');
            expect(within(bar).getByRole('button', { name: 'Save word' })).toBeInTheDocument();

            // Each action exists once — in the drawer, above the sidebar content.
            const drawer = screen.getByText('Sidebar content').closest('aside')!;
            expect(screen.getAllByRole('button', { name: 'Delete' })).toHaveLength(1);
            expect(within(drawer).getByRole('button', { name: 'Delete' })).toBeInTheDocument();

            await user.click(screen.getByRole('button', { name: 'Open menu' }));
            await user.click(within(drawer).getByRole('button', { name: 'Change word type' }));
            expect(ACTIONS[0]!.onClick).toHaveBeenCalledTimes(1);
            // Choosing an action closes the drawer.
            expect(screen.getByRole('button', { name: 'Open menu' })).toHaveAttribute('aria-expanded', 'false');
        });

        it('phone: ignores the stored rail preference — the drawer always shows the full sidebar', () => {
            mockMobileViewport();
            useUiStore.setState({ wordSidebarCollapsed: true });
            renderWithProviders(
                <WordEditorLayout sidebar={<div>Sidebar content</div>}>
                    <div>Translation cards</div>
                </WordEditorLayout>,
            );
            expect(screen.getByRole('button', { name: 'Collapse sidebar' })).toBeInTheDocument();
        });
    });
});
