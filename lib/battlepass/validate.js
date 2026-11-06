// Validation of a season before it is saved. Strict on purpose: a value outside its range is refused with a field-level code
// (the editor shows a translated message for it). The bot clamps every number again when it loads a season.
import { fail, pickBool, pickEnum, pickInt, pickNumber, cleanText } from '@/lib/modules/validate';
import {
  GLOBAL, GUILD, LIMITS, RARITIES, REWARD_TYPES, CLAIM_MODES, CURVES, PERIODS, METRICS,
  DEFAULT_MESSAGE, DEFAULT_VOICE, DEFAULT_PROTECTION, DEFAULT_NOTIFICATIONS, DEFAULT_GUILD_LIMITS,
} from './constants.js';
import { resolveCosts, thresholds, validateCosts } from './curve.js';
import { normalizeTheme, validateThemePatch, isThemeKey } from './page-theme.js';
import { cleanPageImage } from '@/lib/profile-page';

export const LOCALES = ['en', 'ro', 'fr', 'it', 'de', 'es', 'nl', 'pt', 'tr'];
export const SNOWFLAKE = /^\d{15,25}$/;
const ID = /^[A-Za-z0-9_-]{1,40}$/;
// Visible text: no markup characters, no control characters, one line. Too long is refused, not cut.
function pickText(errors, field, v, max, fallback = '') {
  if (v === undefined || v === null) return fallback;
  const t = String(v).replace(/[\p{Cc}\p{Cf}<>]/gu, ' ').replace(/\s+/g, ' ').trim();
  if ([...t].length > max) { fail(errors, field, 'too_long', { max }); return [...t].slice(0, max).join(''); }
  return t;
}
const plain = (v, max) => String(v ?? '').replace(/[\p{Cc}\p{Cf}<>]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

function dateOf(errors, field, v) {
  if (v === undefined || v === null || v === '') return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) { fail(errors, field, 'invalid_date'); return null; }
  return d;
}

function snowList(errors, field, v, max = 100) {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v)) { fail(errors, field, 'invalid_choice'); return []; }
  const out = [];
  for (const x of v) {
    const s = String(x ?? '').trim();
    if (!SNOWFLAKE.test(s)) { fail(errors, field, 'invalid_id'); return out; }
    if (!out.includes(s)) out.push(s);
  }
  if (out.length > max) fail(errors, field, 'too_many', { max });
  return out.slice(0, max);
}

function cleanTranslations(errors, field, input, fields) {
  if (input === undefined || input === null) return undefined;
  if (typeof input !== 'object' || Array.isArray(input)) { fail(errors, field, 'invalid'); return undefined; }
  const out = {};
  for (const [lang, value] of Object.entries(input)) {
    if (!LOCALES.includes(lang)) { fail(errors, `${field}.${lang}`, 'invalid_choice'); continue; }
    if (!value || typeof value !== 'object') continue;
    const row = {};
    for (const [key, max] of Object.entries(fields)) {
      const t = plain(value[key], max);
      if (t) row[key] = t;
    }
    if (Object.keys(row).length) out[lang] = row;
  }
  return Object.keys(out).length ? out : undefined;
}

function sectionLimits(scope, limits) {
  const g = scope === GUILD;
  return {
    xpMsg: g ? Math.min(LIMITS.MAX_MESSAGE_XP, limits.max_message_xp) : LIMITS.MAX_MESSAGE_XP,
    xpVoice: g ? Math.min(LIMITS.MAX_VOICE_XP_PER_INTERVAL, limits.max_voice_xp) : LIMITS.MAX_VOICE_XP_PER_INTERVAL,
    cdMin: g ? Math.max(LIMITS.MIN_MESSAGE_COOLDOWN, limits.min_message_cooldown) : LIMITS.MIN_MESSAGE_COOLDOWN,
    ivMin: g ? Math.max(LIMITS.MIN_VOICE_INTERVAL, limits.min_voice_interval) : LIMITS.MIN_VOICE_INTERVAL,
    day: g ? limits.max_per_day : 100_000,
    week: g ? limits.max_per_week : 500_000,
    season: g ? limits.max_per_season : LIMITS.MAX_TOTAL_XP,
    multiplier: g ? Math.min(LIMITS.MAX_PREMIUM_MULTIPLIER, limits.max_multiplier) : LIMITS.MAX_GLOBAL_MULTIPLIER,
  };
}

