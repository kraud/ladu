import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { useUiStore } from '@/stores/uiStore';
import { mockMobileViewport } from '@/test/viewport';
import { WordEditorLayout } from './WordEditorLayout';

afterEach(() => {
    useUiStore.getState().setSidebarCollapsed('word', false);
});

const SECTIONS = [{ id: 'demo', label: 'Demo section', icon: null, content: <div>Sidebar content</div> }];

const ACTIONS = [
    { key: 'a', label: 'Change word type', icon: null, onClick: vi.fn() },
    { key: 'b', label: 'Delete', icon: null, onClick: vi.fn(), variant: 'destructive' as const },
];

describe('WordEditorLayout', () => {
    it('renders both the sidebar and the content', () => {
        renderWithProviders(
            <WordEditorLayout sections={SECTIONS}>
                <div>Translation cards</div>
            </WordEditorLayout>,
        );
        expect(screen.getByText('Sidebar content')).toBeInTheDocument();
        expect(screen.getByText('Translation cards')).toBeInTheDocument();
    });

    it('starts expanded and toggles the shared uiStore collapse flag', async () => {
        const user = userEvent.setup();
        renderWithProviders(
            <WordEditorLayout sections={SECTIONS}>
                <div>Translation cards</div>
            </WordEditorLayout>,
        );

        const toggle = screen.getByRole('button', { name: 'Collapse sidebar' });
        expect(toggle).toHaveAttribute('aria-expanded', 'true');
        expect(useUiStore.getState().sidebarCollapsed.word).toBe(false);

        await user.click(toggle);
        expect(useUiStore.getState().sidebarCollapsed.word).toBe(true);
        expect(screen.getByRole('button', { name: 'Expand sidebar' })).toHaveAttribute('aria-expanded', 'false');
    });

    describe('bottom bar', () => {
        it('desktop: shows the actions, the required note, the reason and the primary button in the bar', async () => {
            const user = userEvent.setup();
            const onPrimary = vi.fn();
            renderWithProviders(
                <WordEditorLayout
                    sections={SECTIONS}
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
            expect(within(screen.getByRole('complementary')).queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
            expect(onPrimary).not.toHaveBeenCalled();

            await user.click(within(bar).getByRole('button', { name: 'Delete' }));
            expect(ACTIONS[1]!.onClick).toHaveBeenCalledTimes(1);
        });

        it('shows no reason when the primary button is enabled', () => {
            renderWithProviders(
                <WordEditorLayout
                    sections={SECTIONS}
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
                    sections={SECTIONS}
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

            // Each action exists once — in the slide-in menu, above the sections.
            expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
            await user.click(screen.getByRole('button', { name: 'Open menu' }));
            const drawer = screen.getByRole('dialog');
            expect(screen.getAllByRole('button', { name: 'Delete' })).toHaveLength(1);
            expect(within(drawer).getByRole('button', { name: 'Delete' })).toBeInTheDocument();

            await user.click(within(drawer).getByRole('button', { name: 'Change word type' }));
            expect(ACTIONS[0]!.onClick).toHaveBeenCalledTimes(1);
            // Choosing an action closes the menu.
            await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        });

        it('desktop: cancelAction renders immediately next to (left of) the primary button, not in the left-hand actions group', async () => {
            const user = userEvent.setup();
            const onCancel = vi.fn();
            renderWithProviders(
                <WordEditorLayout
                    sections={SECTIONS}
                    actions={ACTIONS}
                    cancelAction={{ key: 'cancel', label: 'Cancel', icon: null, onClick: onCancel }}
                    primary={{ label: 'Save word', icon: null, onClick: vi.fn() }}
                >
                    <div>Translation cards</div>
                </WordEditorLayout>,
            );

            const bar = screen.getByTestId('word-editor-bar');
            const names = within(bar)
                .getAllByRole('button')
                .map((button) => button.textContent);
            expect(names.indexOf('Save word')).toBe(names.indexOf('Cancel') + 1);
            expect(names.indexOf('Delete')).toBeLessThan(names.indexOf('Cancel'));

            await user.click(within(bar).getByRole('button', { name: 'Cancel' }));
            expect(onCancel).toHaveBeenCalledTimes(1);
        });

        it('phone: cancelAction moves into the drawer alongside the other actions, not the bar', async () => {
            mockMobileViewport();
            const user = userEvent.setup();
            const onCancel = vi.fn();
            renderWithProviders(
                <WordEditorLayout
                    sections={SECTIONS}
                    actions={ACTIONS}
                    cancelAction={{ key: 'cancel', label: 'Cancel', icon: null, onClick: onCancel }}
                    primary={{ label: 'Save word', icon: null, onClick: vi.fn() }}
                >
                    <div>Translation cards</div>
                </WordEditorLayout>,
            );

            const bar = screen.getByTestId('word-editor-bar');
            expect(within(bar).queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();

            await user.click(screen.getByRole('button', { name: 'Open menu' }));
            const drawer = screen.getByRole('dialog');
            await user.click(within(drawer).getByRole('button', { name: 'Cancel' }));
            expect(onCancel).toHaveBeenCalledTimes(1);
        });

        it('phone: ignores the stored rail preference — the menu always shows the full sections', async () => {
            mockMobileViewport();
            const user = userEvent.setup();
            useUiStore.getState().setSidebarCollapsed('word', true);
            renderWithProviders(
                <WordEditorLayout sections={SECTIONS}>
                    <div>Translation cards</div>
                </WordEditorLayout>,
            );
            await user.click(screen.getByRole('button', { name: 'Open menu' }));
            expect(within(screen.getByRole('dialog')).getByText('Sidebar content')).toBeInTheDocument();
        });
    });
});
