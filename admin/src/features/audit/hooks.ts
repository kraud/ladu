import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { fetchAudit, fetchAuditFilters } from '@/features/audit/api';
import type { AuditSearch } from '@/features/audit/search';

// Every audit query starts with 'audit', so one invalidation (after any admin action) refreshes them all.
export const auditKeys = {
    all: ['audit'] as const,
    list: (search: AuditSearch) => ['audit', 'list', search] as const,
    filters: ['audit', 'filters'] as const,
};

export function useAudit(search: AuditSearch) {
    return useQuery({
        queryKey: auditKeys.list(search),
        queryFn: () => fetchAudit(search),
        placeholderData: keepPreviousData,
    });
}

export function useAuditFilters() {
    return useQuery({ queryKey: auditKeys.filters, queryFn: fetchAuditFilters });
}
