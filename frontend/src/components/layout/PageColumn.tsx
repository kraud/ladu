import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * The centered content column of `AppShell`, for a state of a sidebar route
 * that has no `SidebarLayout` (a loading skeleton, the part-of-speech gate).
 * Sidebar routes get no column from `AppShell` — `SidebarLayout` builds its
 * own — so such a state wraps itself here to look like every other page.
 */
export function PageColumn({ children, wide }: { children: ReactNode; wide?: boolean }) {
    return <div className={cn('mx-auto px-6 py-8', wide ? 'max-w-7xl' : 'max-w-5xl')}>{children}</div>;
}
