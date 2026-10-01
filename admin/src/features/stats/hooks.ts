import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { fetchStats } from '@/features/stats/api';

export const statsKeys = { all: ['stats'] as const };

const FIVE_MINUTES = 5 * 60 * 1000;

/** The numbers change slowly, so they are cached for five minutes. The Refresh button asks again. */
export function useStats() {
    return useQuery({
        queryKey: statsKeys.all,
        queryFn: fetchStats,
        staleTime: FIVE_MINUTES,
        placeholderData: keepPreviousData,
    });
}
