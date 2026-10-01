export interface AuditEntry {
    id: string;
    createdAt: string;
    action: string;
    staffId: string | null;
    /** "System" for a row written by the nightly job. */
    staffName: string;
    targetType: string | null;
    targetId: string | null;
    /** Set only for a row about a staff member. */
    targetStaffName: string | null;
    reason: string | null;
    metadata: Record<string, unknown> | null;
}

export interface AuditListResponse {
    items: AuditEntry[];
    total: number;
    page: number;
    pageSize: number;
}

export interface AuditFilters {
    actions: string[];
    staff: { id: string; name: string }[];
}
