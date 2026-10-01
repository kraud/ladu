import { Link, Outlet } from '@tanstack/react-router';
import { useStaffSession } from '@/features/auth/hooks';
import { useAuthStore, useCan, useMustChangePassword } from '@/stores/authStore';

/**
 * The shell for every signed-in page. The auth gate itself is the router's
 * `beforeLoad` (app/router.tsx); this component only adds the header and the
 * server-side session check.
 */
export function ProtectedLayout() {
    const staff = useAuthStore((s) => s.staff);
    const canReadHealth = useCan('health.read');
    const canManageStaff = useCan('staff.manage');
    const canReadAudit = useCan('audit.read');
    const canManageAccess = useCan('access.manage');
    const mustChange = useMustChangePassword();
    useStaffSession();

    return (
        <div className="min-h-screen">
            <header className="border-b bg-card">
                <div className="mx-auto flex min-h-14 max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2">
                    <nav className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
                        <Link to="/" className="font-semibold text-foreground">
                            Ladu Admin
                        </Link>
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
                                {canManageAccess && (
                                    <Link to="/access" className="text-muted-foreground hover:text-foreground" activeProps={{ className: 'font-semibold text-foreground' }}>
                                        Access
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
                        {/* Outside the `mustChange` test: a temporary password must still keep a way to sign out. */}
                        <Link to="/account" className="text-muted-foreground hover:text-foreground" activeProps={{ className: 'font-semibold text-foreground' }}>
                            Account
                        </Link>
                    </nav>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                        <span>
                            {staff?.name}{' '}
                            <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                                {staff?.role}
                            </span>
                        </span>
                    </div>
                </div>
            </header>
            <main className="mx-auto max-w-6xl p-4">
                <Outlet />
            </main>
        </div>
    );
}
