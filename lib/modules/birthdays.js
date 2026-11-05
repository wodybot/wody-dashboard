import DEFAULTS from '@/lib/economy-defaults.json';
import { requestBot } from '@/lib/bridge';
import { json, validationError, notFound, clampPage } from '@/lib/modules/http';
import {
  fail, pickBool, pickInt, pickEnum, pickColor, pickUrl, pickText, pickButtons, checkVariables, validTimezone,
} from '@/lib/modules/validate';

const D = DEFAULTS.birthday.settings;
export const BIRTHDAY_VARIABLES = ['user', 'username', 'displayname', 'server', 'birthday', 'day', 'month', 'age'];
export const REMINDER_VARIABLES = [...BIRTHDAY_VARIABLES, 'days', 'when'];
const PRIVACY = ['public', 'community', 'private'];
const MENTION = ['member', 'role', 'none'];
const DURATIONS = ['day', '24', '48', 'custom'];
const THUMB = ['avatar', 'server', 'none'];
const SIZES = ['narrow', 'medium', 'large'];
const LANGS = ['server', 'en', 'ro', 'fr', 'it', 'de', 'es', 'pt', 'nl', 'tr'];

export function mergeBirthdaySettings(doc) {
  const out = structuredClone(D);
  for (const [k, v] of Object.entries(doc || {})) if (k in D) out[k] = v;
  return out;
}

export function sanitizeBirthdaySettings(body, existing) {
  const errors = [];
  const patch = {};
  const has = (k) => body[k] !== undefined;
  const bool = (k) => { if (has(k)) patch[k] = pickBool(body[k], existing[k]); };
  ['setup_completed', 'announce_enabled', 'use_embed', 'msg_timestamp', 'card_enabled', 'card_avatar_ring', 'show_age', 'dm_private',
    'reminder_enabled', 'board_enabled'].forEach(bool);
  for (const k of ['channel_id', 'mention_role_id', 'role_id', 'reminder_channel_id', 'reminder_role_id', 'board_channel_id']) {
    if (has(k)) patch[k] = body[k] ? String(body[k]) : null;
  }
  if (has('mention_mode')) patch.mention_mode = pickEnum(errors, 'mention_mode', body.mention_mode, MENTION, existing.mention_mode);
  if (has('role_duration')) patch.role_duration = pickEnum(errors, 'role_duration', body.role_duration, DURATIONS, existing.role_duration);
  if (has('role_hours')) patch.role_hours = pickInt(errors, 'role_hours', body.role_hours, 1, 168, existing.role_hours);
  if (has('msg_title')) patch.msg_title = pickText(errors, 'msg_title', body.msg_title, 256);
  if (has('msg_description')) patch.msg_description = pickText(errors, 'msg_description', body.msg_description, 1800);
  if (has('msg_footer')) patch.msg_footer = pickText(errors, 'msg_footer', body.msg_footer, 200);
  if (has('msg_color')) patch.msg_color = pickColor(errors, 'msg_color', body.msg_color, existing.msg_color);
  if (has('msg_thumbnail')) patch.msg_thumbnail = pickEnum(errors, 'msg_thumbnail', body.msg_thumbnail, THUMB, existing.msg_thumbnail);
  if (has('msg_image_url')) patch.msg_image_url = pickUrl(errors, 'msg_image_url', body.msg_image_url, '');
  if (has('msg_buttons')) patch.msg_buttons = pickButtons(errors, 'msg_buttons', body.msg_buttons, 2);
  if (has('card_template')) patch.card_template = pickText(errors, 'card_template', body.card_template, 20, existing.card_template);
  if (has('card_background_url')) patch.card_background_url = pickUrl(errors, 'card_background_url', body.card_background_url, '');
  for (const k of ['card_overlay_color', 'card_text_color', 'card_color']) if (has(k)) patch[k] = pickColor(errors, k, body[k], existing[k]);
  if (has('card_overlay_opacity')) patch.card_overlay_opacity = pickInt(errors, 'card_overlay_opacity', body.card_overlay_opacity, 0, 100, existing.card_overlay_opacity);
  if (has('card_size')) patch.card_size = pickEnum(errors, 'card_size', body.card_size, SIZES, existing.card_size);
  if (has('card_avatar_mode')) patch.card_avatar_mode = pickEnum(errors, 'card_avatar_mode', body.card_avatar_mode, ['member', 'server', 'none'], existing.card_avatar_mode);
  for (const [k, max] of [['card_title', 120], ['card_message', 240], ['card_footer', 140]]) if (has(k)) patch[k] = pickText(errors, k, body[k], max);
  if (has('privacy_default')) patch.privacy_default = pickEnum(errors, 'privacy_default', body.privacy_default, PRIVACY, existing.privacy_default);
  if (has('leap_policy')) patch.leap_policy = pickEnum(errors, 'leap_policy', body.leap_policy, ['feb28', 'mar1'], existing.leap_policy);
  if (has('timezone')) {
    if (!validTimezone(body.timezone)) fail(errors, 'timezone', 'invalid_timezone'); else patch.timezone = body.timezone;
  }
  if (has('reminder_days')) {
    const days = Array.isArray(body.reminder_days) ? [...new Set(body.reminder_days.map(Number))].filter((d) => [1, 2, 3, 7].includes(d)).sort((a, b) => a - b) : [];
    patch.reminder_days = days;
  }
  if (has('reminder_message')) patch.reminder_message = pickText(errors, 'reminder_message', body.reminder_message, 400);
  if (has('board_upcoming')) patch.board_upcoming = pickInt(errors, 'board_upcoming', body.board_upcoming, 1, 10, existing.board_upcoming);

  const merged = { ...existing, ...patch };
  for (const k of ['msg_title', 'msg_description', 'msg_footer', 'card_title', 'card_message', 'card_footer']) {
    if (has(k)) checkVariables(errors, k, merged[k], BIRTHDAY_VARIABLES);
  }
  if (has('reminder_message')) checkVariables(errors, 'reminder_message', merged.reminder_message, REMINDER_VARIABLES);
  if (!merged.use_embed && !merged.msg_description && has('use_embed')) { }
  if (merged.reminder_enabled && !(merged.reminder_days || []).length) fail(errors, 'reminder_days', 'required');
  if (merged.reminder_enabled && !merged.reminder_channel_id) fail(errors, 'reminder_channel_id', 'required');
  if (merged.board_enabled && !merged.board_channel_id) fail(errors, 'board_channel_id', 'required');
  if (merged.announce_enabled && merged.setup_completed && !merged.channel_id) fail(errors, 'channel_id', 'required');
  return { patch, errors };
}

