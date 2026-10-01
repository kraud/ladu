import { Link, Outlet, useNavigate } from '@tanstack/react-router';
import { SignOut } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { useLogout, useStaffSession } from '@/features/auth/hooks';
import { useAuthStore, useCan, useMustChangePassword } from '@/stores/authStore';

/**
 * The shell for every signed-in page. The auth gate itself is the router's
 * `beforeLoad` (app/router.tsx); this component only adds the header and the
 * server-side session check.
 */
export function ProtectedLayout() {
    const navigate = useNavigate();
    const staff = useAuthStore((s) => s.staff);
    const logout = useLogout();
    const canReadHealth = useCan('health.read');
    const canManageStaff = useCan('staff.manage');
    const canReadAudit = useCan('audit.read');
    const mustChange = useMustChangePassword();
    useStaffSession();

    const signOut = () => {
        logout();
        void navigate({ to: '/login' });
    };

    return (
        <div className="min-h-screen">
            <header className="border-b bg-card">
                <div className="mx-auto flex min-h-14 max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2">
                    <nav className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
                        <span className="font-semibold">Ladu Admin</span>
                        {/* A temporary password opens only the change form, so the other links would lead nowhere. */}
                        {!mustChange && (
                            <>
                                <Link to="/users" className="text-muted-foreground hover:text-foreground" activeProps={{ className: 'font-semibold text-foreground' }}>
                                    Users
                                </Link>
                                {canManageStaff && (
                                    <Link to="/staff" className="text-muted-foreground hover:text-foreground" activeProps={{ className: 'font-semibold text-foreground' }}>
                                        Staff
                                    </Link>
                                )}
                                {canReadAudit && (
                                    <Link to="/audit" className="text-muted-foreground hover:text-foreground" activeProps={{ className: 'font-semibold text-foreground' }}>
                                        Audit
                                    </Link>
                                )}
                            </>
                        )}
                        {!mustChange && canReadHealth && (
                            <Link to="/health" className="text-muted-foreground hover:text-foreground" activeProps={{ className: 'font-semibold text-foreground' }}>
                                Health
                            </Link>
                        )}
                    </nav>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                        <Link to="/account/password" className="text-muted-foreground hover:text-foreground" activeProps={{ className: 'font-semibold text-foreground' }}>
                            Change password
                        </Link>
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
