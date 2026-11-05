import { getDb, toLong } from '@/lib/mongo';

const WAIT_MS = 12000;
const POLL_MS = 350;

export async function requestBot({ kind, guildId, userId, payload = {} }) {
  const db = await getDb();
  const gid = toLong(guildId);
  const recent = await db.collection('module_requests').countDocuments({
    guild_id: gid, kind, created_at: { $gt: new Date(Date.now() - 15000) },
  });
  if (recent >= 4) return { error: 'rate_limited' };
  const res = await db.collection('module_requests').insertOne({
    kind, guild_id: gid, requested_by: toLong(userId), payload, status: 'pending', created_at: new Date(),
  });
  const id = res.insertedId;
  const deadline = Date.now() + WAIT_MS;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_MS));
    const doc = await db.collection('module_requests').findOne({ _id: id });
    if (doc?.status === 'done') return { ok: true, result: doc.result || {} };
    if (doc?.status === 'failed') return { error: doc.error_code || 'failed', message: doc.error || '' };
  }
  await db.collection('module_requests').deleteOne({ _id: id, status: 'pending' });
  return { error: 'bot_unreachable' };
}
