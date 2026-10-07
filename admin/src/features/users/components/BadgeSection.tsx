import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { badgeLabel, GRANTABLE_BADGE_TYPES } from '@/features/users/badges';
import { BadgeDialog, type BadgeDialogMode } from '@/features/users/components/BadgeDialog';
import { formatDateTime } from '@/features/users/format';
import type { UserDetail } from '@/features/users/types';
import { useCan } from '@/stores/authStore';

/**
 * The active badges of one account. Every staff role that can open the page sees
 * the list. The grant and revoke buttons need `badge.manage` (owner only); the
 * server checks it again.
 */
export function BadgeSection({ user }: { user: UserDetail }) {
    const canManage = useCan('badge.manage');
    const [dialog, setDialog] = useState<BadgeDialogMode | null>(null);
    const [notice, setNotice] = useState<string | null>(null);

    const active = new Set(user.badges.map((badge) => badge.type));
    const grantable = GRANTABLE_BADGE_TYPES.filter((type) => !active.has(type));

    const openDialog = (mode: BadgeDialogMode) => {
        setNotice(null);
        setDialog(mode);
    };

    return (
        <section className="flex flex-col gap-3 rounded-lg border bg-card p-4">
            <h2 className="text-sm font-semibold">Badges</h2>

            {user.badges.length === 0 ? (
                <p className="text-sm text-muted-foreground">This account has no badge.</p>
            ) : (
                <ul className="flex flex-col gap-2">
                    {user.badges.map((badge) => (
                        <li key={badge.type} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                            <span className="rounded-md bg-(--accent-soft) px-1.5 py-0.5 text-xs font-medium text-(--accent-strong)">
                                {badgeLabel(badge.type)}
                            </span>
                            <span className="text-muted-foreground">
                                Granted {formatDateTime(badge.grantedAt)} by {badge.grantedBy.name}
                            </span>
                            {canManage && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    aria-label={`Revoke the ${badgeLabel(badge.type)} badge`}
                                    onClick={() => openDialog({ kind: 'revoke', type: badge.type })}
                                >
                                    Revoke
                                </Button>
                            )}
                        </li>
                    ))}
                </ul>
            )}

            {canManage && grantable.length > 0 && (
                <div>
                    <Button size="sm" variant="outline" onClick={() => openDialog({ kind: 'grant', types: grantable })}>
                        Grant badge
                    </Button>
                </div>
            )}

            {notice && (
                <p role="status" className="text-sm text-muted-foreground">
                    {notice}
                </p>
            )}
            {dialog && <BadgeDialog user={user} mode={dialog} onClose={() => setDialog(null)} onDone={setNotice} />}
        </section>
    );
}
