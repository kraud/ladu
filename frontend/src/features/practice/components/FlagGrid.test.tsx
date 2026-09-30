import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FlagGrid } from './FlagGrid';

describe('FlagGrid', () => {
    it('puts every flag in the grid with the columns of its shape, and hides it from screen readers', () => {
        render(<FlagGrid languages={['English', 'Spanish', 'German', 'Estonian', 'English']} />);

        const grid = screen.getByTestId('flag-grid');
        expect(grid).toHaveAttribute('aria-hidden', 'true');
        expect(grid.children).toHaveLength(5);
        expect(grid.children[4]).toHaveStyle({ gridRow: '2', gridColumn: '3' });
        expect(grid.children[0]).not.toHaveStyle({ gridRow: '2' });
        // Five flags: two rows, filled column by column (the last flag is alone, on the bottom row).
        expect(grid).toHaveStyle({ gridTemplateRows: 'repeat(2, max-content)', gridAutoFlow: 'column' });
    });
});
