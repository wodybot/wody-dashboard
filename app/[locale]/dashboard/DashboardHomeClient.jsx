'use client';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useRouter } from '@/i18n/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Server, ExternalLink, CheckCircle2, XCircle } from 'lucide-react';
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {guilds.map((g) => (
              <Card key={g.id} className="p-5 group hover:-translate-y-0.5 hover:border-primary/30 transition-all duration-200 bg-card/55 backdrop-blur-sm relative overflow-hidden shadow-sm">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition" />
                <div className="relative">
                  <div className="flex items-center gap-3 mb-4">
                    {guildIcon(g) ? (
                      <img src={guildIcon(g)} alt="" className="w-12 h-12 rounded-xl" />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center font-bold">
                        {(g.name || '??').slice(0,2).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{g.name}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        {g.bot_present ? (
                          <><CheckCircle2 className="w-3 h-3 text-green-500" /> {t('botOnline')}</>
                        ) : (
                          <><XCircle className="w-3 h-3 text-yellow-500" /> {t('botMissing')}</>
                        )}
                      </div>
                    </div>
                  </div>
                  {g.bot_present ? (
                    <Link href={`/dashboard/${g.id}`}>
                      <Button className="w-full gradient-primary hover:opacity-90">{t('manage')}</Button>
                    </Link>
                  ) : (
                    <a href={`${INVITE_URL}&guild_id=${g.id}`} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" className="w-full">
                        <ExternalLink className="w-4 h-4 mr-2" /> {t('inviteHere')}
                      </Button>
                    </a>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
