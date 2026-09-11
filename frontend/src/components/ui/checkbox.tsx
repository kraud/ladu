import * as React from "react"
import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox"
import { cn } from "cn"
import { CheckIcon } from "@phosphor-icons/react"

/**
 * Wrapped in forwardRef (the generated component wasn't) so RHF's
 * `Controller`/`field.ref` can attach — same React 18 lesson as
 * `input.tsx` / `button.tsx`.
 */
const Checkbox = React.forwardRef<HTMLButtonElement, CheckboxPrimitive.Root.Props>(
  ({ className, ...props }, ref) => {
    return (
      <CheckboxPrimitive.Root
        ref={ref}
        data-slot="checkbox"
        className={cn(
          "flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-input bg-transparent text-primary-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-(--accent-soft) disabled:cursor-not-allowed disabled:opacity-45 data-checked:border-primary data-checked:bg-primary aria-invalid:border-destructive",
          className
        )}
        {...props}
      >
        <CheckboxPrimitive.Indicator
          data-slot="checkbox-indicator"
          className="flex items-center justify-center text-current data-ending-style:opacity-0 data-starting-style:opacity-0"
        >
          <CheckIcon className="size-3" weight="bold" />
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
    )
  }
)
Checkbox.displayName = "Checkbox"

export { Checkbox }
