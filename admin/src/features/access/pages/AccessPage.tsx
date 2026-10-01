import { useState } from 'react';
import { errorMessage } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { SegmentedControl } from '@/components/SegmentedControl';
import {
    useAccessState,
    useAddInvites,
    useAllowLogin,
    useDisallowLogin,
    useRemoveInvite,
    useSaveGate,
    useSignOutEveryone,
} from '@/features/access/hooks';
import {
    ALLOW_SKIP_REASONS,
    MAX_EMAILS_PER_REQUEST,
    MAX_NOTE_LENGTH,
    MODES,
    SIGN_OUT_PHRASE,
    SKIP_REASONS,
    type AccessMode,
    type AccessState,
    type AddInvitesResult,
    type AllowLoginResult,
    type GateName,
} from '@/features/access/types';
import { FormDialog } from '@/features/staff/components/StaffDialogs';
import { StatusBadge } from '@/features/users/components/StatusBadge';
import { formatDateTime, NONE } from '@/features/users/format';

const MAX_REASON_LENGTH = 500;

const modeLabel = (gate: GateName, mode: AccessMode) => MODES[gate].find((m) => m.value === mode)?.label ?? mode;

/** Splits pasted text: one email per line, or separated by commas, semicolons or spaces. */
export const parseEmails = (text: string): string[] => text.split(/[\s,;]+/).filter(Boolean);

const GATE_TEXT: Record<
    GateName,
    { title: string; intro: string; page: string; emptyWarning: string; closed: string; limited: string; limitedEmpty: string; open: string }
> = {
    registration: {
        title: 'Registration',
        intro: 'Who can create an account. The change works at once. Staff are never blocked.',
        page: 'register',
        emptyWarning: 'Registration is limited and the invite list is empty, so nobody can register.',
        closed: 'Nobody will be able to register until you change this.',
        limited: 'Only emails on the invite list will be able to register.',
        limitedEmpty: 'Only emails on the invite list will be able to register. The list is empty, so nobody can register now.',
        open: 'Anybody will be able to register.',
    },
    login: {
        title: 'Login',
        intro:
            'Who can sign in. The change works at once. It stops new sign-ins only: people who are already signed in stay signed in (use the red section below to end their sessions). Staff are never blocked.',
        page: 'login',
        emptyWarning: 'Login is limited and the allowed list is empty, so nobody can sign in.',
        closed: 'Nobody will be able to sign in until you change this. Open sessions keep working.',
        limited: 'Only accounts on the allowed list will be able to sign in. Open sessions keep working.',
        limitedEmpty:
            'Only accounts on the allowed list will be able to sign in. The list is empty, so nobody can sign in now. Open sessions keep working.',
        open: 'Anybody with an account will be able to sign in.',
    },
};

export function AccessPage() {
    const { data, error, isPending, isError, refetch } = useAccessState();
    const [notice, setNotice] = useState<string | null>(null);

    return (
        <div className="flex flex-col gap-4">
            <div>
                <h1 className="text-2xl font-semibold">Access</h1>
                {data?.updatedAt && (
                    <p className="text-sm text-muted-foreground">
                        Last changed {formatDateTime(data.updatedAt)}
                        {data.updatedBy ? ` by ${data.updatedBy}` : ''} (registration or login).
                    </p>
                )}
            </div>

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
                    <GateCard key={`registration|${data.registration.mode}|${data.registration.note}`} gate="registration" state={data} onDone={setNotice} />
                    <InvitesCard state={data} onDone={setNotice} />
                    <GateCard key={`login|${data.login.mode}|${data.login.note}`} gate="login" state={data} onDone={setNotice} />
                    <AllowedCard state={data} onDone={setNotice} />
                    <SignOutCard onDone={setNotice} />
                </>
            )}
        </div>
    );
}

