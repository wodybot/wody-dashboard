import { ObjectId } from 'mongodb';
import DEFAULTS from '@/lib/economy-defaults.json';
import { json, validationError, premiumRequired, notFound, clampPage } from '@/lib/modules/http';
import {
  fail, pickBool, pickInt, pickNumber, pickText, pickEnum, pickUrl, cleanText,
} from '@/lib/modules/validate';

const E = DEFAULTS.economy;
const RATE_KEYS = new Set(['bank_interest_rate', 'savings_interest_rate', 'transfer_tax', 'market_tax', 'money_multiplier', 'xp_multiplier', 'job_reward_multiplier']);
const CATEGORY_KEYS = E.shop_categories.map((c) => c[0]);
const MAX_ITEMS = 300;
const RESET_SCOPES = ['economy', 'shop', 'market', 'leaderboard'];

export const EVENT_KEYS = Object.keys(E.events);

export function sanitizeSettings(body, existing) {
  const errors = [];
  const patch = {};
  const has = (k) => body[k] !== undefined;
  if (has('currency_name')) {
    patch.currency_name = pickText(errors, 'currency_name', body.currency_name, 24);
    if (!patch.currency_name) fail(errors, 'currency_name', 'required');
  }
  if (has('currency_symbol')) patch.currency_symbol = pickText(errors, 'currency_symbol', body.currency_symbol, 4);
  if (has('currency_icon')) patch.currency_icon = pickText(errors, 'currency_icon', body.currency_icon, 40);
  for (const [key, [min, max]] of Object.entries(E.bounds)) {
    if (!has(key)) continue;
    patch[key] = RATE_KEYS.has(key)
      ? pickNumber(errors, key, body[key], min, max, existing[key])
      : pickInt(errors, key, body[key], min, max, existing[key]);
  }
  if (has('cooldowns') && body.cooldowns && typeof body.cooldowns === 'object') {
    const cd = { ...existing.cooldowns };
    for (const key of E.cooldown_keys) {
      if (body.cooldowns[key] !== undefined) cd[key] = pickInt(errors, `cooldowns.${key}`, body.cooldowns[key], E.cooldown_bounds[0], E.cooldown_bounds[1], cd[key]);
    }
    patch.cooldowns = cd;
  }
  if (has('features') && body.features && typeof body.features === 'object') {
    const f = { ...existing.features };
    for (const key of E.features) if (body.features[key] !== undefined) f[key] = pickBool(body.features[key], f[key]);
    patch.features = f;
  }
  for (const [field, catalog, extra] of [['jobs', E.jobs, 'salary_multiplier'], ['businesses', E.businesses, 'price_multiplier']]) {
    if (has(field) && body[field] && typeof body[field] === 'object') {
      const map = { ...(existing[field] || {}) };
      for (const key of Object.keys(catalog)) {
        const v = body[field][key];
        if (!v) continue;
        map[key] = {
          enabled: pickBool(v.enabled, map[key]?.enabled ?? true),
          [extra]: pickNumber(errors, `${field}.${key}.${extra}`, v[extra], 0.1, 10, map[key]?.[extra] ?? 1),
        };
      }
      patch[field] = map;
    }
  }
  if (has('commodities') && body.commodities && typeof body.commodities === 'object') {
    const map = { ...(existing.commodities || {}) };
    for (const key of Object.keys(E.commodities)) if (body.commodities[key]) map[key] = { enabled: pickBool(body.commodities[key].enabled, true) };
    patch.commodities = map;
  }
  if (has('quests') && body.quests && typeof body.quests === 'object') {
    const q = { ...existing.quests };
    for (const k of ['daily', 'weekly', 'monthly', 'special']) if (body.quests[k] !== undefined) q[k] = pickBool(body.quests[k], q[k]);
    if (body.quests.reward_multiplier !== undefined) q.reward_multiplier = pickNumber(errors, 'quests.reward_multiplier', body.quests.reward_multiplier, 0.1, 10, q.reward_multiplier);
    patch.quests = q;
  }
  if (has('staff_role_ids')) {
    const ids = Array.isArray(body.staff_role_ids) ? body.staff_role_ids.map(String) : [];
    if (ids.length > 10) fail(errors, 'staff_role_ids', 'too_many', { max: 10 });
    if (ids.some((id) => !/^\d{15,25}$/.test(id))) fail(errors, 'staff_role_ids', 'invalid_choice');
    patch.staff_role_ids = ids.slice(0, 10);
  }
  if (has('setup_completed')) patch.setup_completed = pickBool(body.setup_completed, false);
  if (has('log_channel_id')) patch.log_channel_id = body.log_channel_id ? String(body.log_channel_id) : null;

  const merged = { ...existing, ...patch };
  if (Number(merged.game_max_bet) < Number(merged.game_min_bet)) fail(errors, 'game_max_bet', 'max_below_min');
  if (Number(merged.max_plots) < Number(merged.start_plots)) fail(errors, 'max_plots', 'max_below_min');
  return { patch, errors };
}

