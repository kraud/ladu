/**
 * Query-key factory for the words feature. One export object, imported by
 * `hooks.ts` and by any cross-feature invalidation edge.
 *
 * Phase 2 needs only the single-word detail key (`detail`). The list keys are
 * declared now so Phase 3's Review table (`list(filters)` + `useInfiniteQuery`)
 * slots in without renaming: `all` is the invalidation root every word mutation
 * targets, and `'detail'` / `'list'` namespace the two leaf shapes so a word
 * UUID can never collide with a filters object.
 */
import type { Id } from '@/api/types';

export const wordKeys = {
    /** Invalidation root — every create/update/delete targets this. */
    all: ['words'] as const,
    /** The (future, Phase 3) filtered list. */
    list: (filters?: unknown) =>
        filters === undefined
            ? (['words', 'list'] as const)
            : (['words', 'list', filters] as const),
    /** One word by id. */
    detail: (id: Id) => ['words', 'detail', id] as const,
};
