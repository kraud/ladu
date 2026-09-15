import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDebouncedCallback } from './useDebouncedCallback';

describe('useDebouncedCallback', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('returns the initial value immediately', () => {
        const { result } = renderHook(() => useDebouncedCallback('a', 300));
        expect(result.current).toBe('a');
    });

    it('does not update before the delay elapses', () => {
        const { result, rerender } = renderHook(({ value }) => useDebouncedCallback(value, 300), {
            initialProps: { value: 'a' },
        });
        rerender({ value: 'ab' });
        act(() => vi.advanceTimersByTime(299));
        expect(result.current).toBe('a');
    });

    it('updates once the delay elapses', () => {
        const { result, rerender } = renderHook(({ value }) => useDebouncedCallback(value, 300), {
            initialProps: { value: 'a' },
        });
        rerender({ value: 'ab' });
        act(() => vi.advanceTimersByTime(300));
        expect(result.current).toBe('ab');
    });

    it('resets the timer on every intermediate change — only the settled value ever lands', () => {
        const { result, rerender } = renderHook(({ value }) => useDebouncedCallback(value, 300), {
            initialProps: { value: 'a' },
        });
        rerender({ value: 'ab' });
        act(() => vi.advanceTimersByTime(200));
        rerender({ value: 'abc' });
        act(() => vi.advanceTimersByTime(200));
        expect(result.current).toBe('a'); // 'ab' never had 300ms of quiet
        act(() => vi.advanceTimersByTime(100));
        expect(result.current).toBe('abc');
    });

    it('runs each hook instance on its own independent timer', () => {
        const first = renderHook(({ value }) => useDebouncedCallback(value, 300), { initialProps: { value: 'x' } });
        const second = renderHook(({ value }) => useDebouncedCallback(value, 300), { initialProps: { value: 'y' } });

        first.rerender({ value: 'x2' });
        act(() => vi.advanceTimersByTime(300));

        expect(first.result.current).toBe('x2');
        expect(second.result.current).toBe('y'); // untouched by the first instance's timer
    });
});
