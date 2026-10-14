import { useRef, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { isPlainRowClick } from './rowClick';

const LONG_PRESS_MS = 450;
/** A finger that moves farther than this (px) is scrolling, not pressing. */
const LONG_PRESS_SLOP = 10;

export interface RowPressActions {
    /** The long press: selects this row. */
    select: () => void;
    /** A tap while something is selected: selects or unselects this row. */
    toggle: () => void;
    /** A tap with nothing selected (not on a button or link): for example "open this word". */
    onTap?: () => void;
}

/**
 * Phone row selection, shared by `/words` (`ReviewTable`) and `/tag/:id` (`TagWordsTable`):
 * a long press selects the row; once something is selected a tap toggles a row (the cells' own
 * buttons stay quiet); with nothing selected a tap that is not on a button is `onTap`.
 *
 * `hasSelection` must be true while any row is selected. Call the returned function once per
 * row and spread the result on the `<tr>`.
 */
export function useRowPress(hasSelection: boolean) {
    const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pressStart = useRef<{ x: number; y: number } | null>(null);
    const pressFired = useRef(false);

    function cancelPress() {
        if (pressTimer.current) clearTimeout(pressTimer.current);
        pressTimer.current = null;
        pressStart.current = null;
    }

    function startPress(event: ReactPointerEvent, select: () => void) {
        pressStart.current = { x: event.clientX, y: event.clientY };
        pressTimer.current = setTimeout(() => {
            pressFired.current = true;
            pressTimer.current = null;
            select();
        }, LONG_PRESS_MS);
    }

    function movePress(event: ReactPointerEvent) {
        const start = pressStart.current;
        if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > LONG_PRESS_SLOP) cancelPress();
    }

    return ({ select, toggle, onTap }: RowPressActions) => ({
        onPointerDown: (event: ReactPointerEvent) => {
            pressFired.current = false;
            if (!hasSelection) startPress(event, select);
        },
        onPointerMove: movePress,
        onPointerUp: cancelPress,
        onPointerCancel: cancelPress,
        onContextMenu: (event: ReactMouseEvent) => event.preventDefault(),
        onClickCapture: (event: ReactMouseEvent) => {
            // The click that ends a long press, or a tap while selecting, is for the row only.
            if (pressFired.current) {
                pressFired.current = false;
                event.preventDefault();
                event.stopPropagation();
            } else if (hasSelection) {
                event.preventDefault();
                event.stopPropagation();
                toggle();
            } else if (isPlainRowClick(event)) {
                onTap?.();
            }
        },
    });
}
