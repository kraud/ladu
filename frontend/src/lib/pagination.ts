/**
 * Numbered-page helpers shared by the two word tables (`/words` and
 * `/tag/$tagId`): the page-size choices, the remembered size, and the page
 * number window. Plan: `.context/plans/words-pagination.md`.
 */

/** A page size: a row count, or `'all'` for the whole list on one page. */
export type PageSize = 50 | 100 | 200 | 'all';

export const PAGE_SIZE_OPTIONS: readonly PageSize[] = [50, 100, 200, 'all'];
export const DEFAULT_PAGE_SIZE: PageSize = 50;
export const PAGE_SIZE_KEY = 'ladu.pageSize';

/** Narrow anything (a URL param, a stored string) to a `PageSize`. */
export function parsePageSize(value: unknown): PageSize | undefined {
    // Exact match on the text of each size, so `'1e2'`, `' 50'` or `'0x32'` do not pass as a number.
    return PAGE_SIZE_OPTIONS.find((option) => option === value || String(option) === value);
}

/**
 * The page size the user chose last, kept per browser. Storage is a per-viewer
 * convenience, so every access is wrapped and the app works without it.
 */
export function readStoredPageSize(): PageSize {
    try {
        return parsePageSize(localStorage.getItem(PAGE_SIZE_KEY)) ?? DEFAULT_PAGE_SIZE;
    } catch {
        return DEFAULT_PAGE_SIZE;
    }
}

export function storePageSize(size: PageSize): void {
    try {
        localStorage.setItem(PAGE_SIZE_KEY, String(size));
    } catch {
        /* storage unavailable or full — the next visit starts at the default */
    }
}

/** Rows per page as a number; `'all'` has no limit, so it counts as the whole list. */
export function pageCountFor(total: number, size: PageSize): number {
    if (size === 'all' || total === 0) return 1;
    return Math.ceil(total / size);
}

/** Position of the first and last row on a page (1-based), for "Showing 201–300 of 1,143". */
export function pageRange(page: number, total: number, size: PageSize): { from: number; to: number } {
    if (total === 0) return { from: 0, to: 0 };
    if (size === 'all') return { from: 1, to: total };
    return { from: (page - 1) * size + 1, to: Math.min(page * size, total) };
}

export type PageItem = number | 'gap';

/**
 * The page buttons to show: the first and last page, the current page and one
 * on each side, with `'gap'` where pages are left out. A gap that would hide
 * only one page shows that page instead.
 */
export function buildPageItems(page: number, pageCount: number): PageItem[] {
    const wanted = new Set([1, pageCount, page - 1, page, page + 1]);
    const pages = [...wanted].filter((n) => n >= 1 && n <= pageCount).sort((a, b) => a - b);

    const items: PageItem[] = [];
    pages.forEach((n, index) => {
        const previous = pages[index - 1];
        if (previous !== undefined && n - previous === 2) items.push(previous + 1);
        else if (previous !== undefined && n - previous > 2) items.push('gap');
        items.push(n);
    });
    return items;
}
