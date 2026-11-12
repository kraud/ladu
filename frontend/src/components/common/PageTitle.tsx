import type { ReactNode } from 'react';
import type { Icon } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

/**
 * A page title with its section's icon, in the accent colour, to the left of the text (the same icons the
 * main navigation shows: Words, Tags, Practice). The icon is decorative: the heading's name is the text.
 */
export function PageTitle({
    icon: IconComponent,
    children,
    className,
}: {
    icon: Icon;
    children: ReactNode;
    className?: string;
}) {
    return (
        <h1 className={cn('h1 flex min-w-0 items-center gap-2.5', className)}>
            <span aria-hidden className="flex shrink-0">
                <IconComponent className="size-[0.9em] text-(--accent)" />
            </span>
            <span className="min-w-0 break-words">{children}</span>
        </h1>
    );
}
