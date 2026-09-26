import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useMediaQuery } from './useMediaQuery';

const original = window.matchMedia;

afterEach(() => {
    Object.defineProperty(window, 'matchMedia', { value: original, writable: true, configurable: true });
});

function stubMatchMedia(initial: boolean) {
    let matches = initial;
    const listeners = new Set<() => void>();
    const list = {
        get matches() {
            return matches;
        },
        addEventListener: (_: string, cb: () => void) => listeners.add(cb),
        removeEventListener: (_: string, cb: () => void) => listeners.delete(cb),
    };
    Object.defineProperty(window, 'matchMedia', { value: vi.fn(() => list), writable: true, configurable: true });
    return {
        set(next: boolean) {
            matches = next;
            listeners.forEach((cb) => cb());
        },
    };
}

describe('useMediaQuery', () => {
    it('is false where matchMedia does not exist', () => {
        Object.defineProperty(window, 'matchMedia', { value: undefined, writable: true, configurable: true });
        const { result } = renderHook(() => useMediaQuery('(max-width: 920px)'));
        expect(result.current).toBe(false);
    });

    it('reads the current match and follows changes', () => {
        const media = stubMatchMedia(true);
        const { result } = renderHook(() => useMediaQuery('(max-width: 920px)'));
        expect(result.current).toBe(true);

        act(() => media.set(false));
        expect(result.current).toBe(false);
    });
});
