'use client';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Briefcase } from 'lucide-react';
import { mfetch } from './client';
import ServerCollabForm from './ServerCollabForm';

export default function ServerCollabSettings({ guildId }) {
  const t = useTranslations('collab');
  const [s, setS] = useState(null);

  useEffect(() => {
    let live = true;
    setS(null);
    mfetch(`server/${guildId}`).then(async (a) => {
      if (!live || !a.ok) return;
      setS({ owner: Boolean(a.data.owner), require_approval: Boolean(a.data.require_approval), announce_channel_id: a.data.announce_channel_id || '', announce_channel_name: a.data.announce_channel_name || '' });
    });
    return () => { live = false; };
  }, [guildId]);

  if (!s) return null;

  return (
    <section className="rounded-2xl border border-border/60 bg-card/50 p-4 sm:p-5" aria-labelledby="collab-srv-title" data-testid="collab-server-settings">
      <div className="flex items-center gap-2">
        <Briefcase className="h-4 w-4 text-[#e6cd8c]" aria-hidden="true" />
        <h3 id="collab-srv-title" className="text-base font-semibold">{t('servers.cardTitle')}</h3>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{t('servers.syncNote')}</p>
      <div className="mt-4"><ServerCollabForm key={guildId} gid={guildId} owner={s.owner} initial={s} /></div>
    </section>
  );
}
