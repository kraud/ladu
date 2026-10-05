import * as React from "react"
import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"
import { cn } from "cn"

/**
 * Tabs for switching between lists that share one place (Practice's saved
 * configurations / saved sessions). Only the active panel is mounted. All
 * parts are wrapped in forwardRef (React 18), like the other ui parts.
 */
const Tabs = React.forwardRef<HTMLDivElement, TabsPrimitive.Root.Props>(
  ({ className, ...props }, ref) => (
    <TabsPrimitive.Root
      ref={ref}
      data-slot="tabs"
      className={cn("flex flex-col gap-3", className)}
      {...props}
    />
  )
)
Tabs.displayName = "Tabs"

const TabsList = React.forwardRef<HTMLDivElement, TabsPrimitive.List.Props>(
  ({ className, ...props }, ref) => (
    <TabsPrimitive.List
      ref={ref}
      data-slot="tabs-list"
      className={cn("flex gap-1 border-b border-border", className)}
      {...props}
    />
  )
)
TabsList.displayName = "TabsList"

const TabsTrigger = React.forwardRef<HTMLElement, TabsPrimitive.Tab.Props>(
  ({ className, ...props }, ref) => (
    <TabsPrimitive.Tab
      ref={ref}
      data-slot="tabs-trigger"
      className={cn(
        "-mb-px inline-flex h-9 items-center gap-2 border-b-2 border-transparent px-3 text-sm font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 aria-selected:border-(--accent) aria-selected:text-foreground",
        className
      )}
      {...props}
    />
  )
)
TabsTrigger.displayName = "TabsTrigger"

const TabsContent = React.forwardRef<HTMLDivElement, TabsPrimitive.Panel.Props>(
  ({ className, ...props }, ref) => (
    <TabsPrimitive.Panel
      ref={ref}
      data-slot="tabs-content"
      className={cn("outline-none", className)}
      {...props}
    />
  )
)
TabsContent.displayName = "TabsContent"

export { Tabs, TabsList, TabsTrigger, TabsContent }
