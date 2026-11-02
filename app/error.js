'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { FALLBACK_ERROR_TEXT, fallbackErrorLocale } from '@/lib/fallback-error-text';

export default function AppError({ error, reset }) {
  const [lang, setLang] = useState('en');
  useEffect(() => {
    console.error('App-level client exception:', error);
  }, [error]);
  useEffect(() => { setLang(fallbackErrorLocale()); }, []);
  const text = FALLBACK_ERROR_TEXT[lang] || FALLBACK_ERROR_TEXT.en;

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <h1 className="text-2xl font-bold mb-2">{text.heading}</h1>
        <p className="text-sm text-muted-foreground mb-6">{text.text}</p>
        <Button
          onClick={() => {
            // reset() alone just re-renders the boundary; if the same
            // condition (bad fetch, stale state) is still there it fails
            // again instantly. A full reload guarantees a clean retry.
            try { reset(); } finally { window.location.reload(); }
          }}
          className="gradient-primary"
        >
          <RefreshCw className="w-4 h-4 mr-2" /> {text.retry}
        </Button>
      </div>
    </div>
  );
}
