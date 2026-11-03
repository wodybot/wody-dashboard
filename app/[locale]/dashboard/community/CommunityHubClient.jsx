'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Compass } from 'lucide-react';
import { Footer, TopNav } from '@/components/nav';
import { Card } from '@/components/ui/card';
import { LoadingOrError } from '@/components/module-kit';
import { discordCdnUrl } from '@/lib/utils';
import { useCApi } from '@/components/community/client';
import OwnerPanel from '@/components/community/OwnerPanel';
import { StatusBadge } from '@/components/community/StatusParts';

export default function CommunityHubClient() {
  const t = useTranslations('community');
  const api = useCApi('owner/hub');
  const [picked, setPicked] = useState(null);
  return (
    <div className="min-h-screen">
      <TopNav />
      <main id="main-content" className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        {picked ? (
          <><button type="button" onClick={() => setPicked(null)} className="mb-4 text-sm text-[#e08a4e] underline-offset-4 hover:underline">{t('hub.back')}</button><OwnerPanel guildId={picked} standalone /></>
        ) : (
          <>
            <h1 className="mb-2 flex items-center gap-3 text-3xl font-black"><Compass className="h-7 w-7 text-[#e08a4e]" aria-hidden="true" />{t('hub.title')}</h1>
            <p className="mb-6 text-muted-foreground">{t('hub.text')}</p>
            {api.status === 401 ? <Card className="p-8 text-center"><a href="/api/auth/login?next=%2Fdashboard%2Fcommunity" className="rounded-md bg-[#e6cd8c] text-[#1a1208] px-5 py-2 text-sm font-semibold">{t('reviews.login')}</a></Card> : (
              <LoadingOrError loading={api.loading} error={api.error} data={api.data} onRetry={api.reload}>
                {api.data?.items.length === 0 ? <Card className="p-10 text-center text-sm text-muted-foreground">{t('hub.empty')}</Card> : null}
                <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{(api.data?.items || []).map((g) => (
                  <li key={g.guild_id}><button type="button" onClick={() => setPicked(g.guild_id)} className="flex w-full items-center gap-3 rounded-xl border border-border/60 bg-card/50 p-4 text-left hover:border-[#e6cd8c]/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e6cd8c]">
                    {g.icon ? <img src={discordCdnUrl(`https://cdn.discordapp.com/icons/${g.guild_id}/${g.icon}.png?size=64`)} alt="" className="h-12 w-12 rounded-xl" /> : <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary font-bold" aria-hidden="true">{g.name.slice(0, 1)}</div>}
                    <div className="min-w-0"><div className="truncate font-semibold">{g.name}</div>{g.status ? <StatusBadge status={g.status} /> : <span className="text-xs text-muted-foreground">{g.can_create === false ? '' : t('hub.noListing')}</span>}</div>
                  </button></li>))}</ul>
              </LoadingOrError>
            )}
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
