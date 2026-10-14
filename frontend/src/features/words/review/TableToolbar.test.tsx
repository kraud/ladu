import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { TableToolbar, type TableToolbarProps } from './TableToolbar';

const baseProps: TableToolbarProps = {
    initialQuery: '',
    onQueryChange: vi.fn(),
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

describe('TableToolbar — row count', () => {
    it('renders loaded/total', () => {
        renderWithProviders(<TableToolbar {...baseProps} loadedCount={3} total={10} />);
        expect(screen.getByText('3 of 10 words')).toBeInTheDocument();
    });
});

describe('TableToolbar — phone layout', () => {
    it('compact removes the count but keeps search', () => {
        renderWithProviders(<TableToolbar {...baseProps} compact />);
        expect(screen.getByRole('textbox', { name: 'Filter table' })).toBeInTheDocument();
        expect(screen.queryByText('3 of 10 words')).not.toBeInTheDocument();
    });

    it('renders `leading` before the search box', () => {
        renderWithProviders(<TableToolbar {...baseProps} leading={<button type="button">Lead</button>} />);
        const lead = screen.getByRole('button', { name: 'Lead' });
        const search = screen.getByRole('textbox', { name: 'Filter table' });
        expect(lead.compareDocumentPosition(search) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
});