export function mergeSettings(doc) {
  const d = structuredClone(E.settings);
  const merge = (base, over) => {
    for (const [k, v] of Object.entries(over || {})) {
      if (v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object') merge(base[k], v); else base[k] = v;
    }
    return base;
  };
  const merged = merge(d, doc);
  if (merged.cooldowns && Number(merged.cooldowns.game) === 8) merged.cooldowns.game = E.settings.cooldowns.game;
  return merged;
}

export function sanitizeItem(body, existing, errors) {
  const item = {};
  item.name = pickText(errors, 'name', body.name ?? existing?.name, 60);
  if (!item.name) fail(errors, 'name', 'required');
  item.description = pickText(errors, 'description', body.description ?? existing?.description ?? '', 300);
  item.emoji = pickText(errors, 'emoji', body.emoji ?? existing?.emoji ?? '📦', 40);
  item.image = pickUrl(errors, 'image', body.image ?? existing?.image ?? '', '') || null;
  item.category = pickEnum(errors, 'category', body.category ?? existing?.category, CATEGORY_KEYS, 'custom');
  item.rarity = pickEnum(errors, 'rarity', body.rarity ?? existing?.rarity, E.rarities, 'common');
  item.currency = pickEnum(errors, 'currency', body.currency ?? existing?.currency, ['coins', 'gems'], 'coins');
  item.price = pickInt(errors, 'price', body.price ?? existing?.price ?? 0, 0, 1e12, 0);
  const nullableInt = (k, min, max) => {
    const v = body[k] !== undefined ? body[k] : existing?.[k];
    return v === null || v === '' || v === undefined ? null : pickInt(errors, k, v, min, max, null);
  };
  item.stock = nullableInt('stock', 0, 1e9);
  item.max_purchase = nullableInt('max_purchase', 1, 1e6);
  item.restock_amount = nullableInt('restock_amount', 1, 1e9);
  item.restock_hours = nullableInt('restock_hours', 1, 24 * 365);
  item.cooldown = pickInt(errors, 'cooldown', body.cooldown ?? existing?.cooldown ?? 0, 0, 30 * 86400, 0);
  item.discount = pickInt(errors, 'discount', body.discount ?? existing?.discount ?? 0, 0, 95, 0);
  item.enabled = pickBool(body.enabled, existing?.enabled ?? true);
  item.featured = pickBool(body.featured, existing?.featured ?? false);
  for (const k of ['sale_ends_at', 'available_from', 'available_until']) {
    const v = body[k] !== undefined ? body[k] : existing?.[k];
    if (!v) { item[k] = null; continue; }
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) { fail(errors, k, 'invalid_date'); item[k] = null; } else item[k] = d;
  }
  if (item.available_from && item.available_until && item.available_until <= item.available_from) fail(errors, 'available_until', 'end_before_start');
  if ((item.restock_amount && !item.restock_hours) || (!item.restock_amount && item.restock_hours)) fail(errors, 'restock_amount', 'restock_pair');
  return item;
}

export async function ensureCatalog(db, gid) {
  const settings = await db.collection('economy_settings').findOne({ guild_id: gid }, { projection: { catalog_seeded: 1 } });
  if (settings?.catalog_seeded) return;
  const now = new Date();
  const docs = E.items.map((i) => ({ ...structuredClone(i), guild_id: gid, created_at: now, updated_at: now }));
  try { await db.collection('economy_items').insertMany(docs, { ordered: false }); } catch { }
  await db.collection('economy_settings').updateOne(
    { guild_id: gid }, { $set: { catalog_seeded: true }, $setOnInsert: { guild_id: gid, created_at: now } }, { upsert: true },
  );
}

export async function auditLog(db, gid, action, actorId, { detail = '', amount = null, targetId = null, toLong }) {
  try {
    await db.collection('economy_logs').insertOne({
      guild_id: gid, action, actor_id: actorId ? toLong(actorId) : null, target_id: targetId ? toLong(targetId) : null,
      amount, detail: String(detail).slice(0, 500), meta: { source: 'dashboard' }, created_at: new Date(),
    });
  } catch (e) { console.error('economy audit failed', e); }
}