function cleanMessage(errors, input, base, lim, scope) {
  const src = { ...base, ...(input || {}) };
  const f = (k) => `xp.message.${k}`;
  const out = {
    enabled: pickBool(src.enabled, base.enabled),
    xp: pickInt(errors, f('xp'), src.xp, 0, lim.xpMsg, base.xp),
    cooldown_seconds: pickInt(errors, f('cooldown_seconds'), src.cooldown_seconds, lim.cdMin, 3600, Math.max(lim.cdMin, base.cooldown_seconds)),
    min_length: pickInt(errors, f('min_length'), src.min_length, 0, 2000, base.min_length),
    max_per_hour: pickInt(errors, f('max_per_hour'), src.max_per_hour, 1, lim.day, Math.min(lim.day, base.max_per_hour)),
    max_per_day: pickInt(errors, f('max_per_day'), src.max_per_day, 1, lim.day, Math.min(lim.day, base.max_per_day)),
    max_per_week: pickInt(errors, f('max_per_week'), src.max_per_week, 1, lim.week, Math.min(lim.week, base.max_per_week)),
    max_per_season: pickInt(errors, f('max_per_season'), src.max_per_season, 1, lim.season, Math.min(lim.season, base.max_per_season)),
    include_channels: snowList(errors, f('include_channels'), src.include_channels),
    exclude_channels: snowList(errors, f('exclude_channels'), src.exclude_channels),
    include_roles: snowList(errors, f('include_roles'), src.include_roles),
    exclude_roles: snowList(errors, f('exclude_roles'), src.exclude_roles),
    min_account_age_days: pickInt(errors, f('min_account_age_days'), src.min_account_age_days, 0, 3650, 0),
    min_member_days: pickInt(errors, f('min_member_days'), src.min_member_days, 0, 3650, 0),
    burst_messages: pickInt(errors, f('burst_messages'), src.burst_messages, 2, 30, base.burst_messages),
    burst_seconds: pickInt(errors, f('burst_seconds'), src.burst_seconds, 2, 120, base.burst_seconds),
  };
  // Protections against farming cannot be switched off in a server season, and are on by default everywhere.
  out.duplicate_protection = scope === GUILD ? true : pickBool(src.duplicate_protection, true);
  out.spam_protection = scope === GUILD ? true : pickBool(src.spam_protection, true);
  return out;
}

function cleanVoice(errors, input, base, lim, scope) {
  const src = { ...base, ...(input || {}) };
  const f = (k) => `xp.voice.${k}`;
  const g = scope === GUILD;
  const out = {
    enabled: pickBool(src.enabled, base.enabled),
    xp_per_interval: pickInt(errors, f('xp_per_interval'), src.xp_per_interval, 0, lim.xpVoice, base.xp_per_interval),
    interval_seconds: pickInt(errors, f('interval_seconds'), src.interval_seconds, lim.ivMin, 3600, Math.max(lim.ivMin, base.interval_seconds)),
    min_session_seconds: pickInt(errors, f('min_session_seconds'), src.min_session_seconds, 0, 7200, base.min_session_seconds),
    max_per_session: pickInt(errors, f('max_per_session'), src.max_per_session, 1, 10_000, base.max_per_session),
    max_per_day: pickInt(errors, f('max_per_day'), src.max_per_day, 1, lim.day, Math.min(lim.day, base.max_per_day)),
    max_per_week: pickInt(errors, f('max_per_week'), src.max_per_week, 1, lim.week, Math.min(lim.week, base.max_per_week)),
    max_per_season: pickInt(errors, f('max_per_season'), src.max_per_season, 1, lim.season, Math.min(lim.season, base.max_per_season)),
    include_channels: snowList(errors, f('include_channels'), src.include_channels),
    exclude_channels: snowList(errors, f('exclude_channels'), src.exclude_channels),
    include_roles: snowList(errors, f('include_roles'), src.include_roles),
    exclude_roles: snowList(errors, f('exclude_roles'), src.exclude_roles),
    min_active_participants: pickInt(errors, f('min_active_participants'), src.min_active_participants, 1, 25, base.min_active_participants),
    allow_self_muted: pickBool(src.allow_self_muted, base.allow_self_muted),
    allow_self_deafened: pickBool(src.allow_self_deafened, base.allow_self_deafened),
    allow_server_muted: pickBool(src.allow_server_muted, base.allow_server_muted),
    allow_server_deafened: pickBool(src.allow_server_deafened, base.allow_server_deafened),
    // A server season cannot count AFK channels or time spent alone. A Global season may.
    exclude_afk: g ? true : pickBool(src.exclude_afk, true),
    allow_alone: g ? false : pickBool(src.allow_alone, false),
  };
  return out;
}

