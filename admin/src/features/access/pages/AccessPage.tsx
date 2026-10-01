import { useState } from 'react';
import { errorMessage } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { SegmentedControl } from '@/components/SegmentedControl';
import { useAccessState, useAddInvites, useRemoveInvite, useSaveRegistration } from '@/features/access/hooks';
import {
    MAX_EMAILS_PER_REQUEST,
    MAX_NOTE_LENGTH,
    MODES,
    SKIP_REASONS,
    type AccessMode,
    type AccessState,
    type AddInvitesResult,
} from '@/features/access/types';
import { FormDialog } from '@/features/staff/components/StaffDialogs';
import { formatDateTime, NONE } from '@/features/users/format';

const MAX_REASON_LENGTH = 500;

const modeLabel = (mode: AccessMode) => MODES.find((m) => m.value === mode)?.label ?? mode;

/** Splits pasted text: one email per line, or separated by commas, semicolons or spaces. */
export const parseEmails = (text: string): string[] => text.split(/[\s,;]+/).filter(Boolean);

export function AccessPage() {
    const { data, error, isPending, isError, refetch } = useAccessState();
    const [notice, setNotice] = useState<string | null>(null);

    return (
        <div className="flex flex-col gap-4">
            <h1 className="text-2xl font-semibold">Access</h1>

            {notice && (
                <p role="status" className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-900">
                    {notice}
                </p>
            )}

            {isError && (
                <div role="alert" className="flex items-center gap-3 rounded-md border border-destructive/40 bg-card p-3 text-sm">
                    <span className="text-destructive">{errorMessage(error, 'Could not load the access settings')}</span>
                    <Button size="sm" variant="outline" onClick={() => void refetch()}>
                        Try again
                    </Button>
                </div>
            )}

            {isPending && <p className="text-sm text-muted-foreground">Loading…</p>}

            {data && (
                <>
                    {/* The key resets the draft when the saved state changes (after a save). */}
                    <RegistrationCard key={`${data.registration.mode}|${data.registration.note}`} state={data} onDone={setNotice} />
                    <InvitesCard state={data} onDone={setNotice} />
                </>
            )}
        </div>
    );
}

