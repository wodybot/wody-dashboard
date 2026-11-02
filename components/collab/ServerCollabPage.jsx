'use client';
// The Collab page of ONE server: only requests made for that server, with the categories its owner created.
// Public categories can be posted in by any member, restricted ones by the chosen roles, private ones by staff.
// The API answers can_post for the signed-in person; the real check is made again when the request is saved.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowLeft, Lock, Plus, Users } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import RequestCard, { CardSkeletons } from './RequestCard';
import { mfetch } from './client';
import { btn, btnMain } from './ui';

export default function ServerCollabPage({ guildId, initialCategory = '', signedIn = false }) {
  const t = useTranslations('collab');
  const locale = useLocale();
  const [meta, setMeta] = useState({ loading: true, error: false, guild: null, categories: [] });
  const [cat, setCat] = useState(initialCategory);
  const [list, setList] = useState({ items: [], next: null, loading: true, error: false, more: false });
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  useEffect(() => {
    let live = true;
    mfetch(`guild/${guildId}/categories`).then((r) => {
      if (!live) return;
      setMeta(r.ok ? { loading: false, error: false, guild: r.data.guild, categories: r.data.categories } : { loading: false, error: true, guild: null, categories: [] });
    });
    return () => { live = false; };
  }, [guildId]);

  const load = useCallback(async (cursor = '') => {
    const q = new URLSearchParams({ guild: guildId });
    if (cat) q.set('category', cat);
    if (cursor) q.set('cursor', cursor);
    setList((s) => (cursor ? { ...s, more: true } : { items: [], next: null, loading: true, error: false, more: false }));
    const r = await mfetch(`section/recent?${q}`);
    if (!alive.current) return;
    setList((s) => (r.ok ? { items: cursor ? [...s.items, ...r.data.items] : r.data.items, next: r.data.next || null, loading: false, error: false, more: false } : { ...s, loading: false, error: !cursor, more: false }));
  }, [guildId, cat]);
  useEffect(() => { load(); }, [load]);

  const current = meta.categories.find((c) => c.slug === cat);
  const postHref = `/createcollab?guild=${guildId}${cat ? `&category=${cat}` : ''}`;
  const name = meta.guild?.name || '';

  return (
    <div>
      <Link href="/collab" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" aria-hidden="true" />{t('serverPage.back')}</Link>
      <header className="mb-6">
        <h1 className="text-2xl font-black tracking-tight sm:text-4xl">{name ? t('serverPage.title', { name }) : t('title')}</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{t('serverPage.subtitle')}</p>
        <div className="mt-4">
          {signedIn ? (
            <Link href={postHref} className={`${btnMain} min-h-11`}><Plus className="h-4 w-4" aria-hidden="true" />{t('serverPage.post')}</Link>
          ) : (
            <a href={`/api/auth/login?next=${encodeURIComponent(`${locale === 'en' ? '' : `/${locale}`}/createcollab?guild=${guildId}${cat ? `&category=${cat}` : ''}`)}`} className={`${btnMain} min-h-11`}>{t('serverPage.loginToPost')}</a>
          )}
          {current && !current.can_post && signedIn && <p role="note" className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground"><Lock className="h-3.5 w-3.5" aria-hidden="true" />{t('serverPage.locked')}</p>}
        </div>
      </header>

      {meta.categories.length > 0 && (
        <nav aria-label={t('serverPage.categories')} className="mb-6 flex flex-wrap gap-2">
          {[{ slug: '', name: t('serverPage.all'), access: 'public', can_post: true }, ...meta.categories].map((c) => {
            const on = cat === c.slug;
            return (
              <button key={c.slug || 'all'} type="button" aria-pressed={on} onClick={() => setCat(c.slug)}
                className={`inline-flex min-h-10 items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-medium transition ${on ? 'border-[#e6cd8c]/70 bg-[#e6cd8c]/15 text-[#f3e1b0]' : 'border-border/60 bg-card/50 hover:border-[#e6cd8c]/50'}`}>
                {c.access === 'private' && <Lock className="h-3.5 w-3.5" aria-hidden="true" />}{c.access === 'roles' && <Users className="h-3.5 w-3.5" aria-hidden="true" />}
                <span className="max-w-[14rem] truncate">{c.name}</span>
              </button>
            );
          })}
        </nav>
      )}

      {list.error ? (
        <div role="alert" className="flex items-center gap-3 rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm"><span className="flex-1">{t('serverPage.loadError')}</span><button type="button" className={btn} onClick={() => load()}>{t('retry')}</button></div>
      ) : list.loading ? (
        <div className="flex flex-wrap gap-4"><CardSkeletons /></div>
      ) : list.items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">{t('serverPage.empty')}</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-4">{list.items.map((it) => <RequestCard key={it.id} item={it} categories={[]} />)}</div>
          {list.next && <div className="mt-6 text-center"><button type="button" className={`${btn} min-h-11`} disabled={list.more} onClick={() => load(list.next)}>{t('serverPage.more')}</button></div>}
        </>
      )}
    </div>
  );
}
