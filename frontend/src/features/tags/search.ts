/**
 * The tag page's search-param contract (`/tag/$tagId?q=&page=&size=&sort=&dir=`): the same numbered pages
 * as `/words` (`.context/plans/words-pagination.md`, Slice 4). The parsing helpers are the Review page's own,
 * so a value means the same on both pages.
 */
import { parsePageSize, type PageSize } from '@/lib/pagination';
import { toOptionalString, toPage, toSortParams } from '@/features/words/review/search';
import type { LangKey } from '@/features/words/types';

export interface TagSearch {
    /** The search box: matched on the server against any stored word of the tag. */
    q?: string;
    /** Numbered page, 1-based. Omitted for page 1. */
    page?: number;
    /** Rows per page. Omitted: the size the user chose last (`readStoredPageSize`). */
    size?: PageSize;
    sort?: LangKey;
    dir?: 'asc' | 'desc';
}

export function validateTagSearch(search: Record<string, unknown>): TagSearch {
    return {
        q: toOptionalString(search.q),
        page: toPage(search.page),
        size: parsePageSize(search.size),
        ...toSortParams(search),
    };
}
