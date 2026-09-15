import { Outlet, useMatches } from '@tanstack/react-router';
import { AppShell } from '@/components/layout/AppShell';
import { PageTransition } from '@/components/common/PageTransition';

/**
 * The `_protected` layout route's component: the real `AppShell` (sticky
 * `AppHeader` — logo, nav, language selector, user menu) wrapping the animated
 * route outlet. `wide` is opted into per leaf route via `staticData.wide`
 * (`app/router.tsx`) — currently the word compose/edit/detail routes, for the
 * verb tense-column grid.
 *
 * The auth gate itself lives in `app/router.tsx` (`_protected.beforeLoad`),
 * never here — fixing the old app's render-then-redirect bug.
 */
export function ProtectedLayout() {
    const matches = useMatches();
    const wide = matches.some((match) => match.staticData.wide);
    return (
        <AppShell wide={wide}>
            <PageTransition>
                <Outlet />
            </PageTransition>
        </AppShell>
    );
}
