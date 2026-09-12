import * as React from "react"
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group"
import { Radio as RadioPrimitive } from "@base-ui/react/radio"
import { cn } from "cn"

/**
 * Both wrapped in forwardRef (the generated parts aren't) so RHF's
 * `Controller`/`field.ref` can attach — same React 18 lesson as
 * `input.tsx` / `button.tsx`.
 */
const RadioGroup = React.forwardRef<HTMLDivElement, RadioGroupPrimitive.Props>(
  ({ className, ...props }, ref) => {
    return (
      <RadioGroupPrimitive
        ref={ref}
        data-slot="radio-group"
        className={cn("flex flex-wrap gap-4", className)}
        {...props}
      />
    )
  }
)
RadioGroup.displayName = "RadioGroup"

const RadioGroupItem = React.forwardRef<HTMLSpanElement, RadioPrimitive.Root.Props<string>>(
  ({ className, ...props }, ref) => {
    return (
      <RadioPrimitive.Root
        ref={ref}
        data-slot="radio-group-item"
        className={cn(
          "flex size-4 shrink-0 items-center justify-center rounded-full border border-input bg-transparent outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-(--accent-soft) disabled:cursor-not-allowed disabled:opacity-45 data-checked:border-primary aria-invalid:border-destructive",
          className
        )}
        {...props}
      >
        <RadioPrimitive.Indicator
          data-slot="radio-group-indicator"
          className="size-2 rounded-full bg-primary data-ending-style:opacity-0 data-starting-style:opacity-0"
        />
      </RadioPrimitive.Root>
    )
  }
)
RadioGroupItem.displayName = "RadioGroupItem"

export { RadioGroup, RadioGroupItem }
