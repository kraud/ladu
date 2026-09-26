import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { TableToolbar, type TableToolbarProps } from './TableToolbar';

const baseProps: TableToolbarProps = {
    initialQuery: '',
    onQueryChange: vi.fn(),
    showSwitch: false,
    showGender: true,
    onShowGenderChange: vi.fn(),
    showProgress: true,
    onShowProgressChange: vi.fn(),
    loadedCount: 3,
    total: 10,
};

beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
    vi.useRealTimers();
});

describe('TableToolbar — search debounce', () => {
    it('does not write until 500ms after the last keystroke', async () => {
        const onQueryChange = vi.fn();
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
        renderWithProviders(<TableToolbar {...baseProps} onQueryChange={onQueryChange} />);

        await user.type(screen.getByLabelText('Filter table'), 'cat');
        expect(onQueryChange).not.toHaveBeenCalled();

        await act(async () => {
            await vi.advanceTimersByTimeAsync(500);
        });
        expect(onQueryChange).toHaveBeenCalledWith('cat');
    });

    it('resets the debounce timer on every keystroke', async () => {
        const onQueryChange = vi.fn();
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
        renderWithProviders(<TableToolbar {...baseProps} onQueryChange={onQueryChange} />);

        const input = screen.getByLabelText('Filter table');
        await user.type(input, 'c');
        await act(async () => {
            await vi.advanceTimersByTimeAsync(300);
        });
        await user.type(input, 'a');
        await act(async () => {
            await vi.advanceTimersByTimeAsync(300);
        });
        expect(onQueryChange).not.toHaveBeenCalled();

        await act(async () => {
            await vi.advanceTimersByTimeAsync(200);
        });
        expect(onQueryChange).toHaveBeenCalledWith('ca');
    });

    it('reports undefined for a whitespace-only value', async () => {
        const onQueryChange = vi.fn();
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
        renderWithProviders(<TableToolbar {...baseProps} onQueryChange={onQueryChange} />);

        await user.type(screen.getByLabelText('Filter table'), '   ');
        await act(async () => {
            await vi.advanceTimersByTimeAsync(500);
        });
        expect(onQueryChange).toHaveBeenCalledWith(undefined);
    });

    it('seeds the box from initialQuery and resyncs on an external reset', () => {
        const { rerender } = renderWithProviders(<TableToolbar {...baseProps} initialQuery="cat" />);
        const input = screen.getByLabelText('Filter table') as HTMLInputElement;
        expect(input.value).toBe('cat');

        rerender(<TableToolbar {...baseProps} initialQuery="" />);
        expect(input.value).toBe('');
    });
});

describe('TableToolbar — Display-gender switch (D14)', () => {
    it('is hidden when showSwitch is false', () => {
        renderWithProviders(<TableToolbar {...baseProps} showSwitch={false} />);
        expect(screen.queryByText('Display gender')).not.toBeInTheDocument();
    });

    it('is shown, and toggles, when showSwitch is true', async () => {
        const onShowGenderChange = vi.fn();
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
        renderWithProviders(
            <TableToolbar {...baseProps} showSwitch showGender onShowGenderChange={onShowGenderChange} />,
        );

        const toggle = screen.getByText('Display gender').closest('button')!;
        expect(toggle).toHaveAttribute('aria-pressed', 'true');
        await user.click(toggle);
        expect(onShowGenderChange).toHaveBeenCalledWith(false);
    });
});

describe('TableToolbar — Display-progress switch (always visible, unlike gender)', () => {
    it('is shown regardless of showSwitch, and toggles', async () => {
        const onShowProgressChange = vi.fn();
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
        renderWithProviders(
            <TableToolbar
                {...baseProps}
                showSwitch={false}
                showProgress
                onShowProgressChange={onShowProgressChange}
            />,
        );

        const toggle = screen.getByText('Display progress').closest('button')!;
        expect(toggle).toHaveAttribute('aria-pressed', 'true');
        await user.click(toggle);
        expect(onShowProgressChange).toHaveBeenCalledWith(false);
    });
});

describe('TableToolbar — row count', () => {
    it('renders loaded/total', () => {
        renderWithProviders(<TableToolbar {...baseProps} loadedCount={3} total={10} />);
        expect(screen.getByText('3 of 10 words')).toBeInTheDocument();
    });
});

describe('TableToolbar — phone layout', () => {
    it('hideDisplayOptions removes both switches but keeps search and the count', () => {
        renderWithProviders(<TableToolbar {...baseProps} showSwitch hideDisplayOptions />);
        expect(screen.queryByText('Display gender')).not.toBeInTheDocument();
        expect(screen.queryByText('Display progress')).not.toBeInTheDocument();
        expect(screen.getByRole('textbox', { name: 'Filter table' })).toBeInTheDocument();
        expect(screen.getByText('3 of 10 words')).toBeInTheDocument();
    });

    it('renders `leading` before the search box', () => {
        renderWithProviders(<TableToolbar {...baseProps} leading={<button type="button">Lead</button>} />);
        const lead = screen.getByRole('button', { name: 'Lead' });
        const search = screen.getByRole('textbox', { name: 'Filter table' });
        expect(lead.compareDocumentPosition(search) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
});
