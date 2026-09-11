import * as React from "react"
import { cn } from "cn"

/**
 * Plain native `<textarea>` — Base UI ships no textarea primitive.
 * Wrapped in forwardRef so RHF's `Controller`/`field.ref` can attach,
 * matching the `input.tsx` / Phase 1 lesson (React 18, not React 19
 * ref-as-prop).
 */
const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        data-slot="textarea"
        className={cn(
          "min-h-16 w-full rounded-md border border-input bg-transparent px-[11px] py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-(--accent-soft) disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-45 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-(--danger-soft) md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
          className
        )}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }
