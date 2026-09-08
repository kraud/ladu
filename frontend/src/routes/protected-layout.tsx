import { Outlet } from '@tanstack/react-router';
import { PageTransition } from '@/components/common/PageTransition';

/**
 * Slice 2 placeholder shell. The real sticky `AppHeader` — logo, Add Word /
 * Practice / Review nav, language selector, user menu — arrives in Slice 4.
 * This exists now only so `_protected` leaves render inside *something* and the
 * `_protected.beforeLoad` redirect has a layout to (not) reach.
 *
 * The auth gate itself lives in `app/router.tsx` (`_protected.beforeLoad`),
 * never in this component — fixing the old app's render-then-redirect bug.
 */
export function ProtectedLayout() {
    return (
        <div className="min-h-dvh">
            <header className="app-header">
                <div className="app-header-inner mx-auto max-w-5xl px-6">
                    <span className="logo">
                        <span className="logo-mark">L</span>Ladu
                    </span>
                </div>
            </header>
            <main className="mx-auto max-w-5xl px-6 py-8">
                <PageTransition>
                    <Outlet />
                </PageTransition>
            </main>
        </div>
    );
}
