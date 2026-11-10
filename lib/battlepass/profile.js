// Public profile loader: the Battle Pass items a member chose to show, grouped per season.
// Same opt-out rule as the bot: everything earned is visible unless the season or the item is hidden.
import { toLong } from '@/lib/mongo';
import { COLL } from './constants.js';
import { oid } from './store.js';

export const GROUPS = { badge: 'badge', achievement: 'medal' };

export function groupOf(type) { return GROUPS[type] || 'reward'; }

export function visibleItems(items, profile) {
  const hiddenSeasons = new Set((profile?.hidden_seasons || []).map(String));
  const hiddenItems = new Set((profile?.hidden_items || []).map(String));
  return items.filter((i) => !hiddenSeasons.has(String(i.season_id)) && !hiddenItems.has(String(i.item_id)));
}

export async function loadProfilePass(db, userId, { limit = 120 } = {}) {
  let uid;
  try { uid = toLong(userId); } catch { return null; }
  const [items, profile] = await Promise.all([
    db.collection(COLL.inventory).find({ user_id: uid }).sort({ obtained_at: -1 }).limit(500).toArray(),
    db.collection(COLL.profiles).findOne({ user_id: uid }),
  ]);
  const shown = visibleItems(items, profile).slice(0, limit);
  if (!shown.length) return null;
  const ids = [...new Set(shown.map((i) => i.season_id).filter(Boolean))];
  const docs = await db.collection(COLL.seasons).find({ _id: { $in: ids.map((x) => oid(x)).filter(Boolean) } }).project({ name: 1, i18n: 1, scope: 1 }).toArray();
  const meta = new Map(docs.map((d) => [String(d._id), d]));
  const seasons = ids.map((id) => {
    const d = meta.get(id);
    const own = shown.filter((i) => i.season_id === id);
    return {
      id, name: d?.name || '', i18n: d?.i18n || null, scope: d?.scope || 'global',
      items: own.map((i) => ({ item_id: i.item_id, type: i.type, group: groupOf(i.type), rarity: i.rarity || null, name: i.name, i18n: i.i18n || null, icon: i.icon || null, art: i.art || null })),
    };
  });
  return { seasons, featured: profile?.featured_badge || null };
}
