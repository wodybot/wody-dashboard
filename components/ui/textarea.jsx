import * as React from "react"

import { cn } from "@/lib/utils"

// Max height (px) before we stop growing and let it scroll internally instead,
// otherwise a really long paste could push the whole page height around.
const MAX_AUTOGROW_HEIGHT = 480;

const Textarea = React.forwardRef(({ className, onInput, ...props }, ref) => {
  const innerRef = React.useRef(null);

  const setRefs = React.useCallback((node) => {
    innerRef.current = node;
    if (typeof ref === "function") ref(node);
    else if (ref) ref.current = node;
  }, [ref]);

  const resize = React.useCallback(() => {
    const el = innerRef.current;
    if (!el) return;
    el.style.height = "auto"; // reset first so scrollHeight reflects the new content, not the old height
    const next = Math.min(el.scrollHeight, MAX_AUTOGROW_HEIGHT);
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > MAX_AUTOGROW_HEIGHT ? "auto" : "hidden";
  }, []);

  // Grow to fit whenever the value changes, including when it's set
  // programmatically (e.g. loading an existing scheduled message to edit).
  React.useEffect(() => {
    resize();
  }, [props.value, resize]);

  function handleInput(e) {
    resize();
    onInput?.(e);
  }

  return (
    <textarea
      className={cn(
        "flex min-h-[60px] w-full resize-none overflow-hidden rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className
      )}
      ref={setRefs}
      onInput={handleInput}
      {...props} />
  );
})
Textarea.displayName = "Textarea"

export { Textarea }
