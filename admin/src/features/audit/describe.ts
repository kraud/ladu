import type { AuditEntry } from '@/features/audit/types';

const SKIPPED = new Set(['actor', 'from', 'to']);
const MAX_PARTS = 4;

/** A short line from an entry's metadata: who it was about, and what changed. */
export function describeMetadata(metadata: AuditEntry['metadata']): string {
    if (!metadata) return '';
    const parts: string[] = [];

    // A role change keeps both values; show them as one change.
    if (typeof metadata.from === 'string' && typeof metadata.to === 'string') parts.push(`${metadata.from} → ${metadata.to}`);

    for (const [key, value] of Object.entries(metadata)) {
        if (SKIPPED.has(key) || value === null || value === undefined || value === '') continue;
        if (typeof value === 'object') continue;
        parts.push(`${key}: ${String(value)}`);
    }
    return parts.slice(0, MAX_PARTS).join(' · ');
}

/** What the row was about, as text, and the user it can link to (if the user can still exist). */
export function describeTarget(entry: AuditEntry): { text: string; userId: string | null } {
    const email = typeof entry.metadata?.email === 'string' ? entry.metadata.email : null;

    if (entry.targetType === 'user') {
        // A purged account is gone, so its page would only say "not found".
        const purged = entry.action === 'user.purge';
        return { text: purged ? `${email ?? entry.targetId ?? 'user'} (purged)` : (email ?? entry.targetId ?? 'user'), userId: purged ? null : entry.targetId };
    }
    if (entry.targetType === 'staff') return { text: entry.targetStaffName ?? email ?? entry.targetId ?? 'staff', userId: null };
    return { text: [entry.targetType, entry.targetId].filter(Boolean).join(' ') || '—', userId: null };
}