function RegistrationCard({ state, onDone }: { state: AccessState; onDone: (message: string) => void }) {
    const saved = state.registration;
    const [mode, setMode] = useState<AccessMode>(saved.mode);
    const [note, setNote] = useState(saved.note);
    const [confirming, setConfirming] = useState(false);
    const [reason, setReason] = useState('');
    const save = useSaveRegistration();

    const changed = mode !== saved.mode || note.trim() !== saved.note;
    const emptyList = mode === 'limited' && state.counts.invites === 0;

    const consequence =
        mode === 'closed'
            ? 'Nobody will be able to register until you change this.'
            : mode === 'limited'
              ? emptyList
                  ? 'Only emails on the invite list will be able to register. The list is empty, so nobody can register now.'
                  : 'Only emails on the invite list will be able to register.'
              : 'Anybody will be able to register.';

    const submit = () =>
        save.mutate(
            { mode, note: note.trim(), reason: reason.trim() || undefined },
            {
                onSuccess: () => {
                    setConfirming(false);
                    onDone(mode === saved.mode ? 'The extra line was saved.' : `Registration is now ${modeLabel(mode).toLowerCase()}.`);
                },
            },
        );

    return (
        <section aria-labelledby="registration-heading" className="flex flex-col gap-4 rounded-lg border bg-card p-4">
            <div>
                <h2 id="registration-heading" className="text-lg font-semibold">
                    Registration
                </h2>
                <p className="text-sm text-muted-foreground">
                    Who can create an account. The change works at once. Staff are never blocked.
                    {state.updatedAt && (
                        <>
                            {' '}
                            Last changed {formatDateTime(state.updatedAt)}
                            {state.updatedBy ? ` by ${state.updatedBy}` : ''}.
                        </>
                    )}
                </p>
            </div>

            <div className="flex flex-col gap-2">
                <SegmentedControl
                    label="Registration"
                    value={mode}
                    options={MODES.map(({ value, label }) => ({ value, label }))}
                    onChange={(next) => {
                        setMode(next);
                        save.reset();
                    }}
                />
                <ul className="flex flex-col gap-0.5 text-sm">
                    {MODES.map((m) => (
                        <li key={m.value} className={m.value === mode ? 'font-medium text-foreground' : 'text-muted-foreground'}>
                            <span className="font-semibold">{m.label}:</span> {m.description}
                        </li>
                    ))}
                </ul>
            </div>

            {emptyList && (
                <p role="alert" className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
                    Registration is limited and the invite list is empty, so nobody can register.
                </p>
            )}

            <div className="flex flex-col gap-1.5">
                <Label htmlFor="registration-note">
                    Extra line <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Textarea
                    id="registration-note"
                    value={note}
                    maxLength={MAX_NOTE_LENGTH}
                    onChange={(e) => setNote(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                    Shown under the banner on the register page, as plain text. It is not translated. {note.length}/{MAX_NOTE_LENGTH}
                </p>
            </div>

            <div>
                <Button disabled={!changed} onClick={() => setConfirming(true)}>
                    Save
                </Button>
            </div>

            {confirming && (
                <FormDialog
                    title={mode === saved.mode ? 'Save the extra line?' : `Set registration to ${modeLabel(mode).toLowerCase()}?`}
                    description={mode === saved.mode ? 'Visitors will see the new line on the register page.' : consequence}
                    submitLabel="Confirm"
                    destructive={mode === 'closed'}
                    canSubmit
                    pending={save.isPending}
                    error={save.error}
                    onSubmit={submit}
                    onClose={() => {
                        setConfirming(false);
                        save.reset();
                    }}
                >
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="registration-reason">
                            Reason <span className="font-normal text-muted-foreground">(optional)</span>
                        </Label>
                        <Textarea id="registration-reason" value={reason} maxLength={MAX_REASON_LENGTH} onChange={(e) => setReason(e.target.value)} />
                    </div>
                </FormDialog>
            )}
        </section>
    );
}

function InvitesCard({ state, onDone }: { state: AccessState; onDone: (message: string) => void }) {
    const [text, setText] = useState('');
    const [result, setResult] = useState<AddInvitesResult | null>(null);
    const add = useAddInvites();
    const remove = useRemoveInvite();

    const emails = parseEmails(text);
    const tooMany = emails.length > MAX_EMAILS_PER_REQUEST;
    const limited = state.registration.mode === 'limited';

    const submit = () =>
        add.mutate(
            { emails },
            {
                onSuccess: (answer) => {
                    setResult(answer);
                    setText('');
                    onDone(answer.added.length > 0 ? `Added ${answer.added.length} to the invite list.` : 'Nothing was added.');
                },
            },
        );

    return (
        <section aria-labelledby="invites-heading" className="flex flex-col gap-4 rounded-lg border bg-card p-4">
            <div>
                <h2 id="invites-heading" className="text-lg font-semibold">
                    Invite list <span className="text-sm font-normal text-muted-foreground">({state.counts.invites})</span>
                </h2>
                <p className="text-sm text-muted-foreground">
                    {limited
                        ? 'Only these emails can register now. An email leaves the list when that person registers.'
                        : 'These emails can register when registration is limited. The list stays when you switch to another state.'}
                </p>
            </div>

            <div className="flex flex-col gap-1.5">
                <Label htmlFor="invite-emails">Add emails</Label>
                <Textarea
                    id="invite-emails"
                    value={text}
                    placeholder="One email on each line, or separated by commas"
                    onChange={(e) => {
                        setText(e.target.value);
                        add.reset();
                    }}
                />
                {tooMany && (
                    <p role="alert" className="text-sm text-destructive">
                        At most {MAX_EMAILS_PER_REQUEST} emails at once. You have {emails.length}.
                    </p>
                )}
                {add.isError && (
                    <p role="alert" className="text-sm text-destructive">
                        {errorMessage(add.error)}
                    </p>
                )}
                <div>
                    <Button disabled={emails.length === 0 || tooMany || add.isPending} onClick={submit}>
                        {add.isPending ? 'Adding…' : 'Add to the list'}
                    </Button>
                </div>
            </div>

            {result && (
                <div role="status" aria-label="Result of the last add" className="rounded-md bg-muted p-3 text-sm">
                    <p>
                        Added {result.added.length}. Skipped {result.skipped.length}.
                    </p>
                    {result.skipped.length > 0 && (
                        <ul className="mt-1 list-disc pl-5">
                            {result.skipped.map((s, i) => (
                                <li key={`${s.email}-${i}`}>
                                    <span className="break-all">{s.email}</span>: {SKIP_REASONS[s.reason]}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}

            {remove.isError && (
                <p role="alert" className="text-sm text-destructive">
                    {errorMessage(remove.error)}
                </p>
            )}

            <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-left text-sm">
                    <thead className="border-b bg-muted text-xs text-muted-foreground">
                        <tr>
                            {['Email', 'Added by', 'Added', 'Actions'].map((label) => (
                                <th key={label} scope="col" className="px-3 py-2 font-medium whitespace-nowrap">
                                    {label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {state.invites.length === 0 && (
                            <tr>
                                <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                                    The invite list is empty.
                                </td>
                            </tr>
                        )}
                        {state.invites.map((invite) => (
                            <tr key={invite.id} className="border-b last:border-0">
                                <td className="px-3 py-2 break-all">{invite.email}</td>
                                <td className="px-3 py-2">{invite.addedBy ?? NONE}</td>
                                <td className="px-3 py-2 whitespace-nowrap">{formatDateTime(invite.createdAt)}</td>
                                <td className="px-3 py-2">
                                    <Button
                                        size="xs"
                                        variant="outline"
                                        aria-label={`Remove ${invite.email}`}
                                        disabled={remove.isPending}
                                        onClick={() =>
                                            remove.mutate(invite.id, { onSuccess: () => onDone(`Removed ${invite.email} from the invite list.`) })
                                        }
                                    >
                                        Remove
                                    </Button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
}
