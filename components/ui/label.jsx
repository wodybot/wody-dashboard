"use client"

import * as React from "react"
import * as LabelPrimitive from "@radix-ui/react-label"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"

// `leading-none` (line-height: 1) is only safe for a label that always fits
// on one line. On a phone most of these labels wrap, and with line-height 1
// the two lines sit directly on top of each other with their ascenders and
// descenders colliding, which is the "the text looks broken / drifts" look
// reported on mobile. `leading-snug` gives wrapped labels room, and
// `break-words` stops a long single word (a channel name, a URL) from
// forcing its container wider than the screen.
const labelVariants = cva(
  "text-[15px] font-medium leading-snug break-words peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
)

const Label = React.forwardRef(({ className, ...props }, ref) => (
  <LabelPrimitive.Root ref={ref} className={cn(labelVariants(), className)} {...props} />
))
Label.displayName = LabelPrimitive.Root.displayName

export { Label }
