import { useState, type FormEvent } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { errorMessage } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLogin } from '@/features/auth/hooks';

/** Only a same-origin path is a safe place to send someone after login. */
export function safeRedirect(target: string | undefined): string {
    return target && target.startsWith('/') && !target.startsWith('//') ? target : '/';
}

export function LoginPage() {
    const navigate = useNavigate();
    const { redirect } = useSearch({ from: '/login' });
    const login = useLogin();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const onSubmit = (event: FormEvent) => {
        event.preventDefault();
        login.mutate(
            { email: email.trim(), password },
            { onSuccess: () => void navigate({ to: safeRedirect(redirect), replace: true }) },
        );
    };

    return (
        <main className="flex min-h-screen items-center justify-center p-4">
            <form onSubmit={onSubmit} className="flex w-full max-w-sm flex-col gap-4 rounded-lg border bg-card p-6 shadow-sm">
                <div>
                    <h1 className="text-xl font-semibold">Ladu Admin</h1>
                    <p className="text-sm text-muted-foreground">Staff sign in</p>
                </div>

                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="email">Email</Label>
                    <Input
                        id="email"
                        type="email"
                        autoComplete="username"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                </div>

                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="password">Password</Label>
                    <Input
                        id="password"
                        type="password"
                        autoComplete="current-password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                </div>

                {login.isError && (
                    <p role="alert" className="text-sm text-destructive">
                        {errorMessage(login.error)}
                    </p>
                )}

                <Button type="submit" disabled={login.isPending}>
                    {login.isPending ? 'Signing in…' : 'Sign in'}
                </Button>
            </form>
        </main>
    );
}
