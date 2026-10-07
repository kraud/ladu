import { describe, expect, it, vi } from 'vitest';
import { fireEvent, renderHook } from '@testing-library/react';
import { EDGE_WIDTH, MIN_DISTANCE, swipeDirection, useEdgeSwipeOpen } from './useSwipe';

describe('swipeDirection', () => {
    it('reads a long, mostly horizontal move as a swipe', () => {
        expect(swipeDirection({ x: 5, y: 300 }, { x: 5 + MIN_DISTANCE, y: 310 })).toBe('right');
        expect(swipeDirection({ x: 200, y: 300 }, { x: 200 - MIN_DISTANCE, y: 290 })).toBe('left');
    });

    it('ignores a short move and a move that is mostly vertical (a scroll)', () => {
        expect(swipeDirection({ x: 5, y: 300 }, { x: 5 + MIN_DISTANCE - 1, y: 300 })).toBeNull();
        expect(swipeDirection({ x: 5, y: 300 }, { x: 5 + 80, y: 300 + 80 })).toBeNull();
    });
});

/** A touch gesture on the window, from one point to another. */
function swipe(from: { x: number; y: number }, to: { x: number; y: number }) {
    fireEvent.touchStart(document.body, { touches: [{ clientX: from.x, clientY: from.y }] });
    fireEvent.touchEnd(document.body, { changedTouches: [{ clientX: to.x, clientY: to.y }] });
}

describe('useEdgeSwipeOpen', () => {
    it('opens for a swipe to the right that starts at the left edge', () => {
        const onOpen = vi.fn();
        renderHook(() => useEdgeSwipeOpen(true, onOpen));
        swipe({ x: EDGE_WIDTH - 4, y: 300 }, { x: 160, y: 310 });
        expect(onOpen).toHaveBeenCalledTimes(1);
    });

    it('does not open when the swipe starts away from the edge', () => {
        const onOpen = vi.fn();
        renderHook(() => useEdgeSwipeOpen(true, onOpen));
        swipe({ x: EDGE_WIDTH + 40, y: 300 }, { x: 260, y: 300 });
        expect(onOpen).not.toHaveBeenCalled();
    });

    it('does not open for a swipe to the left, or a vertical scroll from the edge', () => {
        const onOpen = vi.fn();
        renderHook(() => useEdgeSwipeOpen(true, onOpen));
        swipe({ x: 10, y: 300 }, { x: 10, y: 520 });
        swipe({ x: 10, y: 300 }, { x: 0, y: 300 });
        expect(onOpen).not.toHaveBeenCalled();
    });

    it('does nothing when disabled (desktop, or the menu is already open)', () => {
        const onOpen = vi.fn();
        renderHook(() => useEdgeSwipeOpen(false, onOpen));
        swipe({ x: 5, y: 300 }, { x: 200, y: 300 });
        expect(onOpen).not.toHaveBeenCalled();
    });

    it('does nothing while a dialog is open', () => {
        const dialog = document.createElement('div');
        dialog.setAttribute('role', 'dialog');
        document.body.appendChild(dialog);
        const onOpen = vi.fn();
        renderHook(() => useEdgeSwipeOpen(true, onOpen));
        swipe({ x: 5, y: 300 }, { x: 200, y: 300 });
        expect(onOpen).not.toHaveBeenCalled();
        dialog.remove();
    });

    it('stops listening when it unmounts', () => {
        const onOpen = vi.fn();
        const { unmount } = renderHook(() => useEdgeSwipeOpen(true, onOpen));
        unmount();
        swipe({ x: 5, y: 300 }, { x: 200, y: 300 });
        expect(onOpen).not.toHaveBeenCalled();
    });
});
