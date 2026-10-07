/**
 * Swipe gestures for the phone menu. The sheet component has no gesture support, so these two helpers
 * read plain touch events:
 *
 * - `useEdgeSwipeOpen`: a swipe to the right that starts in a thin strip at the left edge of the window.
 * - `useSwipeCloseProps`: a swipe to the left on the open menu.
 *
 * A swipe counts only when it is long enough and mostly horizontal, so scrolling a page or a list is never
 * taken for one. The listeners are passive: they never block the scroll.
 *
 * Known limit: Safari on iOS uses a swipe from the left edge for "back"; there the browser wins.
 */
import { useEffect, useRef, type TouchEvent as ReactTouchEvent } from 'react';

/** The strip at the left edge where an opening swipe may start, in px. */
export const EDGE_WIDTH = 24;
/** The least horizontal distance of a swipe, in px. */
export const MIN_DISTANCE = 60;
/** How much longer than vertical a swipe must be. */
const HORIZONTAL_RATIO = 1.5;

interface Point {
    x: number;
    y: number;
}

/** `'right'`, `'left'`, or `null` when the move is too short or not horizontal enough. */
export function swipeDirection(start: Point, end: Point): 'left' | 'right' | null {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    if (Math.abs(dx) < MIN_DISTANCE || Math.abs(dx) < Math.abs(dy) * HORIZONTAL_RATIO) return null;
    return dx > 0 ? 'right' : 'left';
}

/** Calls `onOpen` for a swipe to the right that starts at the left edge. Does nothing while `enabled` is false or a dialog is open. */
export function useEdgeSwipeOpen(enabled: boolean, onOpen: () => void) {
    useEffect(() => {
        if (!enabled) return;
        let start: Point | null = null;

        const onStart = (event: TouchEvent) => {
            const touch = event.touches[0];
            const dialogOpen = document.querySelector('[role="dialog"]') !== null;
            start =
                event.touches.length === 1 && touch && touch.clientX <= EDGE_WIDTH && !dialogOpen
                    ? { x: touch.clientX, y: touch.clientY }
                    : null;
        };
        const onEnd = (event: TouchEvent) => {
            const touch = event.changedTouches[0];
            const from = start;
            start = null;
            if (from && touch && swipeDirection(from, { x: touch.clientX, y: touch.clientY }) === 'right') onOpen();
        };
        const onCancel = () => {
            start = null;
        };

        window.addEventListener('touchstart', onStart, { passive: true });
        window.addEventListener('touchend', onEnd, { passive: true });
        window.addEventListener('touchcancel', onCancel, { passive: true });
        return () => {
            window.removeEventListener('touchstart', onStart);
            window.removeEventListener('touchend', onEnd);
            window.removeEventListener('touchcancel', onCancel);
        };
    }, [enabled, onOpen]);
}

/** Touch props for the open menu: a swipe to the left calls `onClose`. */
export function useSwipeCloseProps(onClose: () => void) {
    // A ref, not a plain variable: a render between the touch start and end must not lose the start point.
    const start = useRef<Point | null>(null);
    return {
        onTouchStart: (event: ReactTouchEvent) => {
            const touch = event.touches[0];
            start.current = event.touches.length === 1 && touch ? { x: touch.clientX, y: touch.clientY } : null;
        },
        onTouchEnd: (event: ReactTouchEvent) => {
            const touch = event.changedTouches[0];
            const from = start.current;
            start.current = null;
            if (from && touch && swipeDirection(from, { x: touch.clientX, y: touch.clientY }) === 'left') onClose();
        },
    };
}
