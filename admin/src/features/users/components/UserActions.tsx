import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { errorMessage } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { UserActionName } from '@/features/users/api';
import { useUserAction } from '@/features/users/hooks';
import type { UserDetail } from '@/features/users/types';
import { useCan } from '@/stores/authStore';

const MAX_REASON_LENGTH = 500;

interface ActionConfig {
    /** The permission the server checks; used here only to hide the button. */
    permission: string;
    buttonLabel: string;
    title: string;
    description: string;
    confirmLabel: string;
    done: string;
    destructive: boolean;
    reason: 'required' | 'optional';
    /** The username must be typed again to enable the confirm button. */
    typeUsername?: boolean;
}

/** The server cannot know if the mail service delivered the email, so the notice never says "sent". */
const EMAIL_DONE = 'The email was handed to the mail service. We cannot tell if it arrived.';

const CONFIG: Record<UserActionName, ActionConfig> = {
    ban: {
        permission: 'users.ban',
        buttonLabel: 'Ban',
        title: 'Ban this account?',
        description: 'The user cannot sign in. Open sessions stop at the next request.',
        confirmLabel: 'Ban account',
        done: 'The account is banned.',
        destructive: true,
        reason: 'required',
    },
    unban: {
        permission: 'users.ban',
        buttonLabel: 'Unban',
        title: 'Unban this account?',
        description: 'The user can sign in again.',
        confirmLabel: 'Unban account',
        done: 'The account is unbanned.',
        destructive: false,
        reason: 'optional',
    },
    'force-logout': {
        permission: 'users.ban',
        buttonLabel: 'Force logout',
        title: 'Sign this user out everywhere?',
        description: 'All sessions of this user stop at the next request. The user can sign in again.',
        confirmLabel: 'Force logout',
        done: 'All sessions of this user are closed.',
        destructive: false,
        reason: 'optional',
    },
    delete: {
        permission: 'users.delete',
        buttonLabel: 'Delete',
        title: 'Delete this account?',
        description:
            'The account is hidden at once, and its email and username stay reserved. You can restore it for 30 days. After that, a nightly job deletes it for good.',
        confirmLabel: 'Delete account',
        done: 'The account is deleted. You can restore it for 30 days.',
        destructive: true,
        reason: 'required',
        typeUsername: true,
    },
    restore: {
        permission: 'users.delete',
        buttonLabel: 'Restore',
        title: 'Restore this account?',
        description: 'The account comes back unchanged.',
        confirmLabel: 'Restore account',
        done: 'The account is restored.',
        destructive: false,
        reason: 'optional',
    },
    purge: {
        permission: 'users.purge',
        buttonLabel: 'Delete for good',
        title: 'Delete this account for good?',
        description: 'This removes the account and all its data now. You cannot undo this.',
        confirmLabel: 'Delete for good',
        done: 'The account is deleted for good.',
        destructive: true,
        reason: 'required',
        typeUsername: true,
    },
    'resend-verification': {
        permission: 'users.email',
        buttonLabel: 'Resend verification email',
        title: 'Resend the verification email?',
        description:
            'The user gets the same verification link again, in the language of the app. You can send this email once every 5 minutes.',
        confirmLabel: 'Send email',
        done: EMAIL_DONE,
        destructive: false,
        reason: 'optional',
    },
    'send-password-reset': {
        permission: 'users.email',
        buttonLabel: 'Send password reset',
        title: 'Send a password reset email?',
        description:
            'The user gets a new link to choose a password. The link is valid for 30 minutes. You can send this email once every 5 minutes.',
        confirmLabel: 'Send email',
        done: EMAIL_DONE,
        destructive: false,
        reason: 'optional',
    },
};

/** Rules that depend on more than the status. */
const ELIGIBLE: Partial<Record<UserActionName, (user: UserDetail) => boolean>> = {
    'resend-verification': (user) => !user.verified,
    'send-password-reset': (user) => user.hasPassword,
};

/** Which actions make sense for each status. A button also needs its permission. */
const BY_STATUS: Record<UserDetail['status'], UserActionName[]> = {
    active: ['ban', 'force-logout', 'resend-verification', 'send-password-reset', 'delete'],
    // A banned user may still get an email.
    banned: ['unban', 'force-logout', 'resend-verification', 'send-password-reset', 'delete'],
    deleted: ['restore', 'purge'],
};

