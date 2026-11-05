'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export default function FloatingBar({ children, sidebar = true }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;
  return createPortal(
    <div className={`pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4 ${sidebar ? 'lg:left-80' : ''}`}>
      <div className="pointer-events-auto flex w-full max-w-3xl justify-center">{children}</div>
    </div>,
    document.body,
  );
}
