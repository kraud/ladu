import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useFlipAnimation } from './useFlipAnimation';

function TestList({ order }: { order: string[] }) {
    const registerNode = useFlipAnimation<string>(order);
    return (
        <div>
            {order.map((id) => (
                <div key={id} ref={registerNode(id)} data-testid={`item-${id}`} data-id={id}>
                    {id}
                </div>
            ))}
        </div>
    );
}

/**
 * A plain object the tests mutate between renders to move an element —
 * `Element.prototype.getBoundingClientRect` is mocked globally (not per
 * instance) so it's already in place for the very first render's effect,
 * which is what establishes the "before" position the next render diffs
 * against.
 */
let positions: Record<string, { left: number; top: number }>;

describe('useFlipAnimation', () => {
    let rafCallback: FrameRequestCallback | undefined;

    beforeEach(() => {
        positions = {};
        rafCallback = undefined;
        vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
            rafCallback = cb;
            return 0;
        });
        vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
            this: HTMLElement,
        ) {
            const pos = positions[this.dataset.id ?? ''] ?? { left: 0, top: 0 };
            return {
                ...pos,
                right: pos.left,
                bottom: pos.top,
                width: 0,
                height: 0,
                x: pos.left,
                y: pos.top,
                toJSON() {},
            };
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('does not animate on the initial render (nothing to compare against yet)', () => {
        positions = { a: { left: 0, top: 0 }, b: { left: 40, top: 0 } };
        const { getByTestId } = render(<TestList order={['a', 'b']} />);

        expect(getByTestId('item-a').style.transform).toBe('');
        expect(getByTestId('item-b').style.transform).toBe('');
        expect(rafCallback).toBeUndefined();
    });

    it('inverts a moved node instantly, then plays it back to its real position on the next frame', () => {
        positions = { a: { left: 0, top: 0 }, b: { left: 0, top: 0 } };
        const { getByTestId, rerender } = render(<TestList order={['a', 'b']} />);
        const b = getByTestId('item-b');

        positions.b = { left: 40, top: 0 }; // b has since moved 40px right
        rerender(<TestList order={['a', 'b']} />);

        // Invert: jumped back to the old position, transition disabled, before the frame plays.
        expect(b.style.transition).toBe('none');
        expect(b.style.transform).toBe('translate(-40px, 0px)');

        // Play: the captured rAF callback eases it back to its real (already-committed) position.
        rafCallback?.(0);
        expect(b.style.transition).toBe('transform 200ms ease');
        expect(b.style.transform).toBe('');
    });

    it('only animates the nodes that actually moved, in a render with several', () => {
        positions = { a: { left: 0, top: 0 }, b: { left: 40, top: 0 }, c: { left: 80, top: 0 } };
        const { getByTestId, rerender } = render(<TestList order={['a', 'b', 'c']} />);
        const a = getByTestId('item-a');
        const b = getByTestId('item-b');
        const c = getByTestId('item-c');

        positions.b = { left: 60, top: 0 }; // only b moves
        rerender(<TestList order={['a', 'b', 'c']} />);

        expect(a.style.transform).toBe('');
        expect(c.style.transform).toBe('');
        expect(b.style.transform).toBe('translate(-20px, 0px)');
    });
});