export function validateBirthdayInput(body) {
  const errors = [];
  const day = Number(body.day);
  const month = Number(body.month);
  const yearRaw = body.year;
  if (!Number.isInteger(month) || month < 1 || month > 12) fail(errors, 'month', 'invalid_month');
  const maxDay = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][(month || 1) - 1];
  if (!Number.isInteger(day) || day < 1 || day > maxDay) fail(errors, 'day', 'invalid_day');
  let year = null;
  if (yearRaw !== undefined && yearRaw !== null && yearRaw !== '') {
    year = Number(yearRaw);
    if (!Number.isInteger(year) || year < 1900 || year > new Date().getUTCFullYear()) fail(errors, 'year', 'invalid_year');
    else if (month === 2 && day === 29 && !(year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0))) fail(errors, 'year', 'leap_year_invalid');
  }
  const privacy = body.privacy === undefined ? undefined : pickEnum(errors, 'privacy', body.privacy, PRIVACY, 'community');
  let timezone;
  if (body.timezone !== undefined) {
    if (!body.timezone) timezone = null; else if (!validTimezone(body.timezone)) fail(errors, 'timezone', 'invalid_timezone'); else timezone = body.timezone;
  }
  return { errors, value: { day, month, year, privacy, timezone } };
}

export async function birthdaysGet(ctx) {
  const { sub, url, db, gidLong, guildId, h } = ctx;
  if (sub === 'birthdays') {
    const doc = await db.collection('birthday_settings').findOne({ guild_id: gidLong }) || {};
    const settings = mergeBirthdaySettings(h.serializeDoc(doc));
    const [count, gs] = await Promise.all([
      db.collection('birthdays').countDocuments({ guild_id: gidLong }),
      db.collection('guild_settings').findOne({ guild_id: gidLong }, { projection: { language: 1, language_explicit: 1 } }),
    ]);
    return json({ settings, defaults: D, members: count, server_language: gs?.language_explicit ? gs.language : 'en',
      variables: BIRTHDAY_VARIABLES, reminder_variables: REMINDER_VARIABLES });
  }
  if (sub === 'birthdays/members') {
    const q = (url.searchParams.get('q') || '').trim();
    const page = clampPage(url.searchParams.get('page'));
    const flt = { guild_id: gidLong };
    if (q) {
      const found = await h.searchGuildMembers(guildId, q, 25);
      flt.user_id = { $in: found.map((m) => h.toLong(m.id)) };
    }
    const [total, rows] = await Promise.all([
      db.collection('birthdays').countDocuments(flt),
      db.collection('birthdays').find(flt).sort({ month: 1, day: 1, user_id: 1 }).skip(page * 15).limit(15).toArray(),
    ]);
    const ids = rows.map((r) => String(r.user_id));
    const [profiles, runs] = await Promise.all([
      h.getGuildMembersProfileMap(guildId, ids),
      db.collection('birthday_runs').find({ guild_id: gidLong, user_id: { $in: rows.map((r) => r.user_id) } }).sort({ year: -1 }).toArray(),
    ]);
    const lastRun = new Map();
    for (const r of runs) if (!lastRun.has(String(r.user_id))) lastRun.set(String(r.user_id), r);
    return json({ total, page, members: rows.map((r) => {
      const p = profiles.get(String(r.user_id)) || {};
      const run = lastRun.get(String(r.user_id));
      return {
        user_id: String(r.user_id), name: p.name, avatar_url: p.avatar_url, left: p.state === 'left',
        day: r.day, month: r.month, year: r.year ?? null, privacy: r.privacy, timezone: r.timezone || null, enabled: r.enabled !== false,
        last: run ? { year: run.year, announced: Boolean(run.steps?.announce), role_added: Boolean(run.role_added_at), role_removed: Boolean(run.role_removed_at) } : null,
      };
    }) });
  }
  if (sub === 'birthdays/search') {
    const found = await h.searchGuildMembers(guildId, url.searchParams.get('q') || '', 8);
    return json({ members: found });
  }
  if (sub === 'birthdays/calendar') {
    const month = Number(url.searchParams.get('month'));
    if (!Number.isInteger(month) || month < 1 || month > 12) return validationError([{ field: 'month', code: 'invalid_month' }]);
    const rows = await db.collection('birthdays').find({ guild_id: gidLong, month, enabled: { $ne: false }, privacy: { $in: ['public', 'community'] } }).limit(2000).toArray();
    const profiles = await h.getGuildMembersProfileMap(guildId, rows.slice(0, 60).map((r) => String(r.user_id)));
    const days = {};
    for (const r of rows) {
      (days[r.day] ||= []).push({ user_id: String(r.user_id), name: profiles.get(String(r.user_id))?.name || null, privacy: r.privacy });
    }
    return json({ month, days });
  }
  if (sub === 'birthdays/history') {
    const page = clampPage(url.searchParams.get('page'));
    const total = await db.collection('birthday_runs').countDocuments({ guild_id: gidLong });
    const rows = await db.collection('birthday_runs').find({ guild_id: gidLong }).sort({ created_at: -1 }).skip(page * 20).limit(20).toArray();
    const profiles = await h.getGuildMembersProfileMap(guildId, rows.map((r) => String(r.user_id)));
    return json({ total, page, rows: rows.map((r) => ({
      user_id: String(r.user_id), name: profiles.get(String(r.user_id))?.name || null, year: r.year, date: r.date,
      announced_at: r.steps?.announce || null, role_added_at: r.role_added_at || null, role_removed_at: r.role_removed_at || null,
      error: r.last_error || null, created_at: r.created_at,
    })) });
  }
  return null;
}

