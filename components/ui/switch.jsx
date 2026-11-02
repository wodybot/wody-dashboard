"use client"

import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

const Switch = React.forwardRef(({ className, onCheckedChange, ...props }, ref) => {
  // Drives the one-shot pop/glow animation below. Kept as local state (not a
  // CSS-only data-attribute trick) so the effect plays on user interaction
  // only, not on initial mount, where every switch on the page would
  // otherwise "pop" in at once as data-state first resolves.
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
        // Unchecked track used to be bg-input with a fully transparent border,
        // which on the app's near-black backgrounds (card ~8% / sidebar ~6%
        // lightness) read as an almost invisible dark-on-dark pill, people
        // couldn't tell an "off" switch from empty space. It now keeps a
        // visible border in the off state (still transparent once checked, so
        // the on/off shapes aren't identical) plus a lighter fill so the
        // control itself is always legible, not just the thumb.
        "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-[#e6cd8c] data-[state=checked]:border-transparent data-[state=unchecked]:bg-muted-foreground/25 data-[state=unchecked]:border-muted-foreground/50",
        // One-shot gold ripple confirming the flip to "on", only wired up
        // right after a real toggle, see justToggled above.
        justToggled && "data-[state=checked]:animate-toggle-glow",
        className
      )}
      onCheckedChange={handleCheckedChange}
      {...props}
      ref={ref}>
      <SwitchPrimitives.Thumb
        className={cn(
          "pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0",
          // While the pop animation runs it owns `transform` (slide + scale
          // bounce combined, see tailwind.config.js); otherwise fall back to
          // the plain transition so keyboard/programmatic changes still glide.
          justToggled
            ? "data-[state=checked]:animate-thumb-pop-on data-[state=unchecked]:animate-thumb-pop-off"
            : "transition-transform"
        )} />
    </SwitchPrimitives.Root>
  )
})
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }
