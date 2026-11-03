import { requestBot } from '@/lib/bridge';
import { STAT_RANGES, buildStatistics, statWindow } from '@/lib/invite-stats';
import { json, validationError, clampPage } from '@/lib/modules/http';
import { fail, pickBool, pickEnum, pickInt, pickText, checkVariables } from '@/lib/modules/validate';

export const WELCOME_VARIABLES = ['inviter', 'inviter.mention', 'inviter.name', 'inviter.id', 'inviter.invites', 'invite.code'];
export const NOTIFY_VARIABLES = ['user.mention', 'user.name', 'user.id', 'guild.name', 'member_count', ...WELCOME_VARIABLES];
export const VISIBILITY = ['everyone', 'staff'];
export const PERIODS = ['all', 'month', 'week', 'custom'];
const PER_PAGE = 10;
const RECENT_PER_PAGE = 12;

export const INVITE_DEFAULTS = {
  log_enabled: false,
  log_channel_id: null,
  notify_enabled: false,
  notify_channel_id: null,
  notify_message: '{user.mention} joined using an invite from {inviter.name} ({inviter.invites} invites).',
  notify_unknown_message: '{user.mention} joined. The invite could not be identified.',
  stats_visibility: 'everyone',
  min_account_age_days: 0,
};

export function mergeInviteSettings(doc) {
  const out = { ...INVITE_DEFAULTS };
  for (const k of Object.keys(INVITE_DEFAULTS)) if (doc && doc[k] !== undefined && doc[k] !== null) out[k] = doc[k];
  if (!VISIBILITY.includes(out.stats_visibility)) out.stats_visibility = 'everyone';
  out.min_account_age_days = Math.max(0, Math.min(365, Number.parseInt(out.min_account_age_days, 10) || 0));
  return out;
}

export function sanitizeInviteSettings(body, existing) {
  const errors = [];
  const patch = {};
  const has = (k) => body[k] !== undefined;
  for (const k of ['log_enabled', 'notify_enabled']) if (has(k)) patch[k] = pickBool(body[k], existing[k]);
  for (const k of ['log_channel_id', 'notify_channel_id']) {
    if (has(k)) {
      if (body[k] && !/^\d{15,25}$/.test(String(body[k]))) fail(errors, k, 'invalid_channel');
      else patch[k] = body[k] ? String(body[k]) : null;
    }
  }
  if (has('notify_message')) patch.notify_message = pickText(errors, 'notify_message', body.notify_message, 500);
  if (has('notify_unknown_message')) patch.notify_unknown_message = pickText(errors, 'notify_unknown_message', body.notify_unknown_message, 500);
  if (has('stats_visibility')) patch.stats_visibility = pickEnum(errors, 'stats_visibility', body.stats_visibility, VISIBILITY, existing.stats_visibility);
  if (has('min_account_age_days')) patch.min_account_age_days = pickInt(errors, 'min_account_age_days', body.min_account_age_days, 0, 365, existing.min_account_age_days);
  const merged = { ...existing, ...patch };
  for (const k of ['notify_message', 'notify_unknown_message']) if (has(k)) checkVariables(errors, k, merged[k], NOTIFY_VARIABLES);
  if (merged.log_enabled && !merged.log_channel_id) fail(errors, 'log_channel_id', 'required');
  if (merged.notify_enabled && !merged.notify_channel_id) fail(errors, 'notify_channel_id', 'required');
  if (merged.notify_enabled && !String(merged.notify_message || '').trim()) fail(errors, 'notify_message', 'required');
  return { patch, errors };
}

export function periodRange(period, from, to, now = new Date()) {
  const day = (d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  if (period === 'month') return { start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)), end: null };
  if (period === 'week') {
    const d = day(now);
    const back = (d.getUTCDay() + 6) % 7;
    return { start: new Date(d.getTime() - back * 86400000), end: null };
  }
  if (period === 'custom') return { start: parseDay(from), end: parseDay(to, 1) };
  return { start: null, end: null };
}