export async function birthdaysMutate(ctx) {
  const { sub, method, body, db, gidLong, guildId, h, session } = ctx;
  if (sub === 'birthdays' && (method === 'PUT' || method === 'PATCH')) {
    const doc = await db.collection('birthday_settings').findOne({ guild_id: gidLong }) || {};
    const existing = mergeBirthdaySettings(h.serializeDoc(doc));
    const { patch, errors } = sanitizeBirthdaySettings(body, existing);
    for (const k of ['channel_id', 'reminder_channel_id', 'board_channel_id']) {
      if (patch[k] && !(await h.assertChannelInGuild(guildId, patch[k]))) fail(errors, k, 'invalid_channel');
    }
    for (const k of ['role_id', 'mention_role_id', 'reminder_role_id']) {
      if (patch[k] && !(await h.assertRoleInGuild(guildId, patch[k]))) fail(errors, k, 'invalid_role');
    }
    if (errors.length) return validationError(errors);
    if (patch.board_channel_id !== undefined && String(patch.board_channel_id || '') !== String(existing.board_channel_id || '')) {
      patch.board_message_id = null;
    }
    const store = h.deserializeInput(patch);
    await db.collection('birthday_settings').updateOne(
      { guild_id: gidLong }, { $set: { ...store, updated_at: new Date() }, $setOnInsert: { guild_id: gidLong, created_at: new Date() } }, { upsert: true },
    );
    await db.collection('settings_audit').insertOne({ guild_id: gidLong, collection: 'birthday_settings', user_id: h.toLong(session?.user?.id), diff: Object.fromEntries(Object.keys(patch).map((k) => [k, { from: existing[k] ?? null, to: patch[k] }])), created_at: new Date() }).catch(() => {});
    return json({ ok: true, settings: { ...existing, ...patch } });
  }
  const mm = sub.match(/^birthdays\/members\/(\d{15,25})$/);
  if (mm) {
    const uid = h.toLong(mm[1]);
    if (method === 'DELETE') {
      const res = await db.collection('birthdays').deleteOne({ guild_id: gidLong, user_id: uid });
      return res.deletedCount ? json({ ok: true }) : notFound();
    }
    if (method === 'PUT' || method === 'PATCH') {
      const { errors, value } = validateBirthdayInput(body);
      if (errors.length) return validationError(errors);
      const fields = { day: value.day, month: value.month, year: value.year, updated_at: new Date() };
      if (value.privacy) fields.privacy = value.privacy;
      if (value.timezone !== undefined) fields.timezone = value.timezone;
      if (body.enabled !== undefined) fields.enabled = Boolean(body.enabled);
      const settings = mergeBirthdaySettings(h.serializeDoc(await db.collection('birthday_settings').findOne({ guild_id: gidLong }) || {}));
      await db.collection('birthdays').updateOne(
        { guild_id: gidLong, user_id: uid },
        { $set: fields, $setOnInsert: { guild_id: gidLong, user_id: uid, created_at: new Date(), ...(value.privacy ? {} : { privacy: settings.privacy_default }), ...(value.timezone === undefined ? { timezone: null } : {}), ...(body.enabled === undefined ? { enabled: true } : {}) } },
        { upsert: true },
      );
      return json({ ok: true });
    }
  }
  if (sub === 'birthdays/test' && method === 'POST') {
    const what = body.what === 'reminder' ? 'reminder' : 'announcement';
    const memberId = /^\d{15,25}$/.test(String(body.member_id || '')) ? String(body.member_id) : String(session.user.id);
    const result = await requestBot({ kind: 'birthday_test', guildId, userId: session.user.id, payload: { what, member_id: memberId, days: Number(body.days) || 1 } });
    return json(result, { status: result.error ? (result.error === 'rate_limited' ? 429 : 502) : 200 });
  }
  if (sub === 'birthdays/board' && method === 'POST') {
    const result = await requestBot({ kind: 'birthday_board', guildId, userId: session.user.id });
    return json(result, { status: result.error ? 502 : 200 });
  }
  return null;
}
