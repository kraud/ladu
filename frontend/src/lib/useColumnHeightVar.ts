/**
 * Lets an icon be as tall as the text column beside it. CSS alone cannot do that (a stretched box gives
 * an `aspect-ratio` child no width), so the column's height is measured and handed to the container as a
 * CSS variable that the icon reads (`size-[var(--name,2rem)]`). The text column never depends on the
 * icon, so this cannot loop. Used by the dashboard's welcome banner and the "Start from a word" section.
 *
 * Attach `containerRef` to the element that holds both and `columnRef` to the text column.
 */
import { useEffect, useRef } from 'react';

export function useColumnHeightVar<C extends HTMLElement = HTMLElement, T extends HTMLElement = HTMLDivElement>(variable: string) {
    const containerRef = useRef<C>(null);
    const columnRef = useRef<T>(null);

    useEffect(() => {
        const container = containerRef.current;
        const column = columnRef.current;
        // ResizeObserver is missing in jsdom: the variable then stays unset and the icon keeps its default size.
        if (!container || !column || typeof ResizeObserver === 'undefined') return;
        const apply = () => container.style.setProperty(variable, `${column.offsetHeight}px`);
        apply();
        const observer = new ResizeObserver(apply);
        observer.observe(column);
        return () => observer.disconnect();
    }, [variable]);

    return { containerRef, columnRef };
}
