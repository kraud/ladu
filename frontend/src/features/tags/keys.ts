/**
 * Query-key factory for the tags feature — mirrors `wordKeys`'s exact shape
 * (`features/words/keys.ts`) so the two features' invalidation code reads
 * the same way.
 *
 * `all` is the invalidation root every tag mutation targets; `'detail'` /
 * `'list'` namespace the two leaf shapes so a tag UUID can never collide
 * with a filters object.
 */
import type { Id } from '@/api/types';
import type { TagListFilters } from './types';

export const tagKeys = {
    /** Invalidation root — every create/update/delete/follow/unfollow/clone/link targets this. */
    all: ['tags'] as const,
    /** The `/tags` page's scoped, searched, sorted list. */
    list: (filters?: TagListFilters) =>
        filters === undefined ? (['tags', 'list'] as const) : (['tags', 'list', filters] as const),
    /** One tag by id. */
    detail: (id: Id) => ['tags', 'detail', id] as const,
};
