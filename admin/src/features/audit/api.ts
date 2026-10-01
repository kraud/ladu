import { apiClient } from '@/api/client';
import { apiRange, type AuditSearch } from '@/features/audit/search';
import type { AuditFilters, AuditListResponse } from '@/features/audit/types';

export const AUDIT_PAGE_SIZE = 25;

export async function fetchAudit(search: AuditSearch): Promise<AuditListResponse> {
    const { from, to } = apiRange(search);
    const { data } = await apiClient.get<AuditListResponse>('/admin/audit', {
        // axios drops undefined params.
        params: { staff: search.staff, action: search.action, from, to, page: search.page, pageSize: AUDIT_PAGE_SIZE },
    });
    return data;
}

export async function fetchAuditFilters(): Promise<AuditFilters> {
    const { data } = await apiClient.get<AuditFilters>('/admin/audit/filters');
    return data;
}
