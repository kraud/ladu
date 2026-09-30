import { Link, Outlet, useNavigate } from '@tanstack/react-router';
import { SignOut } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { useLogout, useStaffSession } from '@/features/auth/hooks';
import { useAuthStore } from '@/stores/authStore';

/**
 * The shell for every signed-in page. The auth gate itself is the router's
 * `beforeLoad` (app/router.tsx); this component only adds the header and the
 * server-side session check.
 */
export function ProtectedLayout() {
    const navigate = useNavigate();
    const staff = useAuthStore((s) => s.staff);
    const logout = useLogout();
    useStaffSession();

    const signOut = () => {
        logout();
        void navigate({ to: '/login' });
    };

    return (
        <div className="min-h-screen">
            <header className="border-b bg-card">
                <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
                    <nav className="flex items-center gap-5 text-sm">
                        <span className="font-semibold">Ladu Admin</span>
                        <Link to="/users" className="text-muted-foreground hover:text-foreground" activeProps={{ className: 'font-semibold text-foreground' }}>
                            Users
                        </Link>
                    </nav>
                    <div className="flex items-center gap-3 text-sm">
                        <span>
                            {staff?.name}{' '}
                            <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                                {staff?.role}
                            </span>
                        </span>
                        <Button variant="outline" size="sm" onClick={signOut}>
                            <SignOut />
                            Sign out
                        </Button>
                    </div>
                </div>
            </header>
            <main className="mx-auto max-w-6xl p-4">
                <Outlet />
            </main>
        </div>
    );
}
