// Names and limits of Wody Statistics on the website. They match wody_stats/constants.py in the bot, which stays the authority:
// the website only reads settings and asks the bot for analyses, the bot validates and writes.
export const COLL = { settings: 'stats_settings' };
export const RANGES = [7, 14, 30, 90];
export const DEFAULT_RANGE = 30;
export const SECTIONS = ['overview', 'channels', 'health', 'history', 'reports', 'settings'];
export const ACCESS = ['staff', 'everyone'];
export const RETENTION = { min: 30, max: 365, default: 90, presets: [30, 60, 90, 180, 365] };
export const TZ = { min: -12, max: 14 };
export const CLASSES = ['very_active', 'active', 'moderate', 'low', 'inactive'];
export const THRESHOLD_KEYS = ['very_active', 'active', 'moderate', 'low'];
export const THRESHOLD_DEFAULTS = { very_active: 50, active: 10, moderate: 2, low: 0.25 };
export const SETTING_FIELDS = ['enabled', 'retention_days', 'access', 'excluded_channels', 'excluded_categories', 'thresholds', 'tz_offset'];
export const HISTORY_WEEKS = [12, 26, 52];
export const MAX_COMPARE = 5;
export const SNOWFLAKE = /^\d{15,21}$/;
// Bot answers that are the member's problem (400/422/409), not the server's.
export const BOT_ERRORS = {
  guild_unavailable: 409, forbidden: 403, invalid: 400, invalid_range: 400, confirm: 400, rate_limited: 429, bot_unreachable: 503,
};
