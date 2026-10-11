import type { ReactNode } from 'react';
import type { Icon } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

/**
 * A page title with its section's icon, in the accent colour, to the left of the text (the same icons the
 * phone menu shows: Words, Tags, Practice). The icon is decorative: the heading's name is the text.
 *
 * `section`: the title of a main section (Words, Tags, Practice). On a phone it lines up with the header
 * above it: the icon sits in a column as wide as the hamburger button (40px), centred under it, and the
 * text starts where the logo starts. (The page column is 12px from the window edge and the header's button
 * 8px, so the row moves 4px to the left; the gap is the header's 12px.) A desktop keeps the plain row.
 */
export function PageTitle({
    icon: IconComponent,
    children,
    className,
    section,
}: {
    icon: Icon;
    children: ReactNode;
    className?: string;
    section?: boolean;
}) {
    return (
        <h1 className={cn('h1 flex min-w-0 items-center gap-2.5', section && 'max-[920px]:-ml-1 max-[920px]:gap-3', className)}>
            <span aria-hidden className={cn('flex shrink-0', section && 'max-[920px]:w-10 max-[920px]:justify-center')}>
                <IconComponent className="size-[0.9em] text-(--accent)" />
            </span>
            <span className="min-w-0 break-words">{children}</span>
        </h1>
    );
}
