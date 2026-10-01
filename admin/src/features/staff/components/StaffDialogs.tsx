import { useState, type FormEvent, type ReactNode } from 'react';
import { errorMessage } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCreateStaff, useStaffAction } from '@/features/staff/hooks';
import { ROLES, type StaffMember } from '@/features/staff/types';
import { generatePassword, passwordProblem } from '@/lib/password';
import type { StaffRole } from '@/stores/authStore';

const MAX_REASON_LENGTH = 500;

/** The frame every staff dialog shares: title, a form, an error line, Cancel and a submit button. */
export function FormDialog({
    title,
    description,
    submitLabel,
    destructive = false,
    canSubmit,
    pending,
    error,
    onSubmit,
    onClose,
    children,
}: {
    title: string;
    description?: string;
    submitLabel: string;
    destructive?: boolean;
    canSubmit: boolean;
    pending: boolean;
    error: unknown;
    onSubmit: () => void;
    onClose: () => void;
    children: ReactNode;
}) {
    const submit = (event: FormEvent) => {
        event.preventDefault();
        if (canSubmit && !pending) onSubmit();
    };

    return (
        <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
            <DialogContent>
                <form className="flex flex-col gap-4" onSubmit={submit}>
                    <DialogHeader>
                        <DialogTitle>{title}</DialogTitle>
                        {description && <DialogDescription>{description}</DialogDescription>}
                    </DialogHeader>
                    {children}
                    {error != null && (
                        <p role="alert" className="text-sm text-destructive">
                            {errorMessage(error)}
                        </p>
                    )}
                    <DialogFooter>
                        <Button type="button" variant="outline" disabled={pending} onClick={onClose}>
                            Cancel
                        </Button>
                        <Button type="submit" variant={destructive ? 'destructive' : 'default'} disabled={!canSubmit || pending}>
                            {pending ? 'Saving…' : submitLabel}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function ReasonField({ value, onChange, required }: { value: string; onChange: (value: string) => void; required: boolean }) {
    return (
        <div className="flex flex-col gap-1.5">
            <Label htmlFor="staff-reason">
                Reason <span className="font-normal text-muted-foreground">({required ? 'required' : 'optional'})</span>
            </Label>
            <Textarea id="staff-reason" value={value} maxLength={MAX_REASON_LENGTH} onChange={(e) => onChange(e.target.value)} />
        </div>
    );
}

function RoleSelect({ value, onChange }: { value: StaffRole; onChange: (role: StaffRole) => void }) {
    return (
        <div className="flex flex-col gap-1.5">
            <Label htmlFor="staff-role">Role</Label>
            <select
                id="staff-role"
                value={value}
                onChange={(e) => onChange(e.target.value as StaffRole)}
                className="h-9 rounded-md border border-input bg-card px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-(--accent-soft)"
            >
                {ROLES.map((role) => (
                    <option key={role.value} value={role.value}>
                        {role.label}
                    </option>
                ))}
            </select>
            <p className="text-xs text-muted-foreground">{ROLES.find((r) => r.value === value)?.description}</p>
        </div>
    );
}

/**
 * A temporary password the owner reads and passes on, so it is shown in plain
 * text on purpose, with a generator and a copy button. It is never stored: the
 * person must replace it at their first sign-in.
 */
function TemporaryPasswordField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
    const [copied, setCopied] = useState(false);
    const problem = value ? passwordProblem(value) : null;

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
        } catch {
            /* No clipboard permission: the text is visible, so it can still be copied by hand. */
        }
    };

    return (
        <div className="flex flex-col gap-1.5">
            <Label htmlFor="staff-password">Temporary password</Label>
            <div className="flex gap-2">
                <Input
                    id="staff-password"
                    autoComplete="off"
                    spellCheck={false}
                    className="font-mono"
                    value={value}
                    onChange={(e) => {
                        setCopied(false);
                        onChange(e.target.value);
                    }}
                />
                <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                        setCopied(false);
                        onChange(generatePassword());
                    }}
                >
                    Generate
                </Button>
                <Button type="button" variant="outline" disabled={!value} onClick={() => void copy()}>
                    {copied ? 'Copied' : 'Copy'}
                </Button>
            </div>
            {problem && <p className="text-xs text-destructive">{problem}</p>}
            <p className="text-xs text-muted-foreground">
                Tell the person this password in person or in a private message. They must choose their own at the first sign-in.
            </p>
        </div>
    );
}

interface DialogProps {
    onClose: () => void;
    onDone: (message: string) => void;
}

