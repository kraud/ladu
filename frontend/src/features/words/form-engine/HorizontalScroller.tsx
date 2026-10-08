/**
 * A box that scrolls sideways and says so: while more content lies past an
 * edge, that edge fades out and shows a small arrow. The arrow is also a
 * button: it scrolls the box a page toward that edge. Without this, a grid
 * cut at exactly two columns looks complete until the user drags it.
 * Used for wide grid blocks in `TranslationCard` (a verb's tenses).
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
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

    /** Page the box by most of its width, so the last column seen stays in view. */
    function scrollToward(side: 'left' | 'right') {
        const el = ref.current;
        if (!el) return;
        el.scrollBy({ left: (side === 'left' ? -1 : 1) * el.clientWidth * 0.8, behavior: 'smooth' });
    }

    return (
        <div className="relative" data-testid="horizontal-scroller">
            <div ref={ref} onScroll={update} className="-mx-1 overflow-x-auto px-1 pb-2">
                {children}
            </div>
            {edges.left && <EdgeHint side="left" onClick={() => scrollToward('left')} />}
            {edges.right && <EdgeHint side="right" onClick={() => scrollToward('right')} />}
        </div>
    );
}

function EdgeHint({ side, onClick }: { side: 'left' | 'right'; onClick: () => void }) {
    const { t } = useTranslation();
    const Icon = side === 'left' ? CaretLeftIcon : CaretRightIcon;
    return (
        <div
            data-testid={`scroll-hint-${side}`}
            className={`pointer-events-none absolute inset-y-0 bottom-2 flex w-10 items-center from-card to-transparent text-muted-foreground ${
                side === 'left' ? 'left-0 justify-start bg-linear-to-r' : 'right-0 justify-end bg-linear-to-l'
            }`}
        >
            {/* The fade lets touches through to the grid; only the arrow is a button. */}
            <button
                type="button"
                className="pointer-events-auto grid size-8 place-items-center rounded-full"
                aria-label={t(`common:scroll.${side}`)}
                onClick={onClick}
            >
                <Icon size={16} weight="bold" aria-hidden />
            </button>
        </div>
    );
}
