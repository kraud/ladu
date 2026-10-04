import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { mockMobileViewport } from '@/test/viewport';
import { useUiStore } from '@/stores/uiStore';
import { SidebarLayout, SidebarTrigger, type SidebarSection } from './SidebarLayout';

afterEach(() => {
    useUiStore.getState().setSidebarCollapsed('review', false);
});

const SECTIONS: SidebarSection[] = [
    { id: 'one', label: 'First', icon: <i />, content: <div>First content</div> },
    {
        id: 'two',
        label: 'Second',
        icon: <i data-icon="plain" />,
        filledIcon: <i data-icon="filled" />,
        filled: true,
        count: 3,
        focusSelector: 'input',
        content: <input aria-label="Second field" />,
    },
];

function renderLayout(props: Partial<React.ComponentProps<typeof SidebarLayout>> = {}) {
    return renderWithProviders(
        <SidebarLayout id="review" label="Filters" sections={SECTIONS} {...props}>
            <SidebarTrigger label="Open filters">+</SidebarTrigger>
            <div>Page content</div>
        </SidebarLayout>,
    );
}

describe('SidebarLayout — desktop', () => {
    it('shows the panel with every section heading and the page content', () => {
        renderLayout();
        const panel = screen.getByRole('complementary', { name: 'Filters' });
        expect(within(panel).getByRole('heading', { name: 'First' })).toBeInTheDocument();
        expect(within(panel).getByText('First content')).toBeInTheDocument();
        expect(screen.getByText('Page content')).toBeInTheDocument();
        // The slide-in trigger is a phone control.
        expect(screen.queryByRole('button', { name: 'Open filters' })).not.toBeInTheDocument();
    });

    it('shows the panel title in the header row, beside the collapse button', () => {
        renderLayout();
        const panel = screen.getByRole('complementary', { name: 'Filters' });
        const title = within(panel).getByRole('heading', { name: 'Filters', level: 2 });
        expect(title.parentElement).toContainElement(within(panel).getByRole('button', { name: 'Collapse sidebar' }));
    });

    it('a lone section with the same name as the panel is not repeated under the title', () => {
        renderWithProviders(
            <SidebarLayout
                id="review"
                label="Selected words"
                sections={[{ id: 'one', label: 'Selected words', icon: <i />, content: <div>Only content</div> }]}
            >
                <div>Page content</div>
            </SidebarLayout>,
        );
        expect(screen.getAllByRole('heading', { name: 'Selected words' })).toHaveLength(1);
    });

    it('the collapse button toggles the stored flag of this sidebar only', async () => {
        const user = userEvent.setup();
        renderLayout();
        await user.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
        expect(useUiStore.getState().sidebarCollapsed.review).toBe(true);
        expect(useUiStore.getState().sidebarCollapsed.word).toBe(false);
        expect(screen.getByRole('button', { name: 'Expand sidebar' })).toHaveAttribute('aria-expanded', 'false');
    });

    it('collapsed: one rail button per section, filled icon and count badge, no content', () => {
        useUiStore.getState().setSidebarCollapsed('review', true);
        renderLayout();
        expect(screen.queryByText('First content')).not.toBeInTheDocument();
        const first = screen.getByRole('button', { name: 'First' });
        const second = screen.getByRole('button', { name: 'Second' });
        expect(first).not.toHaveAttribute('data-filled');
        expect(second).toHaveAttribute('data-filled', 'true');
        expect(second.querySelector('[data-icon="filled"]')).toBeInTheDocument();
        expect(screen.getByTestId('two-count')).toHaveTextContent('3');
        expect(screen.queryByTestId('one-count')).not.toBeInTheDocument();
    });

    it('a rail button expands the panel and focuses the section field', async () => {
        const user = userEvent.setup();
        useUiStore.getState().setSidebarCollapsed('review', true);
        renderLayout();
        await user.click(screen.getByRole('button', { name: 'Second' }));
        expect(useUiStore.getState().sidebarCollapsed.review).toBe(false);
        expect(screen.getByLabelText('Second field')).toHaveFocus();
    });

    it('renders the footer outside the panel', () => {
        renderLayout({ footer: <div>Footer bar</div> });
        expect(screen.getByText('Footer bar')).toBeInTheDocument();
        expect(within(screen.getByRole('complementary')).queryByText('Footer bar')).not.toBeInTheDocument();
    });
});

describe('SidebarLayout — phone', () => {
    it('has no panel on the page; the trigger opens the slide-in menu and the close button closes it', async () => {
        mockMobileViewport();
        const user = userEvent.setup();
        renderLayout({ drawerTop: <div>Drawer top</div> });
        expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
        expect(screen.queryByText('First content')).not.toBeInTheDocument();

        const trigger = screen.getByRole('button', { name: 'Open filters' });
        expect(trigger).toHaveAttribute('aria-expanded', 'false');
        await user.click(trigger);

        const menu = screen.getByRole('dialog');
        expect(within(menu).getByText('Drawer top')).toBeInTheDocument();
        expect(within(menu).getByText('First content')).toBeInTheDocument();
        expect(trigger).toHaveAttribute('aria-expanded', 'true');

        await user.click(within(menu).getByRole('button', { name: 'Close menu' }));
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });

    it('the title of the slide-in menu is the panel title', async () => {
        mockMobileViewport();
        const user = userEvent.setup();
        renderLayout();
        await user.click(screen.getByRole('button', { name: 'Open filters' }));
        expect(within(screen.getByRole('dialog')).getByRole('heading', { name: 'Filters' })).toBeInTheDocument();
    });

    it('Escape closes the menu', async () => {
        mockMobileViewport();
        const user = userEvent.setup();
        renderLayout();
        await user.click(screen.getByRole('button', { name: 'Open filters' }));
        await user.keyboard('{Escape}');
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });

    it('ignores the stored rail preference: the menu always shows the full sections', async () => {
        mockMobileViewport();
        const user = userEvent.setup();
        useUiStore.getState().setSidebarCollapsed('review', true);
        renderLayout();
        await user.click(screen.getByRole('button', { name: 'Open filters' }));
        expect(within(screen.getByRole('dialog')).getByText('First content')).toBeInTheDocument();
    });
});