export function CreateStaffDialog({ onClose, onDone }: DialogProps) {
    const create = useCreateStaff();
    const [email, setEmail] = useState('');
    const [name, setName] = useState('');
    const [role, setRole] = useState<StaffRole>('support');
    const [password, setPassword] = useState('');
    const [reason, setReason] = useState('');

    const canSubmit = email.trim() !== '' && name.trim() !== '' && passwordProblem(password) === null;

    return (
        <FormDialog
            title="Add a staff member"
            description="They sign in with this email and a temporary password."
            submitLabel="Add staff member"
            canSubmit={canSubmit}
            pending={create.isPending}
            error={create.isError ? create.error : null}
            onClose={onClose}
            onSubmit={() =>
                create.mutate(
                    { email: email.trim(), name: name.trim(), role, password, reason: reason.trim() || undefined },
                    {
                        onSuccess: (member) => {
                            onClose();
                            onDone(`${member.name} was added. Give them the temporary password.`);
                        },
                    },
                )
            }
        >
            <div className="flex flex-col gap-1.5">
                <Label htmlFor="staff-email">Email</Label>
                <Input id="staff-email" type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
                <Label htmlFor="staff-name">Name</Label>
                <Input id="staff-name" autoComplete="off" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <RoleSelect value={role} onChange={setRole} />
            <TemporaryPasswordField value={password} onChange={setPassword} />
            <ReasonField value={reason} onChange={setReason} required={false} />
        </FormDialog>
    );
}

export function RoleDialog({ member, onClose, onDone }: DialogProps & { member: StaffMember }) {
    const action = useStaffAction(member.id);
    const [role, setRole] = useState<StaffRole>(member.role);
    const [reason, setReason] = useState('');

    return (
        <FormDialog
            title={`Change the role of ${member.name}`}
            description="The new role applies at the next request, with no new sign-in."
            submitLabel="Change role"
            canSubmit={role !== member.role}
            pending={action.isPending}
            error={action.isError ? action.error : null}
            onClose={onClose}
            onSubmit={() =>
                action.mutate(
                    { action: 'role', role, reason: reason.trim() || undefined },
                    {
                        onSuccess: () => {
                            onClose();
                            onDone(`${member.name} is now ${role}.`);
                        },
                    },
                )
            }
        >
            <RoleSelect value={role} onChange={setRole} />
            <ReasonField value={reason} onChange={setReason} required={false} />
        </FormDialog>
    );
}

export function DisableDialog({ member, onClose, onDone }: DialogProps & { member: StaffMember }) {
    const action = useStaffAction(member.id);
    const [reason, setReason] = useState('');

    return (
        <FormDialog
            title={`Disable ${member.name}?`}
            description="Their sessions stop at once, and they cannot sign in. You can enable the account again later."
            submitLabel="Disable account"
            destructive
            canSubmit={reason.trim() !== ''}
            pending={action.isPending}
            error={action.isError ? action.error : null}
            onClose={onClose}
            onSubmit={() =>
                action.mutate(
                    { action: 'disable', reason: reason.trim() },
                    {
                        onSuccess: () => {
                            onClose();
                            onDone(`${member.name} is disabled.`);
                        },
                    },
                )
            }
        >
            <ReasonField value={reason} onChange={setReason} required />
        </FormDialog>
    );
}

export function EnableDialog({ member, onClose, onDone }: DialogProps & { member: StaffMember }) {
    const action = useStaffAction(member.id);
    const [reason, setReason] = useState('');

    return (
        <FormDialog
            title={`Enable ${member.name}?`}
            description="They can sign in again with their current password."
            submitLabel="Enable account"
            canSubmit
            pending={action.isPending}
            error={action.isError ? action.error : null}
            onClose={onClose}
            onSubmit={() =>
                action.mutate(
                    { action: 'enable', reason: reason.trim() || undefined },
                    {
                        onSuccess: () => {
                            onClose();
                            onDone(`${member.name} is enabled.`);
                        },
                    },
                )
            }
        >
            <ReasonField value={reason} onChange={setReason} required={false} />
        </FormDialog>
    );
}

export function ResetPasswordDialog({ member, onClose, onDone }: DialogProps & { member: StaffMember }) {
    const action = useStaffAction(member.id);
    const [password, setPassword] = useState('');
    const [reason, setReason] = useState('');

    return (
        <FormDialog
            title={`Reset the password of ${member.name}`}
            description="Their old password and all their open sessions stop at once. They must choose a new password at the next sign-in."
            submitLabel="Reset password"
            destructive
            canSubmit={passwordProblem(password) === null}
            pending={action.isPending}
            error={action.isError ? action.error : null}
            onClose={onClose}
            onSubmit={() =>
                action.mutate(
                    { action: 'reset-password', password, reason: reason.trim() || undefined },
                    {
                        onSuccess: () => {
                            onClose();
                            onDone(`The password of ${member.name} is reset. Give them the temporary password.`);
                        },
                    },
                )
            }
        >
            <TemporaryPasswordField value={password} onChange={setPassword} />
            <ReasonField value={reason} onChange={setReason} required={false} />
        </FormDialog>
    );
}
