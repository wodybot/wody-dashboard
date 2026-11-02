// FILE: InviteCallbackClient.jsx
// PUNE ÎN: app/[locale]/invite/callback/InviteCallbackClient.jsx  (fișier nou)
'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { TopNav, Footer } from '@/components/nav';

// A bare Discord snowflake: 15-25 digits. Guards against a malformed or
// tampered guild_id (e.g. someone hand-editing the URL) ever being handed
// to the dashboard route as-is.
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

// useSearchParams() requires a Suspense boundary around whatever calls it
// (Next.js App Router build fails otherwise: "useSearchParams() should be
// wrapped in a suspense boundary"), so the actual param-reading logic
// lives in this inner component, and the default export below only
// renders it inside <Suspense>. The fallback is the exact same loading
// screen the inner component itself renders while the effect runs, so
// there's no visible difference between "still suspended" and "mounted,
// about to redirect", both look like the one loading state the whole
// page ever shows.
function InviteCallbackInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const guildId = searchParams.get('guild_id');
    let cancelled = false;
    // No replace history entry left behind for any branch, so the
    // browser's back button doesn't bounce someone back through this
    // bare bounce-through page.
    if (guildId && SNOWFLAKE_RE.test(guildId)) {
      const target = `/dashboard/${guildId}`;
      fetch('/api/auth/me')
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (cancelled) return;
          if (d && d.user) {
            router.replace(target);
          } else {
            // Full page navigation on purpose: /api/auth/login is a server
            // route that redirects to Discord, not a Next.js page.
            window.location.replace(`/api/auth/login?next=${encodeURIComponent(target)}`);
          }
        })
        .catch(() => {
          // Can't tell whether they're logged in: the dashboard will sort
          // it out itself, same as before this check existed.
          if (!cancelled) router.replace(target);
        });
    } else {
      // Missing/invalid guild_id: the person backed out of the Discord
      // authorize screen without picking a server, or landed here some
      // other way. The general server picker is the safest fallback,
      // never a dead end.
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
