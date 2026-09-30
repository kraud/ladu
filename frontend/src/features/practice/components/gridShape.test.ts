import { describe, expect, it } from 'vitest';
import { gridItemStyle, gridShape, gridStyle } from './gridShape';

describe('gridShape (rows × columns)', () => {
    it.each([
        [1, 1, 1],
        [2, 2, 1],
        [3, 2, 2],
        [4, 2, 2],
        [5, 2, 3],
        [6, 2, 3],
        [7, 2, 4],
        [8, 2, 4],
        [9, 2, 5],
    ])('%i items -> %i × %i', (count, rows, cols) => {
        expect(gridShape(count)).toEqual({ rows, cols });
    });

    it('always has room for every item', () => {
        for (let count = 1; count <= 20; count++) {
            const { rows, cols } = gridShape(count);
            expect(rows * cols).toBeGreaterThanOrEqual(count);
        }
    });
});

describe('gridStyle', () => {
    it('fixes the rows and fills column by column', () => {
        expect(gridStyle(3)).toEqual({ gridTemplateRows: 'repeat(2, max-content)', gridAutoFlow: 'column' });
        expect(gridStyle(1)).toEqual({ gridTemplateRows: 'repeat(1, max-content)', gridAutoFlow: 'column' });
    });
});

describe('gridItemStyle', () => {
    it('puts the lone last item of an odd count in the last column, on the bottom row', () => {
        expect(gridItemStyle(2, 3)).toEqual({ gridRow: 2, gridColumn: 2 });
        expect(gridItemStyle(4, 5)).toEqual({ gridRow: 2, gridColumn: 3 });
    });

    it('leaves every other item to the automatic placement', () => {
        expect(gridItemStyle(0, 3)).toBeUndefined();
        expect(gridItemStyle(1, 3)).toBeUndefined();
        expect(gridItemStyle(3, 4)).toBeUndefined(); // even count: full grid
        expect(gridItemStyle(0, 1)).toBeUndefined(); // a single item is a 1×1 grid
    });
});