const USER_COLLECTIONS = ['economy_users', 'economy_inventory', 'economy_pets', 'economy_businesses', 'economy_quest_progress',
  'economy_achievements', 'economy_collection', 'economy_purchases', 'economy_event_participants'];

export async function resetScope(db, gid, scope, h) {
  if (scope === 'economy') {
    for (const name of [...USER_COLLECTIONS, 'economy_transactions', 'economy_market_listings', 'economy_trades']) await db.collection(name).deleteMany({ guild_id: gid });
    await db.collection('blackjack_stats').deleteMany({ guild_id: gid });
    await db.collection('blackjack_history').deleteMany({ guild_id: gid });
    await db.collection('blackjack_wallets').deleteMany({ guild_id: gid });
  } else if (scope === 'shop') {
    await db.collection('economy_items').deleteMany({ guild_id: gid });
    await db.collection('economy_purchases').deleteMany({ guild_id: gid });
    await db.collection('economy_settings').updateOne({ guild_id: gid }, { $set: { catalog_seeded: false } });
    await ensureCatalog(db, gid);
  } else if (scope === 'market') {
    const listings = await db.collection('economy_market_listings').find({ guild_id: gid, status: 'active' }).toArray();
    for (const l of listings) {
      const res = await db.collection('economy_market_listings').updateOne({ _id: l._id, status: 'active' }, { $set: { status: 'cancelled' } });
      if (!res.modifiedCount) continue;
      await db.collection('economy_inventory').updateOne(
        { guild_id: gid, user_id: l.seller_id, item_id: l.item_id },
        { $inc: { quantity: Number(l.quantity), book_value: Number(l.book_value || 0) }, $setOnInsert: { favorite: false, acquired_at: new Date() } },
        { upsert: true },
      );
      await db.collection('economy_users').updateOne({ guild_id: gid, user_id: l.seller_id }, { $inc: { assets_value: Number(l.book_value || 0) } });
    }
    await db.collection('economy_market_listings').deleteMany({ guild_id: gid });
    await db.collection('economy_market_prices').deleteMany({ guild_id: gid });
  } else if (scope === 'leaderboard') {
    await db.collection('economy_users').updateMany({ guild_id: gid }, { $set: { stats: {} } });
    await db.collection('blackjack_stats').deleteMany({ guild_id: gid });
  }
}

export async function economyGet(ctx) {
  const { sub, url, db, gidLong, h, premium } = ctx;
  if (sub === 'economy') {
    if (!premium) return json({ premium: false });
    const doc = await db.collection('economy_settings').findOne({ guild_id: gidLong }) || {};
    const settings = mergeSettings(h.serializeDoc(doc));
    for (const k of ['catalog_seeded', '_id', 'created_at', 'updated_at', 'guild_id']) delete settings[k];
    const [users, listings] = await Promise.all([
      db.collection('economy_users').countDocuments({ guild_id: gidLong }),
      db.collection('economy_market_listings').countDocuments({ guild_id: gidLong, status: 'active' }),
    ]);
    const agg = await db.collection('economy_users').aggregate([
      { $match: { guild_id: gidLong } }, { $group: { _id: null, net: { $sum: '$net_worth' }, gems: { $sum: '$gems' } } },
    ]).toArray();
    return json({ premium: true, can_admin: isOwnerOrAdmin(ctx.guild), settings, defaults: E.settings, summary: { members: users, listings, net_worth: agg[0]?.net || 0, gems: agg[0]?.gems || 0 },
      reference: { jobs: E.jobs, businesses: E.businesses, commodities: E.commodities, events: E.events, features: E.features, cooldowns: E.cooldown_keys,
        bounds: E.bounds, categories: E.shop_categories, rarities: E.rarities } });
  }
  if (!premium) return json({ premium: false });
  if (sub === 'economy/items') {
    await ensureCatalog(db, gidLong);
    const rows = await db.collection('economy_items').find({ guild_id: gidLong }).sort({ category: 1, price: 1 }).limit(MAX_ITEMS + 50).toArray();
    return json({ premium: true, items: rows.map(h.serializeDoc), max: MAX_ITEMS });
  }
  if (sub === 'economy/logs') {
    const page = clampPage(url.searchParams.get('page'));
    const kind = url.searchParams.get('kind') === 'transactions' ? 'economy_transactions' : 'economy_logs';
    const total = await db.collection(kind).countDocuments({ guild_id: gidLong });
    const rows = await db.collection(kind).find({ guild_id: gidLong }).sort({ created_at: -1 }).skip(page * 20).limit(20).toArray();
    const linked = (v) => { const m = /^(?:user|staff):(\d{15,25})$/.exec(String(v || '')); return m ? m[1] : null; };
    const ids = [...new Set(rows.flatMap((r) => [r.actor_id, r.target_id, r.user_id, linked(r.source), linked(r.destination)]).filter(Boolean).map(String))];
    const names = await h.getGuildMembersProfileMap(ctx.guildId, ids.slice(0, 40));
    return json({ premium: true, kind, total, page, rows: rows.map(h.serializeDoc),
      names: Object.fromEntries([...names].map(([id, p]) => [id, p.name])) });
  }
  if (sub === 'economy/events') {
    const now = new Date();
    const rows = await db.collection('economy_events').find({ guild_id: gidLong }).sort({ starts_at: -1 }).limit(30).toArray();
    return json({ premium: true, events: rows.map((r) => ({ ...h.serializeDoc(r), running: r.active && r.ends_at > now && r.starts_at <= now })) });
  }
  return null;
}

