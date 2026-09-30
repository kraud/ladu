/**
 * Rows × columns of a grid for `count` items: one item is a single cell; from two on
 * there are always two rows, and the columns grow with the count (`ceil(count / 2)`).
 * With an odd count the last column holds a single item, on its bottom row (the grids fill
 * column by column — see `gridStyle` and `gridItemStyle`). The same rule serves the flags
 * and the word types.
 */
export function gridShape(count: number): { rows: number; cols: number } {
    if (count <= 1) return { rows: 1, cols: 1 };
    return { rows: 2, cols: Math.ceil(count / 2) };
}

/** CSS for a grid of `count` items: `rows` fixed rows, filled column by column. */
export function gridStyle(count: number): { gridTemplateRows: string; gridAutoFlow: 'column' } {
    const { rows } = gridShape(count);
    return { gridTemplateRows: `repeat(${rows}, max-content)`, gridAutoFlow: 'column' };
}

/**
 * Placement of one item. Only the last item of an odd count needs it: it sits in the last
 * column, on the bottom row, so the empty cell is above it, not below.
 */
export function gridItemStyle(index: number, count: number): { gridRow: number; gridColumn: number } | undefined {
    const { rows, cols } = gridShape(count);
    if (rows === 2 && count % 2 === 1 && index === count - 1) return { gridRow: 2, gridColumn: cols };
    return undefined;
}
