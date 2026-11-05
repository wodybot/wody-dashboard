
import { notFound } from 'next/navigation';
import { getSession } from '@/lib/session';
import { headers } from 'next/headers';
import { getDb } from '@/lib/mongo';
import { getDelegate } from '@/lib/owner-access';
import { audit } from '@/lib/owner-audit';
import OwnerPanelClient from './OwnerPanelClient';

const OWNER_ID = process.env.DISCORD_OWNER_ID || process.env.NEXT_PUBLIC_DISCORD_OWNER_ID || '932582842351898644';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata = { robots: { index: false, follow: false } };

export default async function DashboardOwnerPanelPage() {
  const session = await getSession().catch(() => null);
  if (!session?.user) notFound();
  const isOwner = String(session.user.id) === OWNER_ID;
  let isDelegate = false;
  if (!isOwner) {
    try {
      const db = await getDb();
      isDelegate = Boolean(await getDelegate(db, session.user.id));
    } catch { isDelegate = false; }
    if (!isDelegate) notFound();
  }
  try {
    const db = await getDb();
    const bucket = Math.floor(Date.now() / 600000);
    const r = await db.collection('rate_limit_buckets').findOneAndUpdate(
      { _id: `panel-open:${session.user.id}:${bucket}` },
      { $inc: { count: 1 }, $setOnInsert: { expires_at: new Date((bucket + 2) * 600000) } },
      { upsert: true, returnDocument: 'after' },
    );
    if ((r?.count ?? r?.value?.count ?? 1) === 1) {
      const h = await headers();
      await audit(db, {
        actor: { id: session.user.id, name: session.user.global_name || session.user.username },
        role: isOwner ? 'owner' : 'delegate', action: 'panel.open', outcome: 'ok',
        detail: isOwner ? 'opened the full Owner Panel' : 'opened the Owner Panel (community management only)',
        request: { headers: h },
      });
    }
  } catch (e) { console.error('panel open audit failed', e?.message || e); }
  return <OwnerPanelClient restricted={!isOwner} />;
}
