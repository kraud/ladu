import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HorizontalBars } from '@/components/charts/HorizontalBars';

const draw = (rows: { label: string; value: number }[], total = 100) =>
    render(<HorizontalBars rows={rows} total={total} unit="users" emptyMessage="Nobody yet." />);

describe('HorizontalBars', () => {
    it('shows each row with its value and its share, in the order given', () => {
        draw([
            { label: 'English', value: 60 },
            { label: 'German', value: 30 },
            { label: 'Estonian', value: 5 },
        ]);

        const items = screen.getAllByRole('listitem');
        expect(items.map((li) => li.textContent)).toEqual(['English60 · 60%', 'German30 · 30%', 'Estonian5 · 5%']);
    });

    it('makes the longest bar the longest, and the others in proportion', () => {
        draw([
            { label: 'A', value: 40 },
            { label: 'B', value: 20 },
        ]);

        const [a, b] = screen.getAllByTestId('bar');
        // The CSS class turns the ratio into a width: (the room for bars) x ratio.
        expect(a.style.getPropertyValue('--ratio')).toBe('1');
        expect(b.style.getPropertyValue('--ratio')).toBe('0.5');
    });

    it('gives every bar the same color, because the categories have no order', () => {
        draw([
            { label: 'A', value: 40 },
            { label: 'B', value: 1 },
        ]);

        const classes = screen.getAllByTestId('bar').map((bar) => bar.className);
        expect(new Set(classes).size).toBe(1);
    });

    it('leaves a bar with no users without width, and a tiny one visible', () => {
        draw([
            { label: 'Big', value: 1000 },
            { label: 'Tiny', value: 1 },
            { label: 'None', value: 0 },
        ], 1001);

        const [, tiny, none] = screen.getAllByTestId('bar');
        expect(tiny.style.minWidth).toBe('2px');
        expect(none.style.minWidth).toBe('');
        expect(none.style.getPropertyValue('--ratio')).toBe('0');
    });

    it('describes each bar for a screen reader', () => {
        draw([{ label: 'English', value: 60 }]);

        expect(screen.getByRole('img', { name: 'English: 60 users, 60% of all' })).toBeInTheDocument();
    });

    it('says so when there is nothing to show', () => {
        draw([]);

        expect(screen.getByText('Nobody yet.')).toBeInTheDocument();
        expect(screen.queryByRole('list')).not.toBeInTheDocument();
    });

    it('does not divide by zero when there are no users at all', () => {
        draw([{ label: 'English', value: 0 }], 0);

        expect(screen.getByText(/· –/)).toBeInTheDocument();
    });
});
