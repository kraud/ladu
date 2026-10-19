import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/features/access/components/ConfirmDialog';
import { useApproveRequest, useRemoveRequest } from '@/features/access/hooks';
import type { AccessMode, AccessRequest, GateName, LoginRequest } from '@/features/access/types';
import { StatusBadge } from '@/features/users/components/StatusBadge';
import { formatDateTime } from '@/features/users/format';

/** The text that depends on which list a request is approved into. */
const TEXT = {
    registration: {
        list: 'invite list',
        approve: (email: string) =>
            `Add ${email} to the invite list. This does not send an email: use "Send invite" on the invite list when you are ready.`,
    },
    login: {
        list: 'allowed accounts',
        approve: (email: string) =>
            `Allow ${email} to sign in. This does not send an email: use "Send email" on the allowed accounts when you are ready.`,
    },
} as const;

type Pending = { action: 'approve' | 'remove'; request: AccessRequest | LoginRequest };

/**
 * The requests from the public /request page (access-requests.md), under the invite list
 * (`registration`) or the allowed accounts (`login`). Approve adds the email to that list and sends no
 * email; Remove drops the request. Both ask for a confirm, with an optional reason.
 */
export function RequestsCard({
    gate,
    mode,
    requests,
    onDone,
}: {
    gate: GateName;
    mode: AccessMode;
    requests: AccessRequest[] | LoginRequest[];
    onDone: (message: string) => void;
}) {
    const [pending, setPending] = useState<Pending | null>(null);
    const approve = useApproveRequest();
    const remove = useRemoveRequest();
    const text = TEXT[gate];
    const headingId = `${gate}-requests-heading`;

    const close = () => {
        setPending(null);
        approve.reset();
        remove.reset();
    };

    const confirm = (reason: string | undefined) => {
        if (!pending) return;
        const { id, email } = pending.request;
        const mutation = pending.action === 'approve' ? approve : remove;
        mutation.mutate(
            { id, reason },
            {
                onSuccess: () => {
                    close();
                    onDone(pending.action === 'approve' ? `Added ${email} to the ${text.list}.` : `Removed the request from ${email}.`);
                },
            },
        );
    };

    const active = pending?.action === 'approve' ? approve : remove;

    return (
        <section aria-labelledby={headingId} className="flex flex-col gap-4 rounded-lg border bg-card p-4">
            <div>
                <h3 id={headingId} className="text-lg font-semibold">
                    Access requests <span className="text-sm font-normal text-muted-foreground">({requests.length})</span>
                </h3>
                <p className="text-sm text-muted-foreground">
                    People who asked for access on the public request page.{' '}
                    {gate === 'registration' ? 'Approve adds the email to the invite list.' : 'Approve adds the account to the allowed accounts.'}
                    {mode === 'closed' && ' This gate is closed: an approved email takes effect when the gate is limited.'}
                </p>
            </div>

            <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-left text-sm">
                    <thead className="border-b bg-muted text-xs text-muted-foreground">
                        <tr>
                            {(gate === 'login' ? ['Email', 'Account', 'Requested', 'Actions'] : ['Email', 'Requested', 'Actions']).map((label) => (
                                <th key={label} scope="col" className="px-3 py-2 font-medium whitespace-nowrap">
                                    {label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {requests.length === 0 && (
                            <tr>
                                <td colSpan={gate === 'login' ? 4 : 3} className="px-3 py-6 text-center text-muted-foreground">
                                    There are no requests.
                                </td>
                            </tr>
                        )}
                        {requests.map((request) => {
                            const account = 'account' in request ? request.account : undefined;
                            // A login request needs an account that can be allowed: none, or a deleted one, cannot.
                            const noAccount = gate === 'login' && (!account || account.status === 'deleted');
                            return (
                                <tr key={request.id} className="border-b last:border-0">
                                    <td className="px-3 py-2 break-all">{request.email}</td>
                                    {gate === 'login' && (
                                        <td className="px-3 py-2">
                                            {account ? (
                                                <span className="flex flex-wrap items-center gap-2">
                                                    {account.name}
                                                    <StatusBadge status={account.status} />
                                                </span>
                                            ) : (
                                                <span className="text-muted-foreground">No account found</span>
                                            )}
                                        </td>
                                    )}
                                    <td className="px-3 py-2 whitespace-nowrap">{formatDateTime(request.createdAt)}</td>
                                    <td className="flex gap-2 px-3 py-2">
                                        <Button
                                            size="xs"
                                            variant="outline"
                                            aria-label={`Approve ${request.email}`}
                                            disabled={noAccount}
                                            title={noAccount ? 'No active account has this email, so it cannot be allowed to sign in.' : undefined}
                                            onClick={() => setPending({ action: 'approve', request })}
                                        >
                                            Approve
                                        </Button>
                                        <Button
                                            size="xs"
                                            variant="outline"
                                            aria-label={`Remove the request from ${request.email}`}
                                            onClick={() => setPending({ action: 'remove', request })}
                                        >
                                            Remove
                                        </Button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {pending && (
                <ConfirmDialog
                    title={pending.action === 'approve' ? 'Approve this request?' : 'Remove this request?'}
                    description={
                        pending.action === 'approve'
                            ? text.approve(pending.request.email)
                            : `Remove the request from ${pending.request.email}. Nothing is added to a list.`
                    }
                    submitLabel={pending.action === 'approve' ? 'Approve' : 'Remove'}
                    pending={active.isPending}
                    error={active.error}
                    onConfirm={confirm}
                    onClose={close}
                />
            )}
        </section>
    );
}
