/**
 * Query-key factory for the metrics feature. `all` is the invalidation root
 * `features/words/hooks.ts`'s word-CRUD mutations target — it was previously
 * spelled out as a local `METRICS_KEY = ['metrics']` there "until that module
 * grows a `keys.ts`" (Phase 2); Phase 3.5 closes that contract by importing
 * this instead.
 *
 * One query, one key — no `detail`/`list` split needed here.
 */
export const metricsKeys = {
    all: ['metrics'] as const,
};
