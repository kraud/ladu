import { useState, type ReactNode } from 'react';
import axios from 'axios';
import { Link, useParams } from '@tanstack/react-router';
import { ArrowLeft } from '@phosphor-icons/react';
import { errorMessage } from '@/api/client';
import { Button } from '@/components/ui/button';
import { BadgeSection } from '@/features/users/components/BadgeSection';
import { UserActions } from '@/features/users/components/UserActions';
import { StatusBadge } from '@/features/users/components/StatusBadge';
import { formatDateTime, formatDateTimeWithCountry, NONE } from '@/features/users/format';
import { useAllowLogin, useDisallowLogin } from '@/features/access/hooks';
import { ALLOW_SKIP_REASONS } from '@/features/access/types';
import { useUser } from '@/features/users/hooks';
import type { UserDetail } from '@/features/users/types';

function Section({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section className="flex flex-col gap-3 rounded-lg border bg-card p-4">
            <h2 className="text-sm font-semibold">{title}</h2>
            {children}
        </section>
    );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex flex-col">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="text-sm break-words">{children}</dd>
        </div>
    );
}

const Grid = ({ children }: { children: ReactNode }) => (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">{children}</dl>
);

const COUNT_LABELS: [keyof UserDetail['counts'], string][] = [
    ['words', 'Words'],
    ['translations', 'Translations'],
    ['tags', 'Tags'],
    ['friends', 'Friends'],
    ['practiceSessions', 'Saved practice sessions'],
];

const METHOD_LABELS: Record<string, string> = { password: 'Password', google: 'Google' };

/** Who may sign in while login is limited. Only a role with `access.manage` gets `loginAllowed`; others get `null` and no section. */
function LoginAccessSection({ user }: { user: UserDetail }) {
    const allow = useAllowLogin();
    const disallow = useDisallowLogin();
    const [notice, setNotice] = useState<string | null>(null);
    const [problem, setProblem] = useState<string | null>(null);
    const pending = allow.isPending || disallow.isPending;

    const add = () => {
        setNotice(null);
        setProblem(null);
        allow.mutate(
            { userIds: [user.id] },
            {
                onSuccess: (answer) => {
                    // The server skips an account it cannot add (for example a deleted one) and says why.
                    if (answer.added.length === 0) setProblem(`Not added: ${ALLOW_SKIP_REASONS[answer.skipped[0]?.reason ?? 'unknown']}.`);
                    else setNotice('This account can now sign in while login is limited.');
                },
                onError: (error) => setProblem(errorMessage(error)),
            },
        );
    };
    const remove = () => {
        setNotice(null);
        setProblem(null);
        disallow.mutate(user.id, {
            onSuccess: () => setNotice('This account was removed from the allowed list.'),
            onError: (error) => setProblem(errorMessage(error)),
        });
    };

    return (
        <Section title="Sign-in access">
            <p className="text-sm">
                On the allowed list: <strong>{user.loginAllowed ? 'Yes' : 'No'}</strong>
            </p>
            <p className="text-xs text-muted-foreground">It only matters while login is limited. Open sessions are not affected.</p>
            {notice && (
                <p role="status" className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-900">
                    {notice}
                </p>
            )}
            {problem && (
                <p role="alert" className="text-sm text-destructive">
                    {problem}
                </p>
            )}
            <div>
                <Button size="sm" variant="outline" disabled={pending} onClick={user.loginAllowed ? remove : add}>
                    {user.loginAllowed ? 'Remove from the allowed list' : 'Allow to sign in'}
                </Button>
            </div>
        </Section>
    );
}

