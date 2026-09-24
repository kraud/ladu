import * as React from "react"
import { Separator as SeparatorPrimitive } from "@base-ui/react/separator"
import { cn } from "cn"

const Separator = React.forwardRef<HTMLDivElement, SeparatorPrimitive.Props>(
  ({ className, orientation = "horizontal", ...props }, ref) => {
    return (
      <SeparatorPrimitive
        ref={ref}
        data-slot="separator"
        orientation={orientation}
        className={cn(
          "shrink-0 bg-border data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px",
          className
        )}
        {...props}
      />
    )
  }
)
Separator.displayName = "Separator"

export { Separator }
