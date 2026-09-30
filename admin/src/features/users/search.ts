/**
 * The users list keeps its whole state in the URL (search text, filters, sort,
 * page), so a reload or a shared link shows the same list. Defaults are left
 * out of the URL, which keeps links short.
 */
export const SORT_KEYS = ['createdAt', 'lastLoginAt', 'lastSeenAt', 'name', 'email'] as const;
export type SortKey = (typeof SORT_KEYS)[number];

export interface UsersSearch {
    q?: string;
    page?: number;
    sort?: SortKey;
    order?: 'asc' | 'desc';
    verified?: 'true' | 'false';
    status?: 'active' | 'banned' | 'deleted';
    method?: 'password' | 'google';
}

export const DEFAULT_SORT: SortKey = 'createdAt';
export const DEFAULT_ORDER = 'desc';

const oneOf = <T extends string>(value: unknown, allowed: readonly T[]): T | undefined =>
    typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;

/** Anything malformed in the URL is dropped, never an error page. */
export function validateUsersSearch(search: Record<string, unknown>): UsersSearch {
    const page = Number(search.page);
    const q = typeof search.q === 'string' ? search.q.trim() : '';
    return {
        q: q || undefined,
        page: Number.isInteger(page) && page > 1 ? page : undefined,
        sort: oneOf(search.sort, SORT_KEYS),
        order: oneOf(search.order, ['asc', 'desc'] as const),
        verified: oneOf(search.verified, ['true', 'false'] as const),
        status: oneOf(search.status, ['active', 'banned', 'deleted'] as const),
        method: oneOf(search.method, ['password', 'google'] as const),
    };
}
