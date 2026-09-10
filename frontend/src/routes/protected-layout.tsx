import { Outlet } from '@tanstack/react-router';
import { AppShell } from '@/components/layout/AppShell';
import { PageTransition } from '@/components/common/PageTransition';

/**
 * The `_protected` layout route's component: the real `AppShell` (sticky
 * `AppHeader` — logo, nav, language selector, user menu) wrapping the animated
 * route outlet.
 *
 * The auth gate itself lives in `app/router.tsx` (`_protected.beforeLoad`),
 * never here — fixing the old app's render-then-redirect bug.
 */
export function ProtectedLayout() {
    return (
        <AppShell>
            <PageTransition>
                <Outlet />
            </PageTransition>
        </AppShell>
    );
}
