import { cn } from '@/lib/utils';
import type { UserStatus } from '@/features/users/types';

const STYLES: Record<UserStatus, string> = {
    active: 'bg-emerald-100 text-emerald-800',
    banned: 'bg-amber-100 text-amber-900',
    deleted: 'bg-red-100 text-red-800',
};

const LABELS: Record<UserStatus, string> = { active: 'Active', banned: 'Banned', deleted: 'Deleted' };

export function StatusBadge({ status }: { status: UserStatus }) {
    return <span className={cn('rounded-md px-1.5 py-0.5 text-xs font-medium', STYLES[status])}>{LABELS[status]}</span>;
}
