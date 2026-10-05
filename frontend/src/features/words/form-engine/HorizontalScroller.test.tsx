import { afterEach, describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { HorizontalScroller } from './HorizontalScroller';

// jsdom has no layout: give the scroll box the measurements a real one would have.
function measure(el: HTMLElement, { scrollWidth, clientWidth }: { scrollWidth: number; clientWidth: number }) {
    Object.defineProperty(el, 'scrollWidth', { configurable: true, value: scrollWidth });
    Object.defineProperty(el, 'clientWidth', { configurable: true, value: clientWidth });
}

afterEach(() => {
    delete (globalThis as { ResizeObserver?: unknown }).ResizeObserver;
});

describe('HorizontalScroller', () => {
    it('hints the hidden side: right at the start, both in the middle, left at the end', () => {
        render(
            <HorizontalScroller>
                <div>wide</div>
            </HorizontalScroller>,
        );
        const box = screen.getByTestId('horizontal-scroller').firstElementChild as HTMLElement;
        measure(box, { scrollWidth: 600, clientWidth: 300 });

        fireEvent.scroll(box);
        expect(screen.getByTestId('scroll-hint-right')).toBeInTheDocument();
        expect(screen.queryByTestId('scroll-hint-left')).not.toBeInTheDocument();

        box.scrollLeft = 150;
        fireEvent.scroll(box);
        expect(screen.getByTestId('scroll-hint-right')).toBeInTheDocument();
        expect(screen.getByTestId('scroll-hint-left')).toBeInTheDocument();

        box.scrollLeft = 300;
        fireEvent.scroll(box);
        expect(screen.queryByTestId('scroll-hint-right')).not.toBeInTheDocument();
        expect(screen.getByTestId('scroll-hint-left')).toBeInTheDocument();
    });

    it('shows no hint when everything fits', () => {
        render(
            <HorizontalScroller>
                <div>narrow</div>
            </HorizontalScroller>,
        );
        const box = screen.getByTestId('horizontal-scroller').firstElementChild as HTMLElement;
        measure(box, { scrollWidth: 300, clientWidth: 300 });
        act(() => {
            fireEvent.scroll(box);
        });
        expect(screen.queryByTestId('scroll-hint-right')).not.toBeInTheDocument();
        expect(screen.queryByTestId('scroll-hint-left')).not.toBeInTheDocument();
    });
});
