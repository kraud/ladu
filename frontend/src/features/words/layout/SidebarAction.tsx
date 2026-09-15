/**
 * One action row inside `WordEditorLayout`'s sidebar (Save, Add another
 * translation, Change word type, Cancel, Delete, Return, Edit). The label is
 * always rendered — collapsed (icon rail) only hides it visually via
 * `sr-only`, restored below 920px via `max-[920px]:not-sr-only` regardless
 * of the rail preference, since the sidebar is always a full-width drawer
 * there (`WordEditorLayout`). That keeps every button's accessible name
 * identical in both states, so `getByRole('button', { name })` queries
 * don't care whether the sidebar happens to be collapsed.
 *
 * Collapsed also wraps the row in a `Tooltip` carrying the label (and an
 * optional `hint`, e.g. the min-translations hint under Save) — harmless on
 * a touch/mobile viewport, since nothing there hovers it.
 */
import type { ReactNode } from 'react';
import type { VariantProps } from 'class-variance-authority';
import { Button, buttonVariants } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export interface SidebarActionProps {
    icon: ReactNode;
    children: ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    variant?: VariantProps<typeof buttonVariants>['variant'];
    /** Whether the parent sidebar is currently an icon rail. */
    collapsed?: boolean;
    /** Extra line shown under the label in the collapsed tooltip. */
    hint?: string;
}

export function SidebarAction({
    icon,
    children,
    onClick,
    disabled,
    variant = 'outline',
    collapsed,
    hint,
}: SidebarActionProps) {
    const button = (
        <Button
            type="button"
            variant={variant}
            disabled={disabled}
            onClick={onClick}
            className={cn('w-full', collapsed && 'justify-center px-0 max-[920px]:justify-start max-[920px]:px-[15px]')}
        >
            {icon}
            <span className={cn('truncate', collapsed && 'sr-only max-[920px]:not-sr-only')}>{children}</span>
        </Button>
    );

    if (!collapsed) return button;

    return (
        <Tooltip>
            <TooltipTrigger render={button} />
            <TooltipContent>
                <div className="flex flex-col gap-0.5">
                    <span>{children}</span>
                    {hint && <span className="opacity-80">{hint}</span>}
                </div>
            </TooltipContent>
        </Tooltip>
    );
}
