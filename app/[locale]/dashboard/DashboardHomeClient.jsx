'use client';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useRouter } from '@/i18n/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Server, ExternalLink, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { Footer } from '@/components/nav';
import { INVITE_URL } from '@/lib/content';
import { discordCdnUrl } from '@/lib/utils';

async function safeJson(url, options) {
  try {
    const res = await fetch(url, options);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function guildIcon(g) {
  if (!g.icon) return null;
  const ext = g.icon.startsWith('a_') ? 'gif' : 'png';
  return discordCdnUrl(`https://cdn.discordapp.com/icons/${g.id}/${g.icon}.${ext}?size=128`);
}

export default function DashboardHomeClient() {
  const t = useTranslations('dashboardHome');
  const tNav = useTranslations('nav');
  const tGuild = useTranslations('guildSettings.common');
  const [openingId, setOpeningId] = useState(null);
  const [me, setMe] = useState(null);
  const [guilds, setGuilds] = useState([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  async function load() {
    setLoading(true);
    const [meRes, g0] = await Promise.all([
      safeJson('/api/auth/me', { cache: 'no-store' }),
      safeJson('/api/guilds', { cache: 'no-store' }),
    ]);
    let g = g0;
    for (let attempt = 1; !g && meRes?.user && attempt <= 3; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 700 * attempt));
      g = await safeJson('/api/guilds', { cache: 'no-store' });
    }
    if (!meRes || !meRes.user) { router.push('/'); return; }
    setMe(meRes.user);
    if (!g) {
      toast.error(t('loadError'));
      setGuilds([]);
      setLoading(false);
      return;
    }
    setGuilds(g.guilds || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const onRefreshRequest = () => load();
    window.addEventListener('wody:refresh', onRefreshRequest);
    return () => window.removeEventListener('wody:refresh', onRefreshRequest);
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <main id="main-content" className="flex-1 pt-8 sm:pt-10 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 md:py-10">
        <div className="flex flex-row items-center justify-between gap-3 mb-10 p-5 sm:p-6 rounded-2xl border border-border/70 bg-card/45 backdrop-blur-sm">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-1 truncate">{t('title')}</h1>
            <p className="text-sm text-muted-foreground truncate">{t('subtitle')}</p>
          </div>
          <div id="dashboard-home-actions" className="flex items-center justify-end gap-2 shrink-0" />
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-44 rounded-2xl border border-border bg-card/40 animate-pulse" />
            ))}
          </div>
        ) : guilds.length === 0 ? (
          <Card className="p-8 sm:p-10 text-center bg-card/50 backdrop-blur-sm border border-border/70 rounded-2xl">
            <Server className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground mb-4">{t('empty')}</p>
            <a href={INVITE_URL} target="_blank" rel="noopener noreferrer">
              <Button className="gradient-primary"><ExternalLink className="w-4 h-4 mr-2" /> {tNav('invite')}</Button>
            </a>
          </Card>
        ) : (
          <div className="space-y-10">
            {guilds.some((g) => !g.bot_present) ? (
              <section aria-labelledby="no-wody-title">
                <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <h2 id="no-wody-title" className="flex items-center gap-2 text-lg font-bold">
                      {t('missingTitle')}
                      <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-xs font-semibold tabular-nums text-amber-300">{guilds.filter((g) => !g.bot_present).length}</span>
                    </h2>
                    <p className="text-sm text-muted-foreground">{t('missingText')}</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {guilds.filter((g) => !g.bot_present).map((g) => (
                    <Card key={g.id} className="flex items-center gap-3 border-dashed border-amber-400/30 bg-amber-400/[0.03] p-4 transition hover:border-amber-400/60">
                      {guildIcon(g) ? <img src={guildIcon(g)} alt="" className="h-11 w-11 shrink-0 rounded-xl opacity-90" /> : <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-sm font-bold">{(g.name || '??').slice(0, 2).toUpperCase()}</div>}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold">{g.name}</div>
                        <div className="flex items-center gap-1 text-xs text-amber-300/90"><XCircle className="h-3 w-3" /> {t('botMissing')}</div>
                      </div>
                      <a href={`${INVITE_URL}&guild_id=${g.id}`} target="_blank" rel="noopener noreferrer" className="shrink-0">
                        <Button size="sm" className="gradient-primary gap-1.5"><ExternalLink className="h-3.5 w-3.5" />{t('inviteHere')}</Button>
                      </a>
                    </Card>
                  ))}
                </div>
              </section>
            ) : null}

            {guilds.some((g) => g.bot_present) ? (
              <section aria-labelledby="with-wody-title">
                <h2 id="with-wody-title" className="mb-4 flex items-center gap-2 text-lg font-bold">
                  {t('presentTitle')}
                  <span className="rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2 py-0.5 text-xs font-semibold tabular-nums text-emerald-300">{guilds.filter((g) => g.bot_present).length}</span>
                </h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {guilds.filter((g) => g.bot_present).map((g) => {
                    const opening = openingId === g.id;
                    // The whole card is the link (no button inside a link), so a click anywhere on it opens the server, and the
                    // card shows at once that it is opening.
                    return (
                      <Link
                        key={g.id}
                        href={`/dashboard/${g.id}`}
                        onClick={(e) => { if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return; setOpeningId(g.id); }}
                        aria-busy={opening || undefined}
                        className="group relative block overflow-hidden rounded-2xl border border-border bg-card/55 p-5 shadow-sm backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                      >
                        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 transition group-hover:opacity-100" aria-hidden="true" />
                        <div className="relative">
                          <div className="mb-4 flex items-center gap-3">
                            {guildIcon(g) ? <img src={guildIcon(g)} alt="" className="h-12 w-12 rounded-xl" /> : <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary font-bold">{(g.name || '??').slice(0, 2).toUpperCase()}</div>}
                            <div className="min-w-0">
                              <div className="truncate font-semibold">{g.name}</div>
                              <div className="flex items-center gap-1 text-xs text-muted-foreground"><CheckCircle2 className="h-3 w-3 text-green-500" /> {t('botOnline')}</div>
                            </div>
                          </div>
                          <span className="gradient-primary inline-flex h-10 w-full items-center justify-center gap-2 rounded-md px-4 text-sm font-medium transition group-hover:opacity-90">
                            {opening ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                            {opening ? tGuild('loadingServer') : t('manage')}
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            ) : null}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