export function UserDetailPage() {
    const { userId } = useParams({ from: '/_protected/users/$userId' });
    const { data: user, error, isPending, isError, refetch } = useUser(userId);

    const back = (
        <Link to="/users" className="inline-flex items-center gap-1 text-sm text-(--accent-strong) hover:underline">
            <ArrowLeft size={14} /> All users
        </Link>
    );

    if (isPending) return <p className="text-muted-foreground">Loading…</p>;

    if (isError) {
        const notFound = axios.isAxiosError(error) && error.response?.status === 404;
        return (
            <div className="flex flex-col items-start gap-3">
                {back}
                <div role="alert" className="flex flex-col items-start gap-2">
                    <h1 className="text-2xl font-semibold">{notFound ? 'User not found' : 'Could not load this user'}</h1>
                    {!notFound && <p className="text-sm text-destructive">{errorMessage(error)}</p>}
                    {!notFound && (
                        <Button size="sm" variant="outline" onClick={() => void refetch()}>
                            Try again
                        </Button>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4">
            {back}

            <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-semibold">{user.name}</h1>
                <StatusBadge status={user.status} />
                {!user.verified && <span className="text-sm text-muted-foreground">Email not verified</span>}
            </div>

            {user.status === 'banned' && (
                <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
                    Banned on {formatDateTime(user.bannedAt)}. Reason: {user.banReason ?? NONE}
                </p>
            )}
            {user.status === 'deleted' && (
                <p className="rounded-md bg-red-50 p-3 text-sm text-red-900">
                    Deleted on {formatDateTime(user.deletedAt)}
                    {user.deletedByStaffName ? ` by ${user.deletedByStaffName}` : ''}.
                </p>
            )}

            <UserActions user={user} />

            {/* Its own section, not next to the h1: the e2e locator `h1 + span` reads the status badge. */}
            <BadgeSection user={user} />

            <Section title="Profile">
                <Grid>
                    <Field label="Username">@{user.username}</Field>
                    <Field label="Email">{user.email}</Field>
                    <Field label="Languages">{user.languages.join(', ') || NONE}</Field>
                    <Field label="Native language">{user.nativeLanguage ?? NONE}</Field>
                    <Field label="Interface language">{user.uiLanguage ?? NONE}</Field>
                    <Field label="Theme">{user.theme ?? NONE}</Field>
                </Grid>
            </Section>

            <Section title="Activity">
                <Grid>
                    <Field label="Registered">{formatDateTime(user.createdAt)}</Field>
                    <Field label="Last login">{formatDateTimeWithCountry(user.lastLoginAt, user.lastLoginCountry)}</Field>
                    <Field label="Last seen">{formatDateTime(user.lastSeenAt)}</Field>
                </Grid>
            </Section>

            <Section title="Sign-in methods">
                <ul className="flex flex-col gap-1 text-sm">
                    {user.hasPassword && <li>Password</li>}
                    {user.identities.map((identity) => (
                        <li key={`${identity.provider}-${identity.emailAtLink}`}>
                            {METHOD_LABELS[identity.provider] ?? identity.provider}{' '}
                            <span className="text-muted-foreground">
                                ({identity.emailAtLink}, linked {formatDateTime(identity.linkedAt)})
                            </span>
                        </li>
                    ))}
                    {!user.hasPassword && user.identities.length === 0 && <li className="text-muted-foreground">None</li>}
                </ul>
            </Section>

            {user.loginAllowed !== null && <LoginAccessSection user={user} />}

            <Section title="Content">
                <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                    {COUNT_LABELS.map(([key, label]) => (
                        <div key={key} className="rounded-md bg-muted p-3">
                            <dt className="text-xs text-muted-foreground">{label}</dt>
                            <dd className="text-xl font-semibold">{user.counts[key]}</dd>
                        </div>
                    ))}
                </dl>
            </Section>

            <Section title="Recent logins">
                {user.recentLogins.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No logins recorded. Logins are recorded from the day this feature started.</p>
                ) : (
                    <table className="w-full text-left text-sm">
                        <thead className="text-xs text-muted-foreground">
                            <tr>
                                <th scope="col" className="py-1 font-medium">When</th>
                                <th scope="col" className="py-1 font-medium">Method</th>
                                <th scope="col" className="py-1 font-medium">Country</th>
                            </tr>
                        </thead>
                        <tbody>
                            {user.recentLogins.map((login) => (
                                <tr key={login.id} className="border-t">
                                    <td className="py-1">{formatDateTime(login.createdAt)}</td>
                                    <td className="py-1">{METHOD_LABELS[login.method] ?? login.method}</td>
                                    <td className="py-1">{login.country ?? NONE}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </Section>

            {user.audit !== null && (
                <Section title="Audit history">
                    {user.audit.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No staff actions on this account.</p>
                    ) : (
                        <ul className="flex flex-col gap-2 text-sm">
                            {user.audit.map((entry) => (
                                <li key={entry.id} className="border-t pt-2 first:border-0 first:pt-0">
                                    <span className="font-medium">{entry.action}</span> by {entry.staffName}{' '}
                                    <span className="text-muted-foreground">on {formatDateTime(entry.createdAt)}</span>
                                    {entry.reason && <div className="text-muted-foreground">Reason: {entry.reason}</div>}
                                </li>
                            ))}
                        </ul>
                    )}
                </Section>
            )}
        </div>
    );
}
