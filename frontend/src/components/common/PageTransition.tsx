import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Route-entry animation. Wraps page content in the `.page` keyframe
 * (fade + 4px rise, 0.24s) ported from `MOCKUPS/assets/app.css` — a CSS
 * keyframe, no animation library, per the build plan.
 */
export function PageTransition({ children, className }: { children: ReactNode; className?: string }) {
    return <div className={cn('page', className)}>{children}</div>;
}