function cleanRewards(errors, input, levelCount) {
  if (input === undefined) return [];
  if (!Array.isArray(input)) { fail(errors, 'rewards', 'invalid'); return []; }
  if (input.length > LIMITS.MAX_REWARDS) fail(errors, 'rewards', 'too_many', { max: LIMITS.MAX_REWARDS });
  const out = []; const seen = new Set();
  input.slice(0, LIMITS.MAX_REWARDS).forEach((r, i) => {
    const f = (k) => `rewards.${i + 1}.${k}`;
    if (!r || typeof r !== 'object') { fail(errors, `rewards.${i + 1}`, 'invalid'); return; }
    const id = ID.test(String(r.id ?? '')) ? String(r.id) : `r${i + 1}`;
    if (seen.has(id)) { fail(errors, f('id'), 'duplicate'); return; }
    seen.add(id);
    const name = pickText(errors, f('name'), r.name, LIMITS.REWARD_NAME);
    if (!name) fail(errors, f('name'), 'required');
    const row = {
      id, name,
      description: pickText(errors, f('description'), r.description, LIMITS.REWARD_DESCRIPTION),
      type: pickEnum(errors, f('type'), r.type, REWARD_TYPES, 'badge'),
      rarity: pickEnum(errors, f('rarity'), r.rarity, RARITIES, 'common'),
      claim_mode: pickEnum(errors, f('claim_mode'), r.claim_mode, CLAIM_MODES, 'manual'),
      level: pickInt(errors, f('level'), r.level, 1, Math.max(1, levelCount), 1),
      required_xp: pickInt(errors, f('required_xp'), r.required_xp, 0, LIMITS.MAX_TOTAL_XP, 0),
      category: plain(r.category, 30) || undefined,
      premium_track: pickBool(r.premium_track, false) || undefined,
    };
    for (const key of ['icon', 'art']) {
      if (r[key] === undefined || r[key] === null || r[key] === '') continue;
      try { row[key] = cleanPageImage(r[key]); } catch { fail(errors, f(key), 'invalid_url'); }
    }
    const until = dateOf(errors, f('availability.until'), r.availability?.until);
    if (until) row.availability = { until: until.toISOString() };
    const tr = cleanTranslations(errors, f('i18n'), r.i18n, { name: LIMITS.REWARD_NAME, description: LIMITS.REWARD_DESCRIPTION });
    if (tr) row.i18n = tr;
    if (r.payload && typeof r.payload === 'object' && !Array.isArray(r.payload)) {
      const p = {};
      for (const [k, v] of Object.entries(r.payload).slice(0, 8)) {
        if (!/^[a-z_]{1,24}$/.test(k)) continue;
        if (typeof v === 'string') p[k] = plain(v, 120);
        else if (typeof v === 'number' && Number.isFinite(v)) p[k] = v;
        else if (typeof v === 'boolean') p[k] = v;
      }
      if (Object.keys(p).length) row.payload = p;
    }
    out.push(row);
  });
  return out;
}

