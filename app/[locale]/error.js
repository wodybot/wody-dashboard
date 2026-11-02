'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

export default function AppError({ error, reset }) {
  const t = useTranslations('errorPage');

  useEffect(() => {
    console.error('App-level client exception:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <h1 className="text-2xl font-bold mb-2">{t('heading')}</h1>
        <p className="text-sm text-muted-foreground mb-6">
          {t('body')}
        </p>
        <Button
          onClick={() => {
            // reset() alone just re-renders the boundary; if the same
            // condition (bad fetch, stale state) is still there it fails
            // again instantly. A full reload guarantees a clean retry.
            try { reset(); } finally { window.location.reload(); }
          }}
          className="gradient-primary"
        >
          <RefreshCw className="w-4 h-4 mr-2" /> {t('retry')}
        </Button>
      </div>
    </div>
  );
}