function GateCard({ gate, state, onDone }: { gate: GateName; state: AccessState; onDone: (message: string) => void }) {
    const text = GATE_TEXT[gate];
    const saved = state[gate];
    const [mode, setMode] = useState<AccessMode>(saved.mode);
    const [note, setNote] = useState(saved.note);
    const [confirming, setConfirming] = useState(false);
    const [reason, setReason] = useState('');
    const save = useSaveGate(gate);

    const changed = mode !== saved.mode || note.trim() !== saved.note;
    const listSize = gate === 'registration' ? state.counts.invites : state.counts.loginAllowed;
    const emptyList = mode === 'limited' && listSize === 0;
    // Registration open and login limited: a new account is made, but it is never on the allowed list.
    const newAccountsLockedOut = gate === 'login' && mode === 'limited' && state.registration.mode === 'open';

    const consequence = mode === 'closed' ? text.closed : mode === 'limited' ? (emptyList ? text.limitedEmpty : text.limited) : text.open;

    const submit = () =>
        save.mutate(
            { mode, note: note.trim(), reason: reason.trim() || undefined },
            {
                onSuccess: () => {
                    setConfirming(false);
                    onDone(
                        mode === saved.mode
                            ? 'The extra line was saved.'
                            : `${text.title} is now ${modeLabel(gate, mode).toLowerCase()}.`,
                    );
                },
            },
        );

    return (
        <section aria-labelledby={`${gate}-heading`} className="flex flex-col gap-4 rounded-lg border bg-card p-4">
            <div>
                <h2 id={`${gate}-heading`} className="text-lg font-semibold">
                    {text.title}
                </h2>
                <p className="text-sm text-muted-foreground">{text.intro}</p>
            </div>

            <div className="flex flex-col gap-2">
                <SegmentedControl
                    label={text.title}
                    value={mode}
                    options={MODES[gate].map(({ value, label }) => ({ value, label }))}
                    onChange={(next) => {
                        setMode(next);
                        save.reset();
                    }}
                />
                <ul className="flex flex-col gap-0.5 text-sm">
                    {MODES[gate].map((m) => (
                        <li key={m.value} className={m.value === mode ? 'font-medium text-foreground' : 'text-muted-foreground'}>
                            <span className="font-semibold">{m.label}:</span> {m.description}
                        </li>
                    ))}
                </ul>
            </div>

            {emptyList && (
                <p role="alert" className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
                    {text.emptyWarning}
                </p>
            )}

            {newAccountsLockedOut && (
                <p className="rounded-md bg-muted p-3 text-sm">
                    Registration is open, so new accounts are made, but they are not on the allowed list. They cannot sign in until you add them.
                </p>
            )}

            <div className="flex flex-col gap-1.5">
                <Label htmlFor={`${gate}-note`}>
                    Extra line <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Textarea id={`${gate}-note`} value={note} maxLength={MAX_NOTE_LENGTH} onChange={(e) => setNote(e.target.value)} />
                <p className="text-xs text-muted-foreground">
                    Shown under the banner on the {text.page} page, as plain text. It is not translated. {note.length}/{MAX_NOTE_LENGTH}
                </p>
            </div>

            <div>
                <Button disabled={!changed} onClick={() => setConfirming(true)}>
                    Save
                </Button>
            </div>

            {confirming && (
                <FormDialog
                    title={
                        mode === saved.mode
                            ? 'Save the extra line?'
                            : `Set ${text.title.toLowerCase()} to ${modeLabel(gate, mode).toLowerCase()}?`
                    }
                    description={mode === saved.mode ? `Visitors will see the new line on the ${text.page} page.` : consequence}
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
                        <Label htmlFor={`${gate}-reason`}>
                            Reason <span className="font-normal text-muted-foreground">(optional)</span>
                        </Label>
                        <Textarea id={`${gate}-reason`} value={reason} maxLength={MAX_REASON_LENGTH} onChange={(e) => setReason(e.target.value)} />
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

function AllowedCard({ state, onDone }: { state: AccessState; onDone: (message: string) => void }) {
    const [text, setText] = useState('');
    const [result, setResult] = useState<AllowLoginResult | null>(null);
    const add = useAllowLogin();
    const remove = useDisallowLogin();

    const emails = parseEmails(text);
    const tooMany = emails.length > MAX_EMAILS_PER_REQUEST;
    const limited = state.login.mode === 'limited';

    const submit = () =>
        add.mutate(
            { emails },
            {
                onSuccess: (answer) => {
                    setResult(answer);
                    setText('');
                    onDone(answer.added.length > 0 ? `Added ${answer.added.length} to the allowed list.` : 'Nothing was added.');
                },
            },
        );

    return (
        <section aria-labelledby="allowed-heading" className="flex flex-col gap-4 rounded-lg border bg-card p-4">
            <div>
                <h2 id="allowed-heading" className="text-lg font-semibold">
                    Allowed accounts <span className="text-sm font-normal text-muted-foreground">({state.counts.loginAllowed})</span>
                </h2>
                <p className="text-sm text-muted-foreground">
                    {limited
                        ? 'Only these accounts can sign in now.'
                        : 'These accounts can sign in when login is limited. The list stays when you switch to another state.'}{' '}
                    You can also tick accounts in the users list.
                </p>
            </div>

            <div className="flex flex-col gap-1.5">
                <Label htmlFor="allowed-emails">Add accounts by email</Label>
                <Textarea
                    id="allowed-emails"
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
                        {add.isPending ? 'Adding…' : 'Add to the allowed list'}
                    </Button>
                </div>
            </div>

            {result && (
                <div role="status" aria-label="Result of the last allow" className="rounded-md bg-muted p-3 text-sm">
                    <p>
                        Added {result.added.length}. Skipped {result.skipped.length}.
                    </p>
                    {result.skipped.length > 0 && (
                        <ul className="mt-1 list-disc pl-5">
                            {result.skipped.map((s, i) => (
                                <li key={`${s.value}-${i}`}>
                                    <span className="break-all">{s.value}</span>: {ALLOW_SKIP_REASONS[s.reason]}
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
                            {['Name', 'Email', 'Status', 'Added by', 'Added', 'Actions'].map((label) => (
                                <th key={label} scope="col" className="px-3 py-2 font-medium whitespace-nowrap">
                                    {label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {state.loginAllowed.length === 0 && (
                            <tr>
                                <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                                    The allowed list is empty.
                                </td>
                            </tr>
                        )}
                        {state.loginAllowed.map((account) => (
                            <tr key={account.userId} className="border-b last:border-0">
                                <td className="px-3 py-2">{account.name}</td>
                                <td className="px-3 py-2 break-all">{account.email}</td>
                                <td className="px-3 py-2">
                                    <StatusBadge status={account.status} />
                                </td>
                                <td className="px-3 py-2">{account.addedBy ?? NONE}</td>
                                <td className="px-3 py-2 whitespace-nowrap">{formatDateTime(account.addedAt)}</td>
                                <td className="px-3 py-2">
                                    <Button
                                        size="xs"
                                        variant="outline"
                                        aria-label={`Remove ${account.email} from the allowed list`}
                                        disabled={remove.isPending}
                                        onClick={() =>
                                            remove.mutate(account.userId, {
                                                onSuccess: () => onDone(`Removed ${account.email} from the allowed list.`),
                                            })
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

/** The panic button. Separate and red on purpose: it cannot be undone, and it needs a reason and a typed phrase. */
function SignOutCard({ onDone }: { onDone: (message: string) => void }) {
    const [open, setOpen] = useState(false);
    const [reason, setReason] = useState('');
    const [phrase, setPhrase] = useState('');
    const signOut = useSignOutEveryone();

    const close = () => {
        setOpen(false);
        setReason('');
        setPhrase('');
        signOut.reset();
    };

    const submit = () =>
        signOut.mutate(
            { confirm: phrase, reason: reason.trim() },
            {
                onSuccess: ({ signedOut }) => {
                    close();
                    onDone(`${signedOut} ${signedOut === 1 ? 'user was' : 'users were'} signed out.`);
                },
            },
        );

    return (
        <section aria-labelledby="signout-heading" className="flex flex-col gap-3 rounded-lg border border-destructive/50 bg-card p-4">
            <div>
                <h2 id="signout-heading" className="text-lg font-semibold text-destructive">
                    Sign everyone out
                </h2>
                <p className="text-sm text-muted-foreground">
                    Ends the session of every learner at their next request, and they go back to the login page. Staff are not affected. With
                    login limited, only allowed accounts can sign back in. This cannot be undone.
                </p>
            </div>
            <div>
                <Button variant="destructive" onClick={() => setOpen(true)}>
                    Sign everyone out…
                </Button>
            </div>

            {open && (
                <FormDialog
                    title="Sign everyone out?"
                    description="Every learner is signed out at their next request and must sign in again. Staff are not affected. This cannot be undone."
                    submitLabel="Sign everyone out"
                    destructive
                    canSubmit={reason.trim().length > 0 && phrase === SIGN_OUT_PHRASE}
                    pending={signOut.isPending}
                    error={signOut.error}
                    onSubmit={submit}
                    onClose={close}
                >
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="signout-reason">
                            Reason <span className="font-normal text-muted-foreground">(required)</span>
                        </Label>
                        <Textarea id="signout-reason" value={reason} maxLength={MAX_REASON_LENGTH} onChange={(e) => setReason(e.target.value)} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="signout-phrase">
                            Type <span className="font-mono font-semibold">{SIGN_OUT_PHRASE}</span> to confirm
                        </Label>
                        <Input id="signout-phrase" autoComplete="off" spellCheck={false} value={phrase} onChange={(e) => setPhrase(e.target.value)} />
                    </div>
                </FormDialog>
            )}
        </section>
    );
}
