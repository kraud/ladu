import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { errorMessage } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useChangePassword } from '@/features/auth/hooks';
import { passwordProblem } from '@/lib/password';
import { useMustChangePassword } from '@/stores/authStore';

/**
 * Change your own password. It is also the only page a person with a temporary
 * password can open (the route guard in app/router.tsx sends them here).
 */
export function ChangePasswordPage() {
    const navigate = useNavigate();
    const forced = useMustChangePassword();
    const change = useChangePassword();
    const [current, setCurrent] = useState('');
    const [next, setNext] = useState('');
    const [repeat, setRepeat] = useState('');
    // Shown only after the first try, so the form does not scold while the person is still typing.
    const [tried, setTried] = useState(false);

    const problem =
        passwordProblem(next) ??
        (next === current ? 'The new password must be different from the current one.' : null) ??
        (repeat !== next ? 'The two new passwords are not the same.' : null);

    const onSubmit = (event: FormEvent) => {
        event.preventDefault();
        setTried(true);
        // The old server message is about the old try; two messages at once would confuse.
        change.reset();
        if (problem) return;
        change.mutate(
            { currentPassword: current, newPassword: next },
            { onSuccess: () => void navigate({ to: '/' }) },
        );
    };

    return (
        <div className="mx-auto flex max-w-md flex-col gap-4">
            <h1 className="text-2xl font-semibold">{forced ? 'Choose your own password' : 'Change password'}</h1>

            {forced && (
                <p role="status" className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
                    You signed in with a temporary password. Choose your own password to continue. Nobody else will know it.
                </p>
            )}

            <form onSubmit={onSubmit} className="flex flex-col gap-4 rounded-lg border bg-card p-4">
                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="current-password">{forced ? 'Temporary password' : 'Current password'}</Label>
                    <Input
                        id="current-password"
                        type="password"
                        autoComplete="current-password"
                        required
                        value={current}
                        onChange={(e) => setCurrent(e.target.value)}
                    />
                </div>
                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="new-password">New password</Label>
                    <Input
                        id="new-password"
                        type="password"
                        autoComplete="new-password"
                        required
                        aria-describedby="new-password-help"
                        value={next}
                        onChange={(e) => setNext(e.target.value)}
                    />
                    <p id="new-password-help" className="text-xs text-muted-foreground">
                        At least 12 characters. A long sentence is a good password.
                    </p>
                </div>
                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="repeat-password">Repeat the new password</Label>
                    <Input
                        id="repeat-password"
                        type="password"
                        autoComplete="new-password"
                        required
                        value={repeat}
                        onChange={(e) => setRepeat(e.target.value)}
                    />
                </div>

                {tried && problem && (
                    <p role="alert" className="text-sm text-destructive">
                        {problem}
                    </p>
                )}
                {change.isError && (
                    <p role="alert" className="text-sm text-destructive">
                        {errorMessage(change.error)}
                    </p>
                )}

                <div className="flex items-center gap-3">
                    <Button type="submit" disabled={change.isPending}>
                        {change.isPending ? 'Saving…' : 'Save new password'}
                    </Button>
                    {!forced && (
                        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
                            Cancel
                        </Link>
                    )}
                </div>
            </form>
            {!forced && <p className="text-xs text-muted-foreground">Saving ends your sessions on all other devices.</p>}
        </div>
    );
}
