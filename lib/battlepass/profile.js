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
  // Counting badges are Wody achievements and have nothing to do with a Battle Pass: they are returned on their own.
  const mapItem = (i) => ({ item_id: i.item_id, type: i.type, group: groupOf(i.type), rarity: i.rarity || null, name: i.name, i18n: i.i18n || null, icon: i.icon || null, art: i.art || null });
  const achievements = shown.filter((i) => i.season_id === 'counting').map(mapItem);
  const rest = shown.filter((i) => i.season_id && i.season_id !== 'counting');
  const ids = [...new Set(rest.map((i) => i.season_id))];
  const docs = ids.length ? await db.collection(COLL.seasons).find({ _id: { $in: ids.map((x) => oid(x)).filter(Boolean) } }).project({ name: 1, i18n: 1, scope: 1 }).toArray() : [];
  const meta = new Map(docs.map((d) => [String(d._id), d]));
  // Only seasons that Wody itself runs (Global) are shown. Seasons that servers made for themselves stay on those servers.
  const seasons = ids.filter((id) => meta.get(id)?.scope === 'global').map((id) => {
    const d = meta.get(id);
    return { id, name: d.name || '', i18n: d.i18n || null, scope: 'global', items: rest.filter((i) => i.season_id === id).map(mapItem) };
  }).filter((se) => se.items.length);
  if (!seasons.length && !achievements.length) return null;
  return { seasons, achievements, featured: profile?.featured_badge || null };
}
