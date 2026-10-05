/**
 * A box that scrolls sideways and says so: while more content lies past an
 * edge, that edge fades out and shows a small arrow. Without this, a grid
 * cut at exactly two columns looks complete until the user drags it.
 * Used for wide grid blocks in `TranslationCard` (a verb's tenses).
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { CaretLeftIcon, CaretRightIcon } from '@phosphor-icons/react';

export function HorizontalScroller({ children }: { children: ReactNode }) {
    const ref = useRef<HTMLDivElement>(null);
    const [edges, setEdges] = useState({ left: false, right: false });

    const update = useCallback(() => {
        const el = ref.current;
        if (!el) return;
        const maxScroll = el.scrollWidth - el.clientWidth;
        setEdges({ left: el.scrollLeft > 1, right: el.scrollLeft < maxScroll - 1 });
    }, []);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        update();
        if (typeof ResizeObserver === 'undefined') return;
        const observer = new ResizeObserver(update);
        observer.observe(el);
        if (el.firstElementChild) observer.observe(el.firstElementChild);
        return () => observer.disconnect();
    }, [update]);

    return (
        <div className="relative" data-testid="horizontal-scroller">
            <div ref={ref} onScroll={update} className="-mx-1 overflow-x-auto px-1 pb-2">
                {children}
            </div>
            {edges.left && <EdgeHint side="left" />}
            {edges.right && <EdgeHint side="right" />}
        </div>
    );
}

function EdgeHint({ side }: { side: 'left' | 'right' }) {
    const Icon = side === 'left' ? CaretLeftIcon : CaretRightIcon;
    return (
        <div
            aria-hidden
            data-testid={`scroll-hint-${side}`}
            className={`pointer-events-none absolute inset-y-0 bottom-2 flex w-10 items-center from-card to-transparent text-muted-foreground ${
                side === 'left' ? 'left-0 justify-start bg-linear-to-r' : 'right-0 justify-end bg-linear-to-l'
            }`}
        >
            <Icon size={16} weight="bold" />
        </div>
    );
}
