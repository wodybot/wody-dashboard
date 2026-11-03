'use client';

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

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