function cleanQuests(errors, input, rewardIds, xpCap) {
  if (input === undefined) return [];
  if (!Array.isArray(input)) { fail(errors, 'quests', 'invalid'); return []; }
  if (input.length > LIMITS.MAX_QUESTS) fail(errors, 'quests', 'too_many', { max: LIMITS.MAX_QUESTS });
  const out = []; const seen = new Set();
  input.slice(0, LIMITS.MAX_QUESTS).forEach((q, i) => {
    const f = (k) => `quests.${i + 1}.${k}`;
    if (!q || typeof q !== 'object') { fail(errors, `quests.${i + 1}`, 'invalid'); return; }
    const id = ID.test(String(q.id ?? '')) ? String(q.id) : `q${i + 1}`;
    if (seen.has(id)) { fail(errors, f('id'), 'duplicate'); return; }
    seen.add(id);
    const name = pickText(errors, f('name'), q.name, LIMITS.REWARD_NAME);
    if (!name) fail(errors, f('name'), 'required');
    const row = {
      id, name, description: pickText(errors, f('description'), q.description, LIMITS.REWARD_DESCRIPTION),
      metric: pickEnum(errors, f('metric'), q.metric, METRICS, 'messages'),
      target: pickInt(errors, f('target'), q.target, 1, 1_000_000, 1),
      period: pickEnum(errors, f('period'), q.period, PERIODS, 'season'),
      xp_reward: pickInt(errors, f('xp_reward'), q.xp_reward, 0, xpCap, 0),
    };
    if (q.reward_id) {
      if (!rewardIds.has(String(q.reward_id))) fail(errors, f('reward_id'), 'unknown_reward'); else row.reward_id = String(q.reward_id);
    }
    const tr = cleanTranslations(errors, f('i18n'), q.i18n, { name: LIMITS.REWARD_NAME, description: LIMITS.REWARD_DESCRIPTION });
    if (tr) row.i18n = tr;
    out.push(row);
  });
  return out;
}

function cleanAchievements(errors, input, rewardIds) {
  if (input === undefined) return [];
  if (!Array.isArray(input)) { fail(errors, 'achievements', 'invalid'); return []; }
  if (input.length > LIMITS.MAX_ACHIEVEMENTS) fail(errors, 'achievements', 'too_many', { max: LIMITS.MAX_ACHIEVEMENTS });
  const out = []; const seen = new Set();
  input.slice(0, LIMITS.MAX_ACHIEVEMENTS).forEach((a, i) => {
    const f = (k) => `achievements.${i + 1}.${k}`;
    if (!a || typeof a !== 'object') { fail(errors, `achievements.${i + 1}`, 'invalid'); return; }
    const id = ID.test(String(a.id ?? '')) ? String(a.id) : `a${i + 1}`;
    if (seen.has(id)) { fail(errors, f('id'), 'duplicate'); return; }
    seen.add(id);
    const name = pickText(errors, f('name'), a.name, LIMITS.REWARD_NAME);
    if (!name) fail(errors, f('name'), 'required');
    const conditions = [];
    const raw = Array.isArray(a.conditions) ? a.conditions : [];
    if (!raw.length) fail(errors, f('conditions'), 'required');
    if (raw.length > 5) fail(errors, f('conditions'), 'too_many', { max: 5 });
    raw.slice(0, 5).forEach((c, j) => {
      conditions.push({
        metric: pickEnum(errors, `achievements.${i + 1}.conditions.${j + 1}.metric`, c?.metric, METRICS, 'messages'),
        target: pickInt(errors, `achievements.${i + 1}.conditions.${j + 1}.target`, c?.target, 1, 100_000_000, 1),
      });
    });
    const row = { id, name, description: pickText(errors, f('description'), a.description, LIMITS.REWARD_DESCRIPTION), conditions };
    if (a.reward_id) {
      if (!rewardIds.has(String(a.reward_id))) fail(errors, f('reward_id'), 'unknown_reward'); else row.reward_id = String(a.reward_id);
    }
    const tr = cleanTranslations(errors, f('i18n'), a.i18n, { name: LIMITS.REWARD_NAME, description: LIMITS.REWARD_DESCRIPTION });
    if (tr) row.i18n = tr;
    out.push(row);
  });
  return out;
}

