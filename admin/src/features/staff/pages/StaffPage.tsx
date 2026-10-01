import { useState } from 'react';
import { errorMessage } from '@/api/client';
import { Button } from '@/components/ui/button';
import { CreateStaffDialog, DisableDialog, EnableDialog, ResetPasswordDialog, RoleDialog } from '@/features/staff/components/StaffDialogs';
import { useStaffList } from '@/features/staff/hooks';
import type { StaffMember } from '@/features/staff/types';
import { formatDateTime, NONE } from '@/features/users/format';
import { useAuthStore } from '@/stores/authStore';

type Dialog = { kind: 'create' } | { kind: 'role' | 'disable' | 'enable' | 'reset'; member: StaffMember } | null;

export function StaffPage() {
    const { data, error, isPending, isError, refetch } = useStaffList();
    const myId = useAuthStore((s) => s.staff?.id);
    const [dialog, setDialog] = useState<Dialog>(null);
    const [notice, setNotice] = useState<string | null>(null);

    const open = (next: Dialog) => {
        setNotice(null);
        setDialog(next);
    };
    const close = () => setDialog(null);

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-2xl font-semibold">Staff</h1>
                <Button onClick={() => open({ kind: 'create' })}>Add staff member</Button>
            </div>

            {notice && (
                <p role="status" className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-900">
                    {notice}
                </p>
            )}

            {isError && (
                <div role="alert" className="flex items-center gap-3 rounded-md border border-destructive/40 bg-card p-3 text-sm">
                    <span className="text-destructive">{errorMessage(error, 'Could not load the staff list')}</span>
                    <Button size="sm" variant="outline" onClick={() => void refetch()}>
                        Try again
                    </Button>
                </div>
            )}

            <div className="overflow-x-auto rounded-lg border bg-card">
                <table className="w-full text-left text-sm">
                    <thead className="border-b bg-muted text-xs text-muted-foreground">
                        <tr>
                            {['Name', 'Role', 'Status', 'Last sign-in', 'Added', 'Actions'].map((label) => (
                                <th key={label} scope="col" className="px-3 py-2 font-medium whitespace-nowrap">
                                    {label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {isPending && (
                            <tr>
                                <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                                    Loading…
                                </td>
                            </tr>
                        )}
                        {data?.map((member) => {
                            const isMe = member.id === myId;
                            return (
                                <tr key={member.id} className="border-b last:border-0">
                                    <td className="px-3 py-2">
                                        <div className="font-medium">
                                            {member.name} {isMe && <span className="text-xs font-normal text-muted-foreground">(you)</span>}
                                        </div>
                                        <div className="text-xs text-muted-foreground">{member.email}</div>
                                    </td>
                                    <td className="px-3 py-2">
                                        <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs">{member.role}</span>
                                    </td>
                                    <td className="px-3 py-2">
                                        <div className="flex flex-wrap items-center gap-1">
                                            <span
                                                className={
                                                    member.status === 'active'
                                                        ? 'rounded-md bg-emerald-100 px-1.5 py-0.5 text-xs font-medium text-emerald-800'
                                                        : 'rounded-md bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-800'
                                                }
                                            >
                                                {member.status === 'active' ? 'Active' : 'Disabled'}
                                            </span>
                                            {member.mustChangePassword && (
                                                <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-900">
                                                    Temporary password
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-3 py-2 whitespace-nowrap">{member.lastLoginAt ? formatDateTime(member.lastLoginAt) : NONE}</td>
                                    <td className="px-3 py-2 whitespace-nowrap">{formatDateTime(member.createdAt)}</td>
                                    <td className="px-3 py-2">
                                        {isMe ? (
                                            <span className="text-xs text-muted-foreground">Use "Change password" on the Account page</span>
                                        ) : (
                                            <div className="flex flex-wrap gap-1.5">
                                                <Button size="xs" variant="outline" onClick={() => open({ kind: 'role', member })}>
                                                    Change role
                                                </Button>
                                                <Button size="xs" variant="outline" onClick={() => open({ kind: 'reset', member })}>
                                                    Reset password
                                                </Button>
                                                {member.status === 'active' ? (
                                                    <Button size="xs" variant="destructive" onClick={() => open({ kind: 'disable', member })}>
                                                        Disable
                                                    </Button>
                                                ) : (
                                                    <Button size="xs" variant="outline" onClick={() => open({ kind: 'enable', member })}>
                                                        Enable
                                                    </Button>
                                                )}
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {dialog?.kind === 'create' && <CreateStaffDialog onClose={close} onDone={setNotice} />}
            {dialog?.kind === 'role' && <RoleDialog member={dialog.member} onClose={close} onDone={setNotice} />}
            {dialog?.kind === 'disable' && <DisableDialog member={dialog.member} onClose={close} onDone={setNotice} />}
            {dialog?.kind === 'enable' && <EnableDialog member={dialog.member} onClose={close} onDone={setNotice} />}
            {dialog?.kind === 'reset' && <ResetPasswordDialog member={dialog.member} onClose={close} onDone={setNotice} />}
        </div>
    );
}
