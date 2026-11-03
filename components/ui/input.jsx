import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef(({ className, type, onChange, ...props }, ref) => {
  const handleChange = type === 'number' && onChange
    ? (e) => {
        const raw = e.target.value;
        const clean = raw.replace(/^(-?)0+(?=\d)/, '$1');
        if (clean !== raw) e.target.value = clean;
        onChange(e);
      }
    : onChange;
  return (
    <input
      type={type}
      className={cn(
        "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className
      )}
      ref={ref}
      {...props}
      onChange={handleChange} />
  );
})
Input.displayName = "Input"

export { Input }
