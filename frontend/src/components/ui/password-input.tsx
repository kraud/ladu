import * as React from "react"
import { useTranslation } from "react-i18next"
import { EyeIcon, EyeSlashIcon } from "@phosphor-icons/react"
import { Input } from "@/components/ui/input"
import { cn } from "cn"

/**
 * A password `Input` with an eye button that shows or hides the value.
 * Every prop goes to the inner `Input`, so it works directly inside
 * `FormControl` (which clones id/aria props onto its child). The button stays
 * in the tab order so keyboard users can reach it; `type="button"` keeps it
 * from submitting the form.
 */
const PasswordInput = React.forwardRef<
  HTMLInputElement,
  Omit<React.ComponentProps<"input">, "type">
>(({ className, ...props }, ref) => {
  const { t } = useTranslation()
  const [visible, setVisible] = React.useState(false)
  const Icon = visible ? EyeSlashIcon : EyeIcon

  return (
    <div className="relative">
      <Input
        ref={ref}
        type={visible ? "text" : "password"}
        className={cn("pr-10", className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={t(visible ? "common:buttons.hidePassword" : "common:buttons.showPassword")}
        aria-pressed={visible}
        disabled={props.disabled}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-md text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-(--accent-soft) disabled:pointer-events-none disabled:opacity-45"
      >
        <Icon size={18} aria-hidden="true" />
      </button>
    </div>
  )
})
PasswordInput.displayName = "PasswordInput"

export { PasswordInput }
