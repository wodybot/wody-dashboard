'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { TopNav, Footer } from '@/components/nav';

const SNOWFLAKE_RE = /^\d{15,25}$/;

function LoadingScreen() {
  const t = useTranslations('invite');
  return (
    <div className="min-h-screen flex flex-col">
      <TopNav />
      <main className="flex-1 flex items-center justify-center px-6">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>{t('redirecting')}</span>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function InviteCallbackInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const guildId = searchParams.get('guild_id');
    let cancelled = false;
    if (guildId && SNOWFLAKE_RE.test(guildId)) {
      const target = `/dashboard/${guildId}`;
      fetch('/api/auth/me')
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (cancelled) return;
          if (d && d.user) {
            router.replace(target);
          } else {
            window.location.replace(`/api/auth/login?next=${encodeURIComponent(target)}`);
          }
        })
        .catch(() => {
          if (!cancelled) router.replace(target);
        });
    } else {
      router.replace('/dashboard');
    }
    return () => { cancelled = true; };
  }, [searchParams, router]);

  return <LoadingScreen />;
}

export default function InviteCallbackClient() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <InviteCallbackInner />
    </Suspense>
  );
}
