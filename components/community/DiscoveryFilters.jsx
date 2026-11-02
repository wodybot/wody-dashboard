// Filter form for /servers. A plain GET form: it works without JavaScript, is fully keyboard
// accessible, and becomes a drawer (<details>) on small screens.
import { useLocale, useTranslations } from 'next-intl';
import { SlidersHorizontal } from 'lucide-react';
import { catalogName } from '@/lib/community/names';
import { LANGUAGES, SERVER_TYPES, SORTS, MEMBER_BANDS, ACTIVITY_LEVELS } from '@/lib/community/constants';
import { Link } from '@/i18n/navigation';

function Group({ title, children }) {
  return (
    <fieldset className="space-y-2">
      <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</legend>
      {children}
    </fieldset>
  );
}

function Fields({ catalog, params }) {
  const t = useTranslations('community');
  const locale = useLocale();
  const sel = (list, v) => new Set(Array.isArray(list) ? list : String(list || '').split(',').filter(Boolean)).has(v);
  const cats = catalog.categories.filter((c) => !c.parent);
  const subs = catalog.categories.filter((c) => c.parent && c.parent === params.category);
  const field = 'h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
  return (
    <div className="space-y-5">
      <Group title={t('filters.category')}>
        <select name="category" defaultValue={params.category || ''} className={field} aria-label={t('filters.category')}>
          <option value="">{t('filters.all')}</option>
          {cats.map((c) => <option key={c.slug} value={c.slug}>{catalogName(t, 'categories', c, locale)}</option>)}
        </select>
        {subs.length ? (
          <select name="sub" defaultValue={params.subcategory || ''} className={field} aria-label={t('filters.subcategory')}>
            <option value="">{t('filters.all')}</option>
            {subs.map((c) => <option key={c.slug} value={c.slug}>{catalogName(t, 'categories', c, locale)}</option>)}
          </select>
        ) : null}
      </Group>
      <Group title={t('filters.language')}>
        <div className="grid grid-cols-2 gap-1.5">
          {LANGUAGES.slice(0, 12).map((l) => (
            <label key={l} className="flex cursor-pointer items-center gap-2 text-sm"><input type="checkbox" name="lang" value={l} defaultChecked={sel(params.languages, l)} className="accent-[#e6cd8c]" />{t(`languages.${l}`)}</label>
          ))}
        </div>
      </Group>
      <Group title={t('filters.members')}>
        <select name="members" defaultValue={params.members || 'any'} className={field} aria-label={t('filters.members')}>
          {MEMBER_BANDS.map((b) => <option key={b} value={b}>{t(`filters.bands.${b}`)}</option>)}
        </select>
      </Group>
      <Group title={t('filters.type')}>
        <select name="type" defaultValue={params.server_type || ''} className={field} aria-label={t('filters.type')}>
          <option value="">{t('filters.all')}</option>
          {SERVER_TYPES.map((s) => <option key={s} value={s}>{t(`types.${s}`)}</option>)}
        </select>
      </Group>
      <Group title={t('filters.features')}>
        <div className="space-y-1.5">
          {catalog.features.map((f) => (
            <label key={f.slug} className="flex cursor-pointer items-center gap-2 text-sm"><input type="checkbox" name="features" value={f.slug} defaultChecked={sel(params.features, f.slug)} className="accent-[#e6cd8c]" />{catalogName(t, 'features', f, locale)}</label>
          ))}
        </div>
      </Group>
      <Group title={t('filters.tags')}>
        <div className="flex flex-wrap gap-1.5">
          {catalog.tags.map((tag) => (
            <label key={tag.slug} className="cursor-pointer"><input type="checkbox" name="tags" value={tag.slug} defaultChecked={sel(params.tags, tag.slug)} className="peer sr-only" /><span className="inline-block rounded-full border border-border/60 px-2.5 py-1 text-xs peer-checked:border-[#e6cd8c] peer-checked:bg-[#e6cd8c]/20 peer-focus-visible:ring-2 peer-focus-visible:ring-ring">{catalogName(t, 'tags', tag, locale)}</span></label>
          ))}
        </div>
      </Group>
      <Group title={t('filters.activity')}>
        <select name="activity" defaultValue={params.activity || 'any'} className={field} aria-label={t('filters.activity')}>
          {ACTIVITY_LEVELS.map((a) => <option key={a} value={a}>{t(`filters.activityLevels.${a}`)}</option>)}
        </select>
      </Group>
    </div>
  );
}

export default function DiscoveryFilters({ catalog, params }) {
  const t = useTranslations('community');
  const body = (
    <>
      <input type="hidden" name="q" value={params.q || ''} />
      <input type="hidden" name="sort" value={params.sort || 'recommended'} />
      <Fields catalog={catalog} params={params} />
      <div className="mt-5 flex gap-2">
        <button type="submit" className="flex-1 rounded-md bg-[#e6cd8c] text-[#1a1208] px-4 py-2 text-sm font-semibold hover:bg-[#f3e1b0] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e6cd8c]">{t('filters.apply')}</button>
        <Link href="/servers" className="rounded-md border border-border/60 px-4 py-2 text-sm hover:bg-secondary/50">{t('filters.reset')}</Link>
      </div>
    </>
  );
  return (
    <>
      <details className="rounded-xl border border-border/60 bg-card/50 p-3 lg:hidden">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold"><SlidersHorizontal className="h-4 w-4" aria-hidden="true" />{t('filters.title')}</summary>
        <form method="get" action="/servers" className="mt-4">{body}</form>
      </details>
      <aside aria-label={t('filters.title')} className="sticky top-20 hidden max-h-[calc(100vh-6rem)] overflow-y-auto rounded-2xl border border-border/60 bg-card/50 p-4 lg:block">
        <form method="get" action="/servers">{body}</form>
      </aside>
    </>
  );
}