function ActionDialog({
    user,
    action,
    onClose,
    onDone,
}: {
    user: UserDetail;
    action: UserActionName;
    onClose: () => void;
    onDone: (message: string) => void;
}) {
    const config = CONFIG[action];
    const navigate = useNavigate();
    const mutation = useUserAction(user.id);
    const [reason, setReason] = useState('');
    const [typed, setTyped] = useState('');

    const reasonOk = config.reason === 'optional' || reason.trim().length > 0;
    const usernameOk = !config.typeUsername || typed === user.username;
    const canSubmit = reasonOk && usernameOk && !mutation.isPending;

    const submit = () => {
        mutation.mutate(
            { action, reason: reason.trim() || undefined, confirmUsername: config.typeUsername ? typed : undefined },
            {
                onSuccess: (result) => {
                    onClose();
                    // The account no longer exists after a purge; its page would only say "not found".
                    if ('purged' in result) void navigate({ to: '/users' });
                    else onDone(config.done);
                },
            },
        );
    };

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
                        <DialogTitle>{config.title}</DialogTitle>
                        <DialogDescription>{config.description}</DialogDescription>
                    </DialogHeader>

                    <p className="rounded-md bg-muted px-3 py-2 text-sm">
                        {user.name} <span className="text-muted-foreground">({user.email})</span>
                    </p>

                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="action-reason">
                            Reason <span className="font-normal text-muted-foreground">({config.reason})</span>
                        </Label>
                        <Textarea
                            id="action-reason"
                            value={reason}
                            maxLength={MAX_REASON_LENGTH}
                            onChange={(e) => setReason(e.target.value)}
                        />
                    </div>

                    {config.typeUsername && (
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="action-username">
                                Type <strong className="font-semibold">{user.username}</strong> to confirm
                            </Label>
                            <Input
                                id="action-username"
                                autoComplete="off"
                                value={typed}
                                onChange={(e) => setTyped(e.target.value)}
                            />
                        </div>
                    )}

                    {mutation.isError && (
                        <p role="alert" className="text-sm text-destructive">
                            {errorMessage(mutation.error)}
                        </p>
                    )}

                    <DialogFooter>
                        <Button type="button" variant="outline" disabled={mutation.isPending} onClick={onClose}>
                            Cancel
                        </Button>
                        <Button type="submit" variant={config.destructive ? 'destructive' : 'default'} disabled={!canSubmit}>
                            {mutation.isPending ? 'Saving…' : config.confirmLabel}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

/** The buttons the signed-in staff member may use on this account, and the dialog each opens. */
export function UserActions({ user }: { user: UserDetail }) {
    const canBan = useCan('users.ban');
    const canDelete = useCan('users.delete');
    const canPurge = useCan('users.purge');
    const canEmail = useCan('users.email');
    const [open, setOpen] = useState<UserActionName | null>(null);
    const [notice, setNotice] = useState<string | null>(null);

    const allowed = new Set([canBan && 'users.ban', canDelete && 'users.delete', canPurge && 'users.purge', canEmail && 'users.email']);
    const actions = BY_STATUS[user.status].filter(
        (name) => allowed.has(CONFIG[name].permission) && (ELIGIBLE[name]?.(user) ?? true),
    );
    if (actions.length === 0 && !notice) return null;

    return (
        <section className="flex flex-col gap-3 rounded-lg border bg-card p-4">
            <h2 className="text-sm font-semibold">Actions</h2>
            <div className="flex flex-wrap gap-2">
                {actions.map((name) => (
                    <Button
                        key={name}
                        size="sm"
                        variant={CONFIG[name].destructive ? 'destructive' : 'outline'}
                        onClick={() => {
                            setNotice(null);
                            setOpen(name);
                        }}
                    >
                        {CONFIG[name].buttonLabel}
                    </Button>
                ))}
            </div>
            {notice && (
                <p role="status" className="text-sm text-muted-foreground">
                    {notice}
                </p>
            )}
            {open && <ActionDialog user={user} action={open} onClose={() => setOpen(null)} onDone={setNotice} />}
        </section>
    );
}
