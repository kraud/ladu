import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { AppHeader } from '@/components/layout/AppHeader';
import { useSessionTheme } from '@/components/layout/useSessionTheme';

/**
 * Frame for every authenticated route: the sticky `AppHeader` over a single
 * centered content column. `wide` is passed down by `ProtectedLayout`, which
 * reads it off the current leaf route's `staticData.wide` (`app/router.tsx`)
 * — currently the word compose/edit/detail routes, for the verb
 * tense-column grid.
 * `sidebar` routes render a `SidebarLayout`, which docks to the window edge and
 * sets its own content column: `<main>` then has no max width and no padding.
 * The auth gate is not here — it is `_protected.beforeLoad` in `app/router.tsx`
 * (fixes the old render-then-redirect bug).
 */
export function AppShell({ children, wide, sidebar }: { children: ReactNode; wide?: boolean; sidebar?: boolean }) {
    useSessionTheme();

    return (
        <div className="min-h-dvh">
            <AppHeader />
            <main
                className={cn(
                    !sidebar && [
                        'mx-auto px-6 pt-3 pb-8 max-[920px]:px-3 max-[920px]:pt-2',
                        wide ? 'max-w-7xl' : 'max-w-5xl',
                    ],
                )}
            >
                {children}
            </main>
        </div>
    );
}
