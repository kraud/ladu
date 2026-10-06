import { useState } from 'react';
import { errorMessage } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { badgeLabel } from '@/features/users/badges';
import { useUserBadge } from '@/features/users/hooks';
import type { UserDetail } from '@/features/users/types';

const MAX_REASON_LENGTH = 500;

export type BadgeDialogMode = { kind: 'grant'; types: string[] } | { kind: 'revoke'; type: string };

/**
 * Grant or revoke one badge. Same shape as the action dialog on this page: a
 * required reason, a disabled confirm button until it is filled, and the server
 * error shown in the dialog.
 */
export function BadgeDialog({
    user,
    mode,
    onClose,
    onDone,
}: {
    user: UserDetail;
    mode: BadgeDialogMode;
    onClose: () => void;
    onDone: (message: string) => void;
}) {
    const mutation = useUserBadge(user.id);
    const [reason, setReason] = useState('');
    // Only used in grant mode. The first type not yet on the account.
    const [chosen, setChosen] = useState(mode.kind === 'grant' ? (mode.types[0] ?? '') : '');

    const type = mode.kind === 'grant' ? chosen : mode.type;
    const canSubmit = reason.trim().length > 0 && type !== '' && !mutation.isPending;

    const submit = () => {
        mutation.mutate(
            { kind: mode.kind, type, reason: reason.trim() },
            {
                onSuccess: () => {
                    onClose();
                    onDone(mode.kind === 'grant' ? `The ${badgeLabel(type)} badge is granted.` : `The ${badgeLabel(type)} badge is revoked.`);
                },
            },
        );
    };

    const title = mode.kind === 'grant' ? 'Grant a badge?' : `Revoke the ${badgeLabel(mode.type)} badge?`;
    const description =
        mode.kind === 'grant'
            ? 'The badge shows next to this account on its Tags. All learners can see it. The reason is saved in the audit log.'
            : 'The badge disappears at once. The reason is saved in the audit log. You can grant the badge again later.';

    return (
        <Dialog open onOpenChange={(open) => !open && !mutation.isPending && onClose()}>
            <DialogContent>
                <form
                    className="flex flex-col gap-4"
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (canSubmit) submit();
                    }}
                >
                    <DialogHeader>
                        <DialogTitle>{title}</DialogTitle>
                        <DialogDescription>{description}</DialogDescription>
                    </DialogHeader>

                    <p className="rounded-md bg-muted px-3 py-2 text-sm">
                        {user.name} <span className="text-muted-foreground">({user.email})</span>
                    </p>

                    {mode.kind === 'grant' && (
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="badge-type">Badge</Label>
                            <select
                                id="badge-type"
                                value={chosen}
                                onChange={(e) => setChosen(e.target.value)}
                                className="h-9 w-full rounded-md border border-input bg-card px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-(--accent-soft)"
                            >
                                {mode.types.map((value) => (
                                    <option key={value} value={value}>
                                        {badgeLabel(value)}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="badge-reason">
                            Reason <span className="font-normal text-muted-foreground">(required)</span>
                        </Label>
                        <Textarea
                            id="badge-reason"
                            value={reason}
                            maxLength={MAX_REASON_LENGTH}
                            onChange={(e) => setReason(e.target.value)}
                        />
                    </div>

                    {mutation.isError && (
                        <p role="alert" className="text-sm text-destructive">
                            {errorMessage(mutation.error)}
                        </p>
                    )}

                    <DialogFooter>
                        <Button type="button" variant="outline" disabled={mutation.isPending} onClick={onClose}>
                            Cancel
                        </Button>
                        <Button type="submit" variant={mode.kind === 'revoke' ? 'destructive' : 'default'} disabled={!canSubmit}>
                            {mutation.isPending ? 'Saving…' : mode.kind === 'grant' ? 'Grant badge' : 'Revoke badge'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
