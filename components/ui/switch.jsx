"use client"

import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

const Switch = React.forwardRef(({ className, onCheckedChange, ...props }, ref) => {
  const [justToggled, setJustToggled] = React.useState(false)
  const timeoutRef = React.useRef(null)

  const handleCheckedChange = React.useCallback(
    (checked) => {
      setJustToggled(true)
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current)
      timeoutRef.current = window.setTimeout(() => setJustToggled(false), 340)
      onCheckedChange?.(checked)
    },
    [onCheckedChange]
  )

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current)
    }
  }, [])

  return (
    <SwitchPrimitives.Root
      className={cn(
        "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-[#e6cd8c] data-[state=checked]:border-transparent data-[state=unchecked]:bg-muted-foreground/25 data-[state=unchecked]:border-muted-foreground/50",
        justToggled && "data-[state=checked]:animate-toggle-glow",
        className
      )}
      onCheckedChange={handleCheckedChange}
      {...props}
      ref={ref}>
      <SwitchPrimitives.Thumb
        className={cn(
          "pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0",
          justToggled
            ? "data-[state=checked]:animate-thumb-pop-on data-[state=unchecked]:animate-thumb-pop-off"
            : "transition-transform"
        )} />
    </SwitchPrimitives.Root>
  )
})
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }
