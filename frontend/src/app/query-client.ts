/**
 * QueryClient factory + the app's single invalidation-graph record.
 *
 * ── Defaults ────────────────────────────────────────────────────────────────
 * TanStack Query v5 stock (`staleTime: 0`, `gcTime: 5min`) per migration-plan
 * §5.3. Per-query overrides live with their feature's hooks, not here — the one
 * exception documented so far is metrics (`staleTime: 5min`, `features/metrics/hooks.ts`).
 * Retries are disabled: the backend is same-origin and a failed request is
 * almost always a real 4xx/5xx we want surfaced immediately, not flakiness.
 *
 * ── Invalidation graph (extended once per phase) ────────────────────────────
 * Seeded from migration-plan §5.2. Each edge is "<mutation> ⇒ invalidate <keys>".
 *
 *   Phase 1 (auth):
 *     login          ⇒ queryClient.clear()      // wipe any prior user's cache
 *     logout         ⇒ queryClient.clear()
 *     verifyEmail    ⇒ queryClient.clear()      // enters the app as a new session
 *     updateProfile  ⇒ setSession(next)         // store-only; no query cache yet
 *
 *   Phase 2 (nouns)  — ACTIVE: createWord/updateWord/deleteWord ⇒ invalidate
 *                      `wordKeys.all` (['words'] — list + every detail) and
 *                      `metricsKeys.all` (['metrics']). updateWord also
 *                      `setQueryData` on the detail key; deleteWord
 *                      `removeQueries` it. Keys: `features/words/keys.ts`
 *                      (`wordKeys`), `features/metrics/keys.ts` (`metricsKeys`).
 *   Phase 3 (review) — add: `wordKeys.list(filters)` cursor pages
 *   Phase 3.5 (dash) — ACTIVE: `useUserMetrics` (`metricsKeys.all`, staleTime
 *                      5min) — the Phase 2 edge above now has a real consumer.
 *   Phase 4 (tags)   — add: bulk-add-tags ⇒ ['tags', id, 'wordCount'] + ['words']
 *   Phase 5 (exers)  — add: save/master/forget performance ⇒ setQueryData on ['exercises']
 *                       (getUserMetrics aggregates words/translations only — a practice
 *                        session does not change it; no `metricsKeys.all` edge here)
 *   Phase 6 (social) — add: friend actions ⇒ ['friendships'], ['notifications']
 */
import { QueryClient } from '@tanstack/react-query';

export function createQueryClient(): QueryClient {
    return new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
                refetchOnWindowFocus: false,
            },
        },
    });
}

/** The app-wide client. Tests build their own via `createQueryClient()`. */
export const queryClient = createQueryClient();
