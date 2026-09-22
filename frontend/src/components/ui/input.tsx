import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"
import { cn } from "cn"

/**
 * Wrapped in forwardRef (the generated component wasn't) so
 * react-hook-form's `Controller`/`field.ref` can attach — required for
 * RHF to focus the first invalid field on failed validation (see
 * form.test.tsx, which caught the "Function components cannot be given
 * refs" warning this fixes). shadcn's base-nova preset otherwise assumes
 * React 19's ref-as-prop; this project is pinned to React 18.
 */
const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <InputPrimitive
        ref={ref}
        type={type}
        data-slot="input"
        className={cn(
          // bg-card (var(--surface), white) — not the shadcn-generated default
          // bg-transparent — matching MOCKUPS/assets/app.css's `.input` rule
          // (`background: var(--surface)`). Transparent looked fine while every
          // page happened to have a white background behind it; the auth
          // screens' `.auth-panel` is tinted, so a transparent field just shows
          // the panel through it.
          "h-9 w-full min-w-0 rounded-md border border-input bg-card px-[11px] py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-(--accent-soft) disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-45 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-(--danger-soft) md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
          className
        )}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
