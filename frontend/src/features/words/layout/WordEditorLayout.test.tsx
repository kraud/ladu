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

    it('titles the sidebar "Additional information" on desktop and in the phone menu', async () => {
        renderWithProviders(
            <WordEditorLayout sections={SECTIONS}>
                <div>Translation cards</div>
            </WordEditorLayout>,
        );
        const panel = screen.getByRole('complementary', { name: 'Additional information' });
        expect(within(panel).getByRole('heading', { name: 'Additional information' })).toBeInTheDocument();
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

        it('phone: the menu is titled "Additional information"', async () => {
            mockMobileViewport();
            const user = userEvent.setup();
            renderWithProviders(
                <WordEditorLayout sections={SECTIONS}>
                    <div>Translation cards</div>
                </WordEditorLayout>,
            );
            await user.click(screen.getByRole('button', { name: 'Open menu' }));
            expect(within(screen.getByRole('dialog')).getByRole('heading', { name: 'Additional information' })).toBeInTheDocument();
        });

        it('phone: the reason and the primary button share one row (not a column)', () => {
            mockMobileViewport();
            renderWithProviders(
                <WordEditorLayout
                    sections={SECTIONS}
                    primary={{ label: 'Save word', icon: null, onClick: vi.fn(), disabled: true }}
                    statusText="Add at least 2 translations before you can save."
                >
                    <div>Translation cards</div>
                </WordEditorLayout>,
            );
            const row = screen.getByTestId('word-editor-bar').firstElementChild as HTMLElement;
            expect(row.className).toContain('max-[920px]:flex-nowrap');
            expect(row.className).not.toContain('max-[920px]:flex-col');
            expect(screen.getByRole('status').className).toContain('max-[920px]:flex-1');
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

        it('phone: cancelAction stays in the bar, left of a short-labelled primary, and not in the drawer', async () => {
            mockMobileViewport();
            const user = userEvent.setup();
            const onCancel = vi.fn();
            renderWithProviders(
                <WordEditorLayout
                    sections={SECTIONS}
                    actions={ACTIONS}
                    cancelAction={{ key: 'cancel', label: 'Cancel', icon: null, onClick: onCancel }}
                    primary={{ label: 'Save word', shortLabel: 'Save', icon: null, onClick: vi.fn() }}
                >
                    <div>Translation cards</div>
                </WordEditorLayout>,
            );

            const bar = screen.getByTestId('word-editor-bar');
            const names = within(bar)
                .getAllByRole('button')
                .map((button) => button.textContent);
            expect(names).toEqual(['Cancel', 'Save']);
            expect(within(bar).queryByRole('button', { name: 'Save word' })).not.toBeInTheDocument();

            await user.click(within(bar).getByRole('button', { name: 'Cancel' }));
            expect(onCancel).toHaveBeenCalledTimes(1);

            await user.click(screen.getByRole('button', { name: 'Open menu' }));
            expect(within(screen.getByRole('dialog')).queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
        });

        it('phone: Delete is pinned after the sections at the bottom of the drawer, the other actions above them', async () => {
            mockMobileViewport();
            const user = userEvent.setup();
            renderWithProviders(
                <WordEditorLayout sections={SECTIONS} actions={ACTIONS} primary={{ label: 'Save word', icon: null, onClick: vi.fn() }}>
                    <div>Translation cards</div>
                </WordEditorLayout>,
            );

            await user.click(screen.getByRole('button', { name: 'Open menu' }));
            const drawer = screen.getByRole('dialog');
            const change = within(drawer).getByRole('button', { name: 'Change word type' });
            const del = within(drawer).getByRole('button', { name: 'Delete' });
            const section = drawer.querySelector('[data-section]') as HTMLElement;
            expect(change.compareDocumentPosition(section) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
            expect(section.compareDocumentPosition(del) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        });

        it('phone: the menu button sits in the title row and shows no label', async () => {
            mockMobileViewport();
            renderWithProviders(
                <WordEditorLayout sections={SECTIONS} header={<h1>New word</h1>} primary={{ label: 'Save word', icon: null, onClick: vi.fn() }}>
                    <div>Translation cards</div>
                </WordEditorLayout>,
            );

            const heading = screen.getByRole('heading', { name: 'New word' });
            const trigger = screen.getByRole('button', { name: 'Open menu' });
            expect(heading.parentElement?.parentElement).toBe(trigger.parentElement);
            expect(trigger.textContent).toBe('');
        });

        describe('phone: the menu button icons follow the sections', () => {
            const icon = (name: string) => <svg data-testid={name} />;
            const sections = (filled: { clue: boolean; tags: number }) => [
                { id: 'clue', label: 'Clue', icon: icon('clue-plain'), filledIcon: icon('clue-filled'), filled: filled.clue, content: <div /> },
                { id: 'tags', label: 'Tags', icon: icon('tags-plain'), filledIcon: icon('tags-filled'), filled: filled.tags > 0, count: filled.tags, content: <div /> },
                { id: 'linked-words', label: 'Linked words', icon: icon('links-plain'), content: <div /> },
            ];
            const primary = { label: 'Save word', icon: null, onClick: vi.fn() };

            it('editing: all three icons, the filled variant and the count for sections that hold something', () => {
                mockMobileViewport();
                renderWithProviders(
                    <WordEditorLayout sections={sections({ clue: true, tags: 2 })} primary={primary}>
                        <div />
                    </WordEditorLayout>,
                );
                const trigger = screen.getByRole('button', { name: 'Open menu' });
                expect(within(trigger).getByTestId('clue-filled')).toBeInTheDocument();
                expect(within(trigger).getByTestId('tags-filled')).toBeInTheDocument();
                expect(within(trigger).getByTestId('links-plain')).toBeInTheDocument();
                expect(within(trigger).getByText('2')).toBeInTheDocument();
            });

            it('editing with nothing filled: all three plain icons', () => {
                mockMobileViewport();
                renderWithProviders(
                    <WordEditorLayout sections={sections({ clue: false, tags: 0 })} primary={primary}>
                        <div />
                    </WordEditorLayout>,
                );
                const trigger = screen.getByRole('button', { name: 'Open menu' });
                expect(within(trigger).getByTestId('clue-plain')).toBeInTheDocument();
                expect(within(trigger).getByTestId('tags-plain')).toBeInTheDocument();
                expect(within(trigger).getByTestId('links-plain')).toBeInTheDocument();
            });

            it('read-only: only the icons of sections that hold something', () => {
                mockMobileViewport();
                renderWithProviders(
                    <WordEditorLayout readOnly sections={sections({ clue: false, tags: 1 })} primary={primary}>
                        <div />
                    </WordEditorLayout>,
                );
                const trigger = screen.getByRole('button', { name: 'Open menu' });
                expect(within(trigger).getByTestId('tags-filled')).toBeInTheDocument();
                expect(within(trigger).queryByTestId('clue-plain')).not.toBeInTheDocument();
                expect(within(trigger).queryByTestId('links-plain')).not.toBeInTheDocument();
            });

            it('read-only with nothing: a plain menu icon stays so the actions are reachable', () => {
                mockMobileViewport();
                renderWithProviders(
                    <WordEditorLayout readOnly sections={sections({ clue: false, tags: 0 })} primary={primary}>
                        <div />
                    </WordEditorLayout>,
                );
                const trigger = screen.getByRole('button', { name: 'Open menu' });
                expect(trigger.querySelectorAll('svg')).toHaveLength(1);
            });
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
