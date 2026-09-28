import { Combobox as ComboboxPrimitive } from '@base-ui/react/combobox';
import { cn } from 'cn';

/**
 * Thin Tailwind wrapper around `@base-ui/react/combobox`, mirroring
 * `select.tsx`'s own convention (one `data-slot`-tagged function per part,
 * `cn()` for class merging, floating popup via Portal > Positioner > Popup).
 * Only the multiple-select ("chips inside the input") shape is styled here —
 * `TagCombobox` is the only consumer so far.
 */
const Combobox = ComboboxPrimitive.Root;

function ComboboxChips({ className, ...props }: ComboboxPrimitive.Chips.Props) {
    return (
        <ComboboxPrimitive.Chips
            data-slot="combobox-chips"
            className={cn('flex flex-1 flex-wrap items-center gap-1.5', className)}
            {...props}
        />
    );
}

function ComboboxChip({ className, ...props }: ComboboxPrimitive.Chip.Props) {
    return (
        <ComboboxPrimitive.Chip
            data-slot="combobox-chip"
            className={cn(
                'inline-flex items-center gap-1 rounded-full bg-(--accent-soft) px-2 py-1 text-xs font-medium text-(--accent-strong) data-[highlighted]:bg-(--accent-soft2)',
                className,
            )}
            {...props}
        />
    );
}

function ComboboxChipRemove({ className, ...props }: ComboboxPrimitive.ChipRemove.Props) {
    return (
        <ComboboxPrimitive.ChipRemove
            data-slot="combobox-chip-remove"
            className={cn(
                'grid size-3.5 shrink-0 place-items-center rounded-full text-(--accent-strong) hover:bg-(--accent-soft2)',
                className,
            )}
            {...props}
        />
    );
}

function ComboboxInput({ className, ...props }: ComboboxPrimitive.Input.Props) {
    return (
        <ComboboxPrimitive.Input
            data-slot="combobox-input"
            className={cn('min-w-24 flex-1 bg-transparent text-sm outline-none placeholder:text-(--muted)', className)}
            {...props}
        />
    );
}

function ComboboxContent({
    className,
    children,
    side = 'bottom',
    sideOffset = 4,
    align = 'start',
    ...props
}: ComboboxPrimitive.Popup.Props &
    Pick<ComboboxPrimitive.Positioner.Props, 'align' | 'alignOffset' | 'side' | 'sideOffset'>) {
    return (
        <ComboboxPrimitive.Portal>
            <ComboboxPrimitive.Positioner side={side} sideOffset={sideOffset} align={align} className="isolate z-50">
                <ComboboxPrimitive.Popup
                    data-slot="combobox-content"
                    className={cn(
                        'relative isolate z-50 max-h-72 w-(--anchor-width) min-w-48 origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-lg border border-(--border) bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
                        className,
                    )}
                    {...props}
                >
                    {children}
                </ComboboxPrimitive.Popup>
            </ComboboxPrimitive.Positioner>
        </ComboboxPrimitive.Portal>
    );
}

function ComboboxList({ className, ...props }: ComboboxPrimitive.List.Props) {
    return <ComboboxPrimitive.List data-slot="combobox-list" className={cn('flex flex-col gap-0.5', className)} {...props} />;
}

function ComboboxItem({ className, ...props }: ComboboxPrimitive.Item.Props) {
    return (
        <ComboboxPrimitive.Item
            data-slot="combobox-item"
            className={cn(
                'flex w-full cursor-default items-center justify-between gap-2 truncate rounded-md px-2.5 py-1.5 text-sm outline-hidden data-highlighted:bg-(--hover) data-disabled:cursor-default data-disabled:text-(--muted)',
                className,
            )}
            {...props}
        />
    );
}

function ComboboxEmpty({ className, ...props }: ComboboxPrimitive.Empty.Props) {
    return (
        <ComboboxPrimitive.Empty
            data-slot="combobox-empty"
            className={cn('px-2.5 py-3 text-sm text-(--muted) empty:hidden', className)}
            {...props}
        />
    );
}

export { Combobox, ComboboxChips, ComboboxChip, ComboboxChipRemove, ComboboxInput, ComboboxContent, ComboboxList, ComboboxItem, ComboboxEmpty };
