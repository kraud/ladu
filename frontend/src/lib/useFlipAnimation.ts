import { useLayoutEffect, useRef } from 'react';

const DEFAULT_DURATION_MS = 200;

/**
 * FLIP (First-Last-Invert-Play) position animation for a set of DOM nodes
 * keyed by an arbitrary id, re-run whenever `dep` changes (typically the
 * ordered array driving the list itself). Register each node's ref via the
 * returned `registerNode(id)` ref-callback — React reuses the same DOM node
 * across a reorder as long as its React `key` is stable, which is exactly
 * what lets this hook read a node's position *before* the reorder (from the
 * previous run) and *after* it (this run) and animate the difference.
 *
 * A node whose position didn't change between runs is left untouched, so
 * this is a no-op for e.g. a pure visibility/style toggle that never moves
 * anything — only an actual reorder animates.
 *
 * First build for `LanguageOrderControl`'s ← / → reordering, which lost its
 * own drag gesture's built-in movement feedback when the two-container
 * dnd-kit version was simplified away (D19) — this restores that feedback
 * without dnd-kit.
 */
export function useFlipAnimation<Id>(dep: unknown, durationMs = DEFAULT_DURATION_MS) {
    const nodes = useRef(new Map<Id, HTMLElement>());
    const prevRects = useRef(new Map<Id, DOMRect>());

    useLayoutEffect(() => {
        const nextRects = new Map<Id, DOMRect>();
        nodes.current.forEach((el, id) => nextRects.set(id, el.getBoundingClientRect()));

        nodes.current.forEach((el, id) => {
            const prev = prevRects.current.get(id);
            const next = nextRects.get(id);
            if (!prev || !next) return;

            const deltaX = prev.left - next.left;
            const deltaY = prev.top - next.top;
            if (deltaX === 0 && deltaY === 0) return;

            // Invert: jump the node back to where it visually was, with no
            // transition, then force layout so that jump actually applies
            // before the next line re-enables the transition.
            el.style.transition = 'none';
            el.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
            el.getBoundingClientRect();

            // Play: on the next frame, animate from the inverted position
            // back to the node's real (already-committed) layout position.
            requestAnimationFrame(() => {
                el.style.transition = `transform ${durationMs}ms ease`;
                el.style.transform = '';
            });
        });

        prevRects.current = nextRects;
        // `durationMs` is a per-call constant, not reactive state.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dep]);

    return function registerNode(id: Id) {
        return (el: HTMLElement | null) => {
            if (el) nodes.current.set(id, el);
            else nodes.current.delete(id);
        };
    };
}
