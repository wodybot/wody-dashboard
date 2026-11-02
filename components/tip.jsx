'use client';

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// One small tooltip for every icon button: hover (or keyboard focus) shows what the button does,
// the same bubble the Community button uses. The child must be a single element.
export function Tip({ label, side = 'bottom', children }) {
  if (!label) return children;
  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side={side} className="text-xs font-medium">{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