function cleanCollections(errors, input, rewardIds) {
  if (input === undefined) return [];
  if (!Array.isArray(input)) { fail(errors, 'collections', 'invalid'); return []; }
  if (input.length > LIMITS.MAX_COLLECTIONS) fail(errors, 'collections', 'too_many', { max: LIMITS.MAX_COLLECTIONS });
  const out = []; const seen = new Set();
  input.slice(0, LIMITS.MAX_COLLECTIONS).forEach((c, i) => {
    const f = (k) => `collections.${i + 1}.${k}`;
    if (!c || typeof c !== 'object') { fail(errors, `collections.${i + 1}`, 'invalid'); return; }
    const id = ID.test(String(c.id ?? '')) ? String(c.id) : `c${i + 1}`;
    if (seen.has(id)) { fail(errors, f('id'), 'duplicate'); return; }
    seen.add(id);
    const name = pickText(errors, f('name'), c.name, LIMITS.REWARD_NAME);
    if (!name) fail(errors, f('name'), 'required');
    const ids = [];
    for (const rid of Array.isArray(c.reward_ids) ? c.reward_ids : []) {
      if (!rewardIds.has(String(rid))) { fail(errors, f('reward_ids'), 'unknown_reward'); continue; }
      if (!ids.includes(String(rid))) ids.push(String(rid));
    }
    if (!ids.length) fail(errors, f('reward_ids'), 'required');
    const row = { id, name, description: pickText(errors, f('description'), c.description, LIMITS.REWARD_DESCRIPTION), reward_ids: ids };
    if (c.completion_reward_id) {
      const cid = String(c.completion_reward_id);
      if (!rewardIds.has(cid)) fail(errors, f('completion_reward_id'), 'unknown_reward');
      else if (ids.includes(cid)) fail(errors, f('completion_reward_id'), 'inside_collection');
      else row.completion_reward_id = cid;
    }
    const tr = cleanTranslations(errors, f('i18n'), c.i18n, { name: LIMITS.REWARD_NAME, description: LIMITS.REWARD_DESCRIPTION });
    if (tr) row.i18n = tr;
    out.push(row);
  });
  return out;
}

/**
 * Validates a whole season. `existing` is the stored document (for edits); fields missing from `input` keep their stored value.
 * Returns { errors, doc }; `doc` is only usable when errors is empty. Status and scope are never taken from the input.
 */
