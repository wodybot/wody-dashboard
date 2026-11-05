'use client';
import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Languages } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Section } from '@/components/module-kit';
import { NativeSelect } from '@/components/module-kit';
import { LOCALES } from '@/lib/battlepass/locales.js';

const GROUPS = [
  { key: 'rewards', label: 'sections.rewards' },
  { key: 'quests', label: 'sections.quests' },
  { key: 'achievements', label: 'sections.achievements' },
  { key: 'collections', label: 'sections.collections' },
];

/** Translations of the content the owner wrote: season, rewards, quests, achievements and collections. */
export default function LocalizationTab({ draft, set }) {
  const t = useTranslations('battlepass');
  const [lang, setLang] = useState(LOCALES[1]);

  const put = (path, field, value) => {
    // path is a list key + index, or '' for the season itself
    const read = (item) => ({ ...(item.i18n || {}), [lang]: { ...((item.i18n || {})[lang] || {}), [field]: value } });
    const clean = (item) => {
      const i18n = read(item);
      if (!i18n[lang].name && !i18n[lang].description) delete i18n[lang];
      return Object.keys(i18n).length ? i18n : undefined;
    };
    if (!path) { set('i18n', clean(draft)); return; }
    const [key, index] = path.split(':');
    set(key, draft[key].map((item, i) => (i === Number(index) ? { ...item, i18n: clean(item) } : item)));
  };

  const progress = useMemo(() => {
    const items = [draft, ...GROUPS.flatMap((g) => draft[g.key] || [])];
    const done = items.filter((it) => it.i18n?.[lang]?.name).length;
    return `${done}/${items.length}`;
  }, [draft, lang]);

  const row = (item, path, label) => (
    <div key={`${path}`} className="grid gap-2 rounded-lg border border-border/50 bg-secondary/10 p-3 sm:grid-cols-2">
      <div className="min-w-0 sm:col-span-2"><p className="truncate text-xs text-muted-foreground">{label}</p><p className="truncate text-sm font-medium">{item.name || '-'}</p></div>
      <Input value={item.i18n?.[lang]?.name || ''} maxLength={60} placeholder={t('localization.namePlaceholder')} aria-label={t('fields.name')} onChange={(e) => put(path, 'name', e.target.value)} />
      <Input value={item.i18n?.[lang]?.description || ''} maxLength={path === '' ? 400 : 200} placeholder={t('localization.descriptionPlaceholder')} aria-label={t('fields.description')} onChange={(e) => put(path, 'description', e.target.value)} />
    </div>
  );

  return (
    <Section title={t('localization.title')} description={t('localization.intro')} icon={Languages}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-56"><NativeSelect value={lang} onChange={setLang} label={t('localization.language')} options={LOCALES.map((l) => ({ value: l, label: t(`localization.names.${l}`) }))} /></div>
        <span className="text-sm text-muted-foreground">{t('localization.translated', { done: progress })}</span>
      </div>
      <div className="space-y-3">
        {row(draft, '', t('sections.season'))}
        {GROUPS.map((g) => (draft[g.key] || []).map((item, i) => row(item, `${g.key}:${i}`, t(g.label))))}
      </div>
      <p className="text-xs text-muted-foreground">{t('localization.fallback')}</p>
    </Section>
  );
}
