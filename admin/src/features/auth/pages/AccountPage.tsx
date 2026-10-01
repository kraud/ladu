import { Link } from '@tanstack/react-router';
import { SignOut } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { useSignOut } from '@/features/auth/hooks';
import { useAuthStore } from '@/stores/authStore';

/**
 * Your own account: who you are signed in as, and the two things you can do to
 * it. The route guard in app/router.tsx guarantees a session, so there is no
 * empty state. Every role owns exactly this data.
 */
export function AccountPage() {
    const staff = useAuthStore((s) => s.staff);
    const signOut = useSignOut();

    return (
        <div className="mx-auto flex max-w-md flex-col gap-4">
            <h1 className="text-2xl font-semibold">Account</h1>

            <div className="flex flex-col gap-4 rounded-lg border bg-card p-4">
                <dl className="flex flex-col gap-3">
                    <div className="flex flex-col">
                        <dt className="text-xs text-muted-foreground">Name</dt>
                        <dd className="text-sm break-words">{staff?.name}</dd>
                    </div>
                    <div className="flex flex-col">
                        <dt className="text-xs text-muted-foreground">Email</dt>
                        <dd className="text-sm break-words">{staff?.email}</dd>
                    </div>
                    <div className="flex flex-col">
                        <dt className="text-xs text-muted-foreground">Role</dt>
                        <dd className="text-sm">
                            <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{staff?.role}</span>
                        </dd>
                    </div>
                </dl>

                <div className="flex flex-wrap items-center gap-2">
                    <Link to="/account/password">
                        <Button variant="outline">Change password</Button>
                    </Link>
                    <Button variant="outline" onClick={signOut}>
                        <SignOut />
                        Sign out
                    </Button>
                </div>
            </div>
        </div>
    );
}