export function cleanSeason(input, { scope, existing = null, limits = DEFAULT_GUILD_LIMITS } = {}) {
  const errors = [];
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { errors: [{ field: 'body', code: 'invalid' }], doc: null };
  const base = existing || {};
  const get = (k, d) => (input[k] !== undefined ? input[k] : base[k] !== undefined ? base[k] : d);
  const lim = sectionLimits(scope, { ...DEFAULT_GUILD_LIMITS, ...(limits || {}) });

  const name = pickText(errors, 'name', get('name', ''), LIMITS.NAME);
  if (!name) fail(errors, 'name', 'required');
  const description = pickText(errors, 'description', get('description', ''), LIMITS.DESCRIPTION);
  const i18n = cleanTranslations(errors, 'i18n', get('i18n'), { name: LIMITS.NAME, description: LIMITS.DESCRIPTION });

  const starts = dateOf(errors, 'starts_at', get('starts_at', null));
  const ends = dateOf(errors, 'ends_at', get('ends_at', null));
  if (starts && ends && ends <= starts) fail(errors, 'ends_at', 'before_start');

  // Levels: a curve (fixed, progressive, custom) with optional per-level changes. The result is always stored as `levels`.
  const curveIn = get('curve', { type: 'fixed', base: 100 }) || {};
  const curve = {
    type: pickEnum(errors, 'curve.type', curveIn.type, CURVES, 'fixed'),
    base: pickInt(errors, 'curve.base', curveIn.base, 1, LIMITS.MAX_LEVEL_XP, 100),
    step: pickInt(errors, 'curve.step', curveIn.step, 0, LIMITS.MAX_LEVEL_XP, 25),
  };
  if (curve.type === 'custom') {
    const raw = Array.isArray(curveIn.costs) ? curveIn.costs : [];
    if (!raw.length) fail(errors, 'curve.costs', 'required');
    curve.costs = raw.slice(0, LIMITS.MAX_LEVELS).map((x, i) => pickInt(errors, `curve.costs.${i + 1}`, x, 1, LIMITS.MAX_LEVEL_XP, 100));
  }
  const levelCount = pickInt(errors, 'level_count', get('level_count', 30), 1, LIMITS.MAX_LEVELS, 30);
  const overridesIn = get('overrides', {}) || {};
  const overrides = {};
  for (const [lv, xp] of Object.entries(typeof overridesIn === 'object' ? overridesIn : {})) {
    const n = Number(lv);
    if (!Number.isInteger(n) || n < 1 || n > levelCount) { fail(errors, `overrides.${lv}`, 'out_of_range', { min: 1, max: levelCount }); continue; }
    overrides[n] = pickInt(errors, `overrides.${lv}`, xp, 1, LIMITS.MAX_LEVEL_XP, 100);
  }
  const costs = resolveCosts(curve, levelCount, overrides);

  const xpIn = get('xp', {}) || {};
  const multiplier = pickNumber(errors, 'xp.multiplier', xpIn.multiplier, 0, lim.multiplier, 1);
  const message = cleanMessage(errors, xpIn.message, DEFAULT_MESSAGE, lim, scope);
  const voice = cleanVoice(errors, xpIn.voice, DEFAULT_VOICE, lim, scope);

  const rewards = cleanRewards(errors, get('rewards', []), levelCount);
  const rewardIds = new Set(rewards.map((r) => r.id));
  const questXpCap = scope === GUILD ? 500 : 10_000;
  const quests = cleanQuests(errors, get('quests', []), rewardIds, questXpCap);
  const achievements = cleanAchievements(errors, get('achievements', []), rewardIds);
  const collections = cleanCollections(errors, get('collections', []), rewardIds);

  // A pass nobody can finish inside its own XP caps is refused rather than saved.
  const bonus = quests.reduce((s, q) => s + q.xp_reward, 0);
  const cap = (message.enabled ? message.max_per_season : 0) + (voice.enabled ? voice.max_per_season : 0) + bonus;
  for (const [field, code, params] of validateCosts(costs, { seasonXpCap: cap })) fail(errors, field, code, params);

  const protectionIn = get('protection', {}) || {};
  const protection = {
    claim_after_end: pickBool(protectionIn.claim_after_end, DEFAULT_PROTECTION.claim_after_end),
    claim_while_paused: pickBool(protectionIn.claim_while_paused, DEFAULT_PROTECTION.claim_while_paused),
    audit_refusals: pickBool(protectionIn.audit_refusals, DEFAULT_PROTECTION.audit_refusals),
  };
  const noteIn = get('notifications', {}) || {};
  const notifications = {
    level_up: pickBool(noteIn.level_up, DEFAULT_NOTIFICATIONS.level_up),
    reward_unlocked: pickBool(noteIn.reward_unlocked, DEFAULT_NOTIFICATIONS.reward_unlocked),
    season_start: pickBool(noteIn.season_start, DEFAULT_NOTIFICATIONS.season_start),
    season_end: pickBool(noteIn.season_end, DEFAULT_NOTIFICATIONS.season_end),
    dm: pickBool(noteIn.dm, DEFAULT_NOTIFICATIONS.dm),
    channel_id: noteIn.channel_id ? (SNOWFLAKE.test(String(noteIn.channel_id)) ? String(noteIn.channel_id) : (fail(errors, 'notifications.channel_id', 'invalid_id'), null)) : null,
  };

  // Page appearance, field by field. A value the person changed must be valid; a value that was already stored and is no longer
  // accepted (an older version of the page settings) falls back to its default instead of blocking every save of the season.
  let page = normalizeTheme(base.page);
  if (input.page !== undefined) {
    if (!input.page || typeof input.page !== 'object' || Array.isArray(input.page)) fail(errors, 'page', 'invalid');
    else {
      const stored = base.page && typeof base.page === 'object' ? base.page : {};
      for (const [key, value] of Object.entries(input.page)) {
        if (!isThemeKey(key)) continue;
        try { Object.assign(page, validateThemePatch({ [key]: value })); } catch {
          if (JSON.stringify(value) !== JSON.stringify(stored[key]) && JSON.stringify(value) !== JSON.stringify(page[key])) fail(errors, `page.${key}`, 'invalid');
        }
      }
    }
  }

  const doc = {
    scope, name, description, ...(i18n ? { i18n } : {}),
    starts_at: starts, ends_at: ends,
    curve, level_count: levelCount, overrides,
    levels: costs.map((xp, i) => ({ n: i + 1, xp })),
    xp: { multiplier, message, voice },
    rewards, quests, achievements, collections, protection, notifications, page,
  };
  return { errors, doc };
}

/** XP needed for the last level, shown in the editor next to the XP caps. */
export function totalXp(doc) {
  return thresholds((doc.levels || []).map((l) => l.xp)).at(-1) || 0;
}

export { cleanText };