export function isOwnerOrAdmin(guild) {
  if (!guild) return false;
  if (guild.owner) return true;
  try { return (BigInt(guild.permissions || 0) & 8n) === 8n; } catch { return false; }
}

export async function economyMutate(ctx) {
  const { sub, method, body, db, gidLong, h, session, premium } = ctx;
  const actor = session?.user?.id;
  if (!premium) return premiumRequired();
  const audit = (action, detail, extra = {}) => auditLog(db, gidLong, action, actor, { detail, toLong: h.toLong, ...extra });

  if (sub === 'economy' && (method === 'PUT' || method === 'PATCH')) {
    const doc = await db.collection('economy_settings').findOne({ guild_id: gidLong }) || {};
    const existing = mergeSettings(h.serializeDoc(doc));
    const { patch, errors } = sanitizeSettings(body, existing);
    if (patch.staff_role_ids && !isOwnerOrAdmin(ctx.guild)) {
      const before = [...(existing.staff_role_ids || [])].map(String).sort().join(',');
      const after = [...patch.staff_role_ids].map(String).sort().join(',');
      if (before !== after) return json({ error: 'admin_required', message: 'Only the server owner or an Administrator can choose economy staff roles.' }, { status: 403 });
      delete patch.staff_role_ids;
    }
    if (patch.log_channel_id && !(await h.assertChannelInGuild(ctx.guildId, patch.log_channel_id))) fail(errors, 'log_channel_id', 'invalid_channel');
    if (patch.staff_role_ids) {
      for (const id of patch.staff_role_ids) if (!(await h.assertRoleInGuild(ctx.guildId, id))) { fail(errors, 'staff_role_ids', 'invalid_role'); break; }
    }
    if (errors.length) return validationError(errors);
    const store = h.deserializeInput(patch);
    await db.collection('economy_settings').updateOne(
      { guild_id: gidLong }, { $set: { ...store, updated_at: new Date() }, $setOnInsert: { guild_id: gidLong, created_at: new Date() } }, { upsert: true },
    );
    await audit('admin_modification', `Economy settings changed: ${Object.keys(patch).join(', ')}`);
    return json({ ok: true, settings: mergeSettings({ ...h.serializeDoc(doc), ...patch }) });
  }

  if (sub === 'economy/items' && method === 'POST') {
    await ensureCatalog(db, gidLong);
    const count = await db.collection('economy_items').countDocuments({ guild_id: gidLong });
    if (count >= MAX_ITEMS) return json({ error: 'limit_reached', max: MAX_ITEMS }, { status: 400 });
    const errors = [];
    const id = String(body.item_id || cleanText(body.name, 40).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')).slice(0, 40);
    if (!/^[a-z0-9_]{2,40}$/.test(id)) fail(errors, 'item_id', 'invalid_id');
    const item = sanitizeItem(body, null, errors);
    if (errors.length) return validationError(errors);
    if (await db.collection('economy_items').findOne({ guild_id: gidLong, item_id: id })) return validationError([{ field: 'item_id', code: 'duplicate_id' }]);
    const now = new Date();
    try {
      await db.collection('economy_items').insertOne({ ...item, item_id: id, guild_id: gidLong, meta: { type: 'collectible' }, created_at: now, updated_at: now });
    } catch (e) {
      if (e?.code === 11000) return validationError([{ field: 'item_id', code: 'duplicate_id' }]);
      throw e;
    }
    await audit('shop_modification', `Created item ${item.name} (${id})`);
    return json({ ok: true, item_id: id });
  }

  const itemMatch = sub.match(/^economy\/items\/([a-z0-9_:]{2,60})$/);
  if (itemMatch) {
    const itemId = itemMatch[1];
    const existing = await db.collection('economy_items').findOne({ guild_id: gidLong, item_id: itemId });
    if (!existing) return notFound();
    if (method === 'PUT' || method === 'PATCH') {
      const errors = [];
      const item = sanitizeItem(body, existing, errors);
      if (errors.length) return validationError(errors);
      await db.collection('economy_items').updateOne({ _id: existing._id }, { $set: { ...item, updated_at: new Date() } });
      await audit('shop_modification', `Edited item ${item.name} (${itemId})`);
      return json({ ok: true });
    }
    if (method === 'DELETE') {
      await db.collection('economy_items').deleteOne({ _id: existing._id });
      await audit('shop_modification', `Deleted item ${existing.name} (${itemId})`);
      return json({ ok: true });
    }
  }

  if (sub === 'economy/events' && method === 'POST') {
    const type = String(body.type || '');
    if (!EVENT_KEYS.includes(type)) return validationError([{ field: 'type', code: 'invalid_choice' }]);
    const errors = [];
    const hours = pickNumber(errors, 'hours', body.hours, 0.25, 24 * 30, 24);
    const multiplier = pickNumber(errors, 'multiplier', body.multiplier, 1, 10, 2);
    const goal = type === 'community_goal' ? pickInt(errors, 'goal_target', body.goal_target, 1000, 1e12, 1_000_000) : null;
    if (errors.length) return validationError(errors);
    const now = new Date();
    const running = await db.collection('economy_events').countDocuments({ guild_id: gidLong, type, active: true, ends_at: { $gt: now } });
    if (running) return json({ error: 'event_running' }, { status: 409 });
    const doc = { guild_id: gidLong, type, active: true, starts_at: now, ends_at: new Date(now.getTime() + hours * 3600_000), multiplier,
      created_by: h.toLong(actor), created_at: now };
    if (goal) Object.assign(doc, { goal_target: goal, goal_progress: 0, goal_reward: { money: 25000, gems: 10 } });
    await db.collection('economy_events').insertOne(doc);
    await audit('event_started', `${E.events[type].name} for ${hours} hours`);
    return json({ ok: true });
  }
  const evMatch = sub.match(/^economy\/events\/([a-f0-9]{24})$/);
  if (evMatch && method === 'DELETE') {
    const res = await db.collection('economy_events').findOneAndUpdate(
      { _id: new ObjectId(evMatch[1]), guild_id: gidLong, active: true }, { $set: { active: false, ends_at: new Date() } },
    );
    if (!res) return notFound();
    await audit('event_stopped', 'Event stopped from the dashboard');
    return json({ ok: true });
  }

  if ((sub === 'economy/reset' || sub === 'economy/reset-user') && method === 'POST' && !isOwnerOrAdmin(ctx.guild)) {
    return json({ error: 'admin_required', message: 'Only the server owner or an Administrator can reset economy data.' }, { status: 403 });
  }

  if (sub === 'economy/reset' && method === 'POST') {
    const scope = String(body.scope || '');
    if (!RESET_SCOPES.includes(scope)) return validationError([{ field: 'scope', code: 'invalid_choice' }]);
    if (body.confirm !== scope) return validationError([{ field: 'confirm', code: 'confirm_mismatch' }]);
    await resetScope(db, gidLong, scope, h);
    await audit('economy_reset', `Reset: ${scope}`);
    return json({ ok: true });
  }
  if (sub === 'economy/reset-user' && method === 'POST') {
    const uid = String(body.user_id || '');
    if (!/^\d{15,25}$/.test(uid)) return validationError([{ field: 'user_id', code: 'invalid_id' }]);
    if (body.confirm !== 'RESET') return validationError([{ field: 'confirm', code: 'confirm_mismatch' }]);
    const user = h.toLong(uid);
    await db.collection('economy_market_listings').updateMany({ guild_id: gidLong, seller_id: user, status: 'active' }, { $set: { status: 'cancelled' } });
    await db.collection('economy_trades').updateMany({ guild_id: gidLong, status: { $in: ['open', 'locked'] }, $or: [{ a_id: user }, { b_id: user }] }, { $set: { status: 'cancelled', closed_at: new Date() } });
    for (const name of [...USER_COLLECTIONS, 'blackjack_stats', 'blackjack_wallets']) await db.collection(name).deleteMany({ guild_id: gidLong, user_id: user });
    await audit('economy_reset', 'Reset one member', { targetId: uid });
    return json({ ok: true });
  }
  return null;
}
