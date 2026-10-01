import { useQuery } from '@tanstack/react-query';
import { fetchHealth } from '@/features/health/api';

export const healthKeys = { all: ['health'] as const };

const REFRESH_MS = 60_000;

/** A health page that is left open keeps itself current, but not while the tab is hidden. */
export function useHealth() {
    return useQuery({
        queryKey: healthKeys.all,
        queryFn: fetchHealth,
        refetchInterval: REFRESH_MS,
    });
}
