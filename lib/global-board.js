import { getDb } from '@/lib/mongo';

const TTL_MS = 30 * 1000;
let cached = null;
let inflight = null;

export async function getGlobalBoard() {
  const now = Date.now();
  if (cached && now - cached.at < TTL_MS) return cached.value;
  if (inflight) return inflight;
  inflight = loadBoard()
    .then((value) => {
      if (value.ok) cached = { at: Date.now(), value };
      return value;
    })
    .finally(() => { inflight = null; });
  return inflight;
}

async function loadBoard() {
  try {
    const db = await getDb();
    const doc = await db.collection('economy_global_top').findOne({ _id: 'top' });
    if (!doc) return { ok: true, rows: [], updatedAt: null, members: 0, servers: 0 };
    const rows = (Array.isArray(doc.rows) ? doc.rows : []).slice(0, 100).map((r) => ({
      rank: Number(r.rank) || 0,
      userId: String(r.user_id),
      name: String(r.name || '').slice(0, 60),
      avatar: r.avatar ? String(r.avatar) : null,
      total: Number(r.total) || 0,
      servers: Number(r.servers) || 1,
    }));
    return {
      ok: true,
      rows,
      updatedAt: doc.updated_at ? new Date(doc.updated_at).toISOString() : null,
      members: Number(doc.members) || 0,
      servers: Number(doc.servers) || 0,
    };
  } catch (e) {
    console.error('global board failed to load', e);
    return { ok: false, rows: [], updatedAt: null, members: 0, servers: 0 };
  }
}

export function boardAvatar(row) {
  if (row.avatar) {
    const ext = row.avatar.startsWith('a_') ? 'gif' : 'png';
    return `https://cdn.discordapp.com/avatars/${row.userId}/${row.avatar}.${ext}?size=64`;
  }
  let index = 0;
  try { index = Number((BigInt(row.userId) >> 22n) % 6n); } catch { index = 0; }
  return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
}
