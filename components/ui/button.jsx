import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"

// Signature "premium" shape: an asymmetric border-radius (large on two
// opposite corners, tight on the other two) applied the SAME way on every
// button, everywhere. Consistency is what makes an irregular shape read as
// an intentional design choice instead of a rendering glitch, so this
// exact corner pattern should not vary button-to-button.
const PREMIUM_RADIUS = "rounded-tl-xl rounded-br-xl rounded-tr-[4px] rounded-bl-[4px]";

const buttonVariants = cva(
  `inline-flex items-center justify-center gap-2 whitespace-nowrap ${PREMIUM_RADIUS} text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 hover:-translate-y-0.5 active:translate-y-0`,
  {
    variants: {
      variant: {
        default:
          "bg-[#e6cd8c] text-[#1a1208] shadow hover:shadow-lg hover:bg-[#f3e1b0]",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:shadow-lg hover:bg-destructive/90",
        outline:
          "border border-input bg-background shadow-sm hover:shadow-md hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground shadow-sm hover:shadow-md hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: `h-8 ${PREMIUM_RADIUS} px-3 text-xs`,
        lg: `h-10 ${PREMIUM_RADIUS} px-8`,
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button"
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props} />
  );
})
Button.displayName = "Button"

export { Button, buttonVariants }
