import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { nextLanguageSort, sortFilters, useLanguageSort } from './useLanguageSort';

describe('nextLanguageSort', () => {
    it('goes A to Z, then Z to A, then back to the default order', () => {
        const first = nextLanguageSort(null, 'EN');
        expect(first).toEqual({ lang: 'EN', dir: 'asc' });
        const second = nextLanguageSort(first, 'EN');
        expect(second).toEqual({ lang: 'EN', dir: 'desc' });
        expect(nextLanguageSort(second, 'EN')).toBeNull();
    });

    it('moves the sort to another column, A to Z, from any state', () => {
        expect(nextLanguageSort({ lang: 'EN', dir: 'asc' }, 'DE')).toEqual({ lang: 'DE', dir: 'asc' });
        expect(nextLanguageSort({ lang: 'EN', dir: 'desc' }, 'DE')).toEqual({ lang: 'DE', dir: 'asc' });
    });
});

describe('useLanguageSort', () => {
    it('keeps one sort at a time', () => {
        const { result } = renderHook(() => useLanguageSort());
        expect(result.current.sort).toBeNull();
        act(() => result.current.toggleSort('EN'));
        act(() => result.current.toggleSort('ES'));
        expect(result.current.sort).toEqual({ lang: 'ES', dir: 'asc' });
    });
});

describe('sortFilters', () => {
    it('maps the sort to list filters, and nothing for the default order', () => {
        expect(sortFilters({ lang: 'DE', dir: 'desc' })).toEqual({ sort: 'DE', dir: 'desc' });
        expect(sortFilters(null)).toEqual({});
    });
});
