'use client';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Heart, Loader2 } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import ServerCard from '@/components/community/ServerCard';

export default function FavoritesClient() {
  const t = useTranslations('community');
  const [state, setState] = useState({ loading: true, items: [], auth: true, catalog: null, error: false });
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [fav, cat] = await Promise.all([fetch('/api/community/me/favorites'), fetch('/api/community/public/catalog')]);
        if (!alive) return;
        if (fav.status === 401) { setState({ loading: false, items: [], auth: false, catalog: null, error: false }); return; }
        const items = (await fav.json()).items || [];
        setState({ loading: false, items, auth: true, catalog: await cat.json(), error: !fav.ok });
      } catch { if (alive) setState({ loading: false, items: [], auth: true, catalog: null, error: true }); }
    })();
    return () => { alive = false; };
  }, []);
  return (
    <>
      <h1 className="mb-6 flex items-center gap-3 text-3xl font-black"><Heart className="h-7 w-7 text-rose-500" aria-hidden="true" />{t('favorites.mine')}</h1>
      {state.loading ? <div className="flex justify-center py-20" role="status" aria-label={t('common.loading')}><Loader2 className="h-6 w-6 animate-spin" /></div>
        : !state.auth ? <div className="rounded-2xl border border-dashed border-border/70 px-6 py-14 text-center"><p className="mb-4 text-muted-foreground">{t('favorites.loginText')}</p><a href="/api/auth/login?next=%2Fservers%2Ffavorites" className="rounded-md bg-[#e6cd8c] text-[#1a1208] px-5 py-2 text-sm font-semibold">{t('reviews.login')}</a></div>
        : state.error ? <p role="alert" className="text-red-400">{t('errors.generic')}</p>
        : state.items.length === 0 ? <div className="rounded-2xl border border-dashed border-border/70 px-6 py-14 text-center"><p className="font-semibold">{t('favorites.emptyTitle')}</p><p className="mt-1 text-sm text-muted-foreground">{t('favorites.emptyText')}</p><Link href="/servers" className="mt-4 inline-block text-sm text-[#e08a4e] underline-offset-4 hover:underline">{t('favorites.browse')}</Link></div>
        : <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{state.items.map((s) => <ServerCard key={s.slug} server={s} catalog={state.catalog} />)}</div>}
    </>
  );
}
