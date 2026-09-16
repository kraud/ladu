/**
 * Server-state hook for the metrics feature — the ONLY place metrics data is
 * read (frontend invariant 1: no server state outside TanStack Query).
 *
 * `staleTime: 5 * 60_000` is the first per-query override in the codebase —
 * `app/query-client.ts` pre-authorises exactly this one exception. Metrics
 * lag word CRUD by design: the `['metrics']` invalidation edge (declared in
 * Phase 2, this is its first consumer) forces a refetch on any word mutation
 * regardless of staleness, so the 5-minute window only matters for a plain
 * revisit/refocus.
 */
import { useQuery } from '@tanstack/react-query';
import { getUserMetrics } from './api';
import { metricsKeys } from './keys';

const STALE_TIME_MS = 5 * 60_000;

export function useUserMetrics() {
    return useQuery({
        queryKey: metricsKeys.all,
        queryFn: getUserMetrics,
        staleTime: STALE_TIME_MS,
    });
}