export function parseDay(text, plusDays = 0) {
  if (!text || !/^\d{4}-\d{2}-\d{2}$/.test(String(text))) return null;
  const d = new Date(`${text}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== text) return null;
  return new Date(d.getTime() + plusDays * 86400000);
}

function matchStage(gidLong, start, end) {
  const m = { guild_id: gidLong, counted: true };
  if (start || end) m.joined_at = { ...(start ? { $gte: start } : {}), ...(end ? { $lt: end } : {}) };
  return m;
}

const GROUP = {
  $group: {
    _id: '$inviter_id',
    total: { $sum: 1 },
    fake: { $sum: { $cond: [{ $eq: ['$fake', true] }, 1, 0] } },
    left: { $sum: { $cond: [{ $eq: ['$left', true] }, 1, 0] } },
    retained: { $sum: { $cond: [{ $and: [{ $ne: ['$fake', true] }, { $ne: ['$left', true] }] }, 1, 0] } },
  },
};

const pub = (r) => ({ total: r.total, fake: r.fake, valid: r.total - r.fake, left: r.left, retained: r.retained });

function profileOf(map, id) {
  const p = id ? map.get(String(id)) : null;
  return { name: p?.name || null, avatar_url: p?.avatar_url || null, left_server: p?.state === 'left' };
}

export async function invitesGet(ctx) {
  const { sub, url, db, gidLong, guildId, h } = ctx;
  if (sub === 'invites/statistics') return invitesStatistics(ctx);
  if (sub === 'invites') {
    const doc = await db.collection('invite_settings').findOne({ guild_id: gidLong }) || {};
    const settings = mergeInviteSettings(h.serializeDoc(doc));
    const gs = await db.collection('guild_settings').findOne({ guild_id: gidLong }, { projection: { 'module_states.invite_tracking': 1 } });
    const since = new Date(Date.now() - 30 * 86400000);
    const J = db.collection('invite_joins');
    const [joins, attributed, unknown, vanity, left, joins30, codes, reasons] = await Promise.all([
      J.countDocuments({ guild_id: gidLong }),
      J.countDocuments({ guild_id: gidLong, counted: true }),
      J.countDocuments({ guild_id: gidLong, inviter_id: null, counted: false, source: { $ne: 'vanity' } }),
      J.countDocuments({ guild_id: gidLong, source: 'vanity' }),
      J.countDocuments({ guild_id: gidLong, counted: true, left: true }),
      J.countDocuments({ guild_id: gidLong, joined_at: { $gte: since } }),
      db.collection('invite_codes').countDocuments({ guild_id: gidLong, deleted: { $ne: true } }),
      J.aggregate([{ $match: { guild_id: gidLong, inviter_id: null, counted: false, source: { $ne: 'vanity' } } }, { $group: { _id: '$reason', n: { $sum: 1 } } }]).toArray(),
    ]);
    const codeRows = await db.collection('invite_codes').find({ guild_id: gidLong, deleted: { $ne: true } }, { projection: { code: 1, uses: 1, discord_uses: 1 } }).toArray();
    const seen = await J.aggregate([{ $match: { guild_id: gidLong, code: { $in: codeRows.map((r) => r.code) } } }, { $group: { _id: '$code', n: { $sum: 1 } } }]).toArray();
    const seenBy = new Map(seen.map((r) => [r._id, r.n]));
    let discordUses = 0;
    let beforeTracking = 0;
    for (const r of codeRows) {
      const u = Number(r.discord_uses ?? r.uses) || 0;
      discordUses += u;
      beforeTracking += Math.max(0, u - (seenBy.get(r.code) || 0));
    }
    return json({
      enabled: gs?.module_states?.invite_tracking === true,
      settings, defaults: INVITE_DEFAULTS,
      baseline: Boolean(doc.baseline_at),
      totals: { joins, attributed, unknown, vanity, left, joins_30d: joins30, codes, discord_uses: discordUses, before_tracking: beforeTracking },
      unknown_reasons: reasons.reduce((acc, r) => { const k = r._id || 'no_match'; acc[k] = (acc[k] || 0) + r.n; return acc; }, {}),
      welcome_variables: WELCOME_VARIABLES, notify_variables: NOTIFY_VARIABLES,
    });
  }
  if (sub === 'invites/leaderboard') {
    const period = PERIODS.includes(url.searchParams.get('period')) ? url.searchParams.get('period') : 'all';
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    if (period === 'custom' && ((from && !parseDay(from)) || (to && !parseDay(to)))) return validationError([{ field: 'from', code: 'invalid_date' }]);
    const { start, end } = periodRange(period, from, to);
    if (start && end && start >= end) return validationError([{ field: 'to', code: 'invalid_range' }]);
    const page = clampPage(url.searchParams.get('page'));
    const [out] = await db.collection('invite_joins').aggregate([
      { $match: matchStage(gidLong, start, end) }, GROUP,
      { $addFields: { valid: { $subtract: ['$total', '$fake'] } } },
      { $sort: { valid: -1, total: -1, _id: 1 } },
      { $facet: { rows: [{ $skip: page * PER_PAGE }, { $limit: PER_PAGE }], count: [{ $count: 'n' }] } },
    ]).toArray();
    const rows = out?.rows || [];
    const total = out?.count?.[0]?.n || 0;
    const profiles = await h.getGuildMembersProfileMap(guildId, rows.map((r) => String(r._id)));
    return json({
      period, total, page, per_page: PER_PAGE,
      rows: rows.map((r, i) => ({ rank: page * PER_PAGE + i + 1, user_id: String(r._id), ...profileOf(profiles, r._id), ...pub(r) })),
    });
  }
  if (sub === 'invites/recent') {
    const page = clampPage(url.searchParams.get('page'));
    const flt = { guild_id: gidLong };
    const [total, rows] = await Promise.all([
      db.collection('invite_joins').countDocuments(flt),
      db.collection('invite_joins').find(flt).sort({ joined_at: -1 }).skip(page * RECENT_PER_PAGE).limit(RECENT_PER_PAGE).toArray(),
    ]);
    const ids = [...rows.map((r) => String(r.user_id)), ...rows.filter((r) => r.inviter_id).map((r) => String(r.inviter_id))];
    const profiles = await h.getGuildMembersProfileMap(guildId, ids);
    return json({
      total, page, per_page: RECENT_PER_PAGE,
      rows: rows.map((r) => ({
        user_id: String(r.user_id), ...profileOf(profiles, r.user_id),
        inviter_id: r.inviter_id ? String(r.inviter_id) : null, inviter_name: r.inviter_id ? profileOf(profiles, r.inviter_id).name : null,
        code: r.code || null, kind: r.kind || null, source: r.source || 'unknown', confidence: r.confidence || 'none', reason: r.reason || null,
        fake: Boolean(r.fake), left: Boolean(r.left), counted: Boolean(r.counted), joined_at: r.joined_at,
      })),
    });
  }
  if (sub === 'invites/codes') {
    const rows = await db.collection('invite_codes').find({ guild_id: gidLong, deleted: { $ne: true } }).sort({ discord_uses: -1, uses: -1 }).limit(50).toArray();
    const profiles = await h.getGuildMembersProfileMap(guildId, rows.filter((r) => r.inviter_id).map((r) => String(r.inviter_id)));
    const seen = await db.collection('invite_joins').aggregate([
      { $match: { guild_id: gidLong, code: { $in: rows.map((r) => r.code) } } },
      { $group: { _id: '$code', n: { $sum: 1 }, left: { $sum: { $cond: [{ $eq: ['$left', true] }, 1, 0] } } } },
    ]).toArray();
    const seenBy = new Map(seen.map((r) => [r._id, r]));
    return json({
      rows: rows.map((r) => ({
        code: r.code, uses: Number(r.discord_uses ?? r.uses) || 0,
        tracked: seenBy.get(r.code)?.n || 0, tracked_left: seenBy.get(r.code)?.left || 0,
        before: Math.max(0, (Number(r.discord_uses ?? r.uses) || 0) - (seenBy.get(r.code)?.n || 0)), max_uses: r.max_uses || 0, max_age: r.max_age || 0, temporary: Boolean(r.temporary),
        inviter_id: r.inviter_id ? String(r.inviter_id) : null, inviter_name: r.inviter_id ? profileOf(profiles, r.inviter_id).name : null, created_at: r.created_at || null,
      })),
    });
  }
  return null;
}

export async function invitesMutate(ctx) {
  const { sub, method, body, db, gidLong, guildId, h, session } = ctx;
  if (sub === 'invites' && (method === 'PUT' || method === 'PATCH')) {
    const doc = await db.collection('invite_settings').findOne({ guild_id: gidLong }) || {};
    const existing = mergeInviteSettings(h.serializeDoc(doc));
    const { patch, errors } = sanitizeInviteSettings(body || {}, existing);
    for (const k of ['log_channel_id', 'notify_channel_id']) {
      if (patch[k] && !(await h.assertTextChannelInGuild(guildId, patch[k]))) fail(errors, k, 'invalid_channel');
    }
    if (errors.length) return validationError(errors);
    const store = h.deserializeInput(patch);
    await db.collection('invite_settings').updateOne(
      { guild_id: gidLong }, { $set: { ...store, updated_at: new Date() }, $setOnInsert: { guild_id: gidLong, created_at: new Date() } }, { upsert: true },
    );
    await db.collection('settings_audit').insertOne({
      guild_id: gidLong, collection: 'invite_settings', user_id: h.toLong(session?.user?.id),
      diff: Object.fromEntries(Object.keys(patch).map((k) => [k, { from: existing[k] ?? null, to: patch[k] }])), created_at: new Date(),
    }).catch(() => {});
    return json({ ok: true, settings: { ...existing, ...patch } });
  }
  if (sub === 'invites/reset' && method === 'POST') {
    if (body?.confirm !== true) return validationError([{ field: 'confirm', code: 'required' }]);
    const uid = body?.user_id ? String(body.user_id) : null;
    if (uid && !/^\d{15,25}$/.test(uid)) return validationError([{ field: 'user_id', code: 'invalid_id' }]);
    const flt = { guild_id: gidLong, ...(uid ? { inviter_id: h.toLong(uid) } : {}) };
    const res = await db.collection('invite_joins').deleteMany(flt);
    await db.collection('settings_audit').insertOne({
      guild_id: gidLong, collection: 'invite_joins', user_id: h.toLong(session?.user?.id),
      diff: { reset: { from: res.deletedCount, to: 0 }, ...(uid ? { inviter_id: { from: uid, to: null } } : {}) }, created_at: new Date(),
    }).catch(() => {});
    return json({ ok: true, deleted: res.deletedCount });
  }
  if (sub === 'invites/resync' && method === 'POST') {
    const result = await requestBot({ kind: 'invite_resync', guildId, userId: session.user.id });
    return json(result, { status: result.error ? (result.error === 'rate_limited' ? 429 : 502) : 200 });
  }
  return null;
}

export async function invitesStatistics(ctx) {
  const { url, db, gidLong, h } = ctx;
  const days = STAT_RANGES.includes(Number(url.searchParams.get('days'))) ? Number(url.searchParams.get('days')) : 30;
  const { start, end } = statWindow(days);
  const docs = await db.collection('invite_joins').find(
    { guild_id: gidLong, $or: [{ joined_at: { $gte: start, $lt: end } }, { left_at: { $gte: start, $lt: end } }] },
    { projection: { user_id: 1, joined_at: 1, left: 1, left_at: 1, inviter_id: 1, code: 1, source: 1, fake: 1, counted: 1, account_created_at: 1 } },
  ).limit(60000).toArray();
  const stats = buildStatistics(docs, days);
  const ids = stats.inviters.map(([id]) => id);
  const profiles = ids.length ? await h.getGuildMembersProfileMap(ctx.guildId, ids) : new Map();
  return json({
    ...stats,
    inviters: stats.inviters.map(([id, n]) => ({ id, joins: n, ...profileOf(profiles, id) })),
    codes: stats.codes.map(([code, n]) => ({ code, joins: n })),
    sources: Object.fromEntries(stats.sources), ages: Object.fromEntries(stats.ages),
  });
}
