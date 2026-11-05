// What the server settings form shows. Each field names its path inside the game settings, its kind and its bounds.
// The bot validates every value again (wody_counting/config.py), so these bounds only guide the person typing.
// Labels live in messages as counting.cfg.<section>.<field>; hints, when a field has one, as counting.cfg.<section>.<field>_hint.
import { ERRORS, ERROR_ACTIONS } from './constants.js';

const bool = (key, extra = {}) => ({ key, kind: 'bool', ...extra });
const int = (key, min, max, extra = {}) => ({ key, kind: 'int', min, max, ...extra });
const choice = (key, options, extra = {}) => ({ key, kind: 'choice', options, ...extra });
const ids = (key, extra = {}) => ({ key, kind: 'ids', ...extra });

export const EVENT_KEYS = ['started', 'reset', 'milestone', 'goal', 'record', 'streak', 'challenge', 'achievement', 'competition_started', 'competition_completed', 'season_started', 'season_completed'];
export const FAIL_ACTIONS = ['reset_start', 'reset_milestone', 'reset_custom', 'continue', 'lock', 'warn_only'];
export const STRIKE_ACTIONS = ['warn', 'strike', 'reset', 'lock', 'role', 'timeout'];
export const GOAL_TYPES = ['personal', 'channel', 'server', 'seasonal', 'community'];
export const GOAL_UNITS = ['count', 'value', 'total'];
export const MESSAGE_KEYS = ['wrong_number', 'wrong_turn', 'invalid_format', 'reset', 'goal_reached', 'milestone'];
export const LANGS = ['en', 'ro', 'fr', 'it', 'de', 'es', 'nl', 'pt', 'tr'];

export const SECTIONS = [
  { id: 'rules', fields: [
    bool('math'), choice('decimal_separator', ['.', ',']), bool('allow_negative'), { key: 'max_value', kind: 'number' }, { key: 'min_value', kind: 'number' },
    bool('solo'), int('max_consecutive', 1, 10), int('turn_gap', 0, 100), int('max_participants', 0, 1000), int('turn_cooldown_s', 0, 3600),
    int('rate_per_min', 1, 600), choice('edit_policy', ['notice', 'delete', 'ignore']), choice('non_number', ['ignore', 'delete', 'warn']),
    bool('react'), bool('auto_restart'), bool('delete_wrong'),
  ] },
  { id: 'errors', fields: ERRORS.filter((e) => e !== 'unauthorized' && e !== 'locked').map((e) => choice(e, ERROR_ACTIONS)) },
  { id: 'fail', fields: [
    choice('action', FAIL_ACTIONS), { key: 'custom_value', kind: 'text', max: 40 }, int('lock_seconds', 0, 86400), int('timeout_seconds', 0, 2419200),
    { key: 'role.id', kind: 'id' }, int('role.duration_hours', 1, 720), int('role.after_failures', 1, 100),
    bool('strikes.enabled'), int('strikes.window_hours', 1, 720),
  ] },
  { id: 'saves', fields: [
    bool('enabled'), choice('use', ['auto', 'manual']), int('max_stored', 0, 100), int('start_with', 0, 100), int('earn_milestone', 0, 100), int('earn_interval', 0, 1000000),
    int('cooldown_hours', 0, 720), int('per_day', 0, 100), int('min_index', 0, 1000000), int('restore_window_s', 10, 86400), ids('roles'), int('premium_bonus', 0, 20),
  ] },
  { id: 'streaks', fields: [bool('enabled'), bool('daily'), bool('weekly'), { key: 'milestones', kind: 'ints', min: 2, max: 100000 }] },
  { id: 'xp', fields: [
    bool('enabled'), int('per_valid', 0, 1000), int('per_milestone', 0, 100000), int('per_challenge', 0, 100000), int('per_achievement', 0, 100000),
    int('per_season', 0, 100000), int('daily_cap', 0, 1000000), int('cooldown_s', 0, 3600), ids('exclude_roles'),
  ] },
  { id: 'notify', fields: [
    { key: 'channel_id', kind: 'id' }, int('cooldown_s', 0, 3600), int('max_per_min', 1, 30), choice('language', ['', ...LANGS]), bool('embed'),
    ...EVENT_KEYS.map((e) => bool(`events.${e}`)),
  ] },
  { id: 'protection', fields: [int('auto_regularity_ms', 0, 2000), int('invalid_per_min', 1, 100), int('silence_s', 10, 3600)] },
  { id: 'visibility', fields: [bool('public'), bool('web')] },
  { id: 'permissions', fields: [ids('allowed_roles'), ids('blocked_roles')] },
  { id: 'powerups', fields: [bool('enabled')] },
];

/** Sections shown for each tab of the settings screen. */
export const TABS = {
  rules: ['rules', 'errors', 'fail'],
  rewards: ['saves', 'streaks', 'xp', 'powerups'],
  notify: ['notify'],
  access: ['permissions', 'visibility', 'protection'],
};

export const get = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
export function set(obj, path, value) {
  const keys = path.split('.');
  const root = { ...obj };
  let node = root;
  for (const k of keys.slice(0, -1)) { node[k] = { ...(node[k] || {}) }; node = node[k]; }
  node[keys.at(-1)] = value;
  return root;
}

/** Whole numbers separated by commas or spaces -> array; anything else is dropped. */
export const parseInts = (text) => String(text || '').split(/[\s,;]+/).filter(Boolean).map(Number).filter((n) => Number.isInteger(n));
export const parseIds = (text) => String(text || '').split(/[\s,;]+/).filter((x) => /^\d{15,21}$/.test(x));
