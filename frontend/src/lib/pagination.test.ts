import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    DEFAULT_PAGE_SIZE,
    PAGE_SIZE_KEY,
    buildPageItems,
    pageCountFor,
    pageRange,
    parsePageSize,
    readStoredPageSize,
    storePageSize,
} from './pagination';

afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
});

describe('parsePageSize', () => {
    it('accepts the four sizes, as numbers or strings', () => {
        expect(parsePageSize(50)).toBe(50);
        expect(parsePageSize('100')).toBe(100);
        expect(parsePageSize('200')).toBe(200);
        expect(parsePageSize('all')).toBe('all');
    });

    it.each([undefined, null, '', 'abc', '25', 25, 0, '1e2', ' 50', '0x32', '50.0'])('rejects %p', (value) => {
        expect(parsePageSize(value)).toBeUndefined();
    });
});

describe('remembered page size', () => {
    it('starts at 50 when nothing is stored', () => {
        expect(readStoredPageSize()).toBe(DEFAULT_PAGE_SIZE);
    });

    it('gives back what was stored', () => {
        storePageSize(200);
        expect(readStoredPageSize()).toBe(200);
        storePageSize('all');
        expect(readStoredPageSize()).toBe('all');
    });

    it('ignores a planted value', () => {
        localStorage.setItem(PAGE_SIZE_KEY, '9999');
        expect(readStoredPageSize()).toBe(DEFAULT_PAGE_SIZE);
    });

    it('works when storage throws', () => {
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('blocked');
        });
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('blocked');
        });
        expect(readStoredPageSize()).toBe(DEFAULT_PAGE_SIZE);
        expect(() => storePageSize(100)).not.toThrow();
    });
});

describe('pageCountFor', () => {
    it('rounds up', () => {
        expect(pageCountFor(1143, 100)).toBe(12);
        expect(pageCountFor(100, 100)).toBe(1);
        expect(pageCountFor(101, 100)).toBe(2);
    });

    it('is 1 for an empty list and for "all"', () => {
        expect(pageCountFor(0, 50)).toBe(1);
        expect(pageCountFor(5000, 'all')).toBe(1);
    });
});

describe('pageRange', () => {
    it('gives the first and last row of the page', () => {
        expect(pageRange(3, 1143, 100)).toEqual({ from: 201, to: 300 });
    });

    it('stops at the total on the last page', () => {
        expect(pageRange(12, 1143, 100)).toEqual({ from: 1101, to: 1143 });
    });

    it('covers the whole list for "all", and is empty for no rows', () => {
        expect(pageRange(1, 77, 'all')).toEqual({ from: 1, to: 77 });
        expect(pageRange(1, 0, 50)).toEqual({ from: 0, to: 0 });
    });
});

describe('buildPageItems', () => {
    it('lists every page when there are few', () => {
        expect(buildPageItems(1, 1)).toEqual([1]);
        expect(buildPageItems(2, 4)).toEqual([1, 2, 3, 4]);
    });

    it('puts a gap where pages are left out', () => {
        expect(buildPageItems(1, 12)).toEqual([1, 2, 'gap', 12]);
        expect(buildPageItems(6, 12)).toEqual([1, 'gap', 5, 6, 7, 'gap', 12]);
        expect(buildPageItems(12, 12)).toEqual([1, 'gap', 11, 12]);
    });

    it('shows the page itself instead of a gap that would hide only one page', () => {
        expect(buildPageItems(4, 12)).toEqual([1, 2, 3, 4, 5, 'gap', 12]);
        expect(buildPageItems(9, 12)).toEqual([1, 'gap', 8, 9, 10, 11, 12]);
    });
});
