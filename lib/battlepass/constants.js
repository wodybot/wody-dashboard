// Wody Battle Pass: names, limits and defaults the dashboard validates. The bot clamps the same numbers again at runtime
// (wody_battlepass/constants.py and config.py), so a value that slips past this file still cannot change the XP rates.
export const COLL = {
  seasons: 'bp_seasons', progress: 'bp_progress', claims: 'bp_claims', inventory: 'bp_inventory', profiles: 'bp_profiles',
  audit: 'bp_audit', stats: 'bp_stats', state: 'bp_state', forms: 'bp_forms', submissions: 'bp_form_submissions',
};

export const GLOBAL = 'global';
export const GUILD = 'guild';
export const SCOPES = [GLOBAL, GUILD];

export const DRAFT = 'draft';
export const SCHEDULED = 'scheduled';
export const ACTIVE = 'active';
export const PAUSED = 'paused';
export const COMPLETED = 'completed';
export const ARCHIVED = 'archived';
export const STATUSES = [DRAFT, SCHEDULED, ACTIVE, PAUSED, COMPLETED, ARCHIVED];

export const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'limited'];
export const REWARD_TYPES = [
  'badge', 'achievement', 'decoration', 'frame', 'background', 'accent', 'title',
  'collection_item', 'avatar_decoration', 'seasonal_item', 'collectible', 'showcase_item',
];
export const CLAIM_MODES = ['manual', 'auto_unlock', 'auto_claim'];
export const CURVES = ['fixed', 'progressive', 'custom'];
export const PERIODS = ['season', 'day', 'week'];
export const METRICS = [
  'xp', 'level', 'messages', 'voice_minutes', 'rewards_claimed', 'badges', 'quests_done',
  'counting_valid', 'counting_milestones', 'counting_streak',
];

export const LOCKED = 'locked';
export const UNLOCKED = 'unlocked';
export const AVAILABLE = 'available';
export const CLAIMED = 'claimed';
export const EXPIRED = 'expired';

export const LIMITS = {
  MAX_LEVELS: 200, MAX_REWARDS: 400, MAX_QUESTS: 60, MAX_ACHIEVEMENTS: 120, MAX_COLLECTIONS: 40,
  MAX_LEVEL_XP: 1_000_000, MAX_TOTAL_XP: 100_000_000, MAX_GUILD_SEASONS: 12,
  MIN_MESSAGE_COOLDOWN: 10, MIN_VOICE_INTERVAL: 60, MAX_MESSAGE_XP: 100, MAX_VOICE_XP_PER_INTERVAL: 100,
  MAX_PREMIUM_MULTIPLIER: 2.0, MAX_GLOBAL_MULTIPLIER: 5.0,
  NAME: 60, DESCRIPTION: 400, REWARD_NAME: 60, REWARD_DESCRIPTION: 200,
};

// Ceilings for Premium seasons. The Owner may change them in Owner Panel > Battle Pass > Protection (bp_state.limits).
export const DEFAULT_GUILD_LIMITS = {
  max_message_xp: 50, max_voice_xp: 50, max_per_day: 3000, max_per_week: 15000, max_per_season: 200000,
  max_multiplier: 2.0, min_message_cooldown: 30, min_voice_interval: 120,
};

export const DEFAULT_MESSAGE = {
  enabled: true, xp: 10, cooldown_seconds: 60, min_length: 5, max_per_hour: 300, max_per_day: 1500, max_per_week: 7000,
  max_per_season: 100000, include_channels: [], exclude_channels: [], include_roles: [], exclude_roles: [],
  min_account_age_days: 0, min_member_days: 0, duplicate_protection: true, spam_protection: true, burst_messages: 6, burst_seconds: 10,
};
export const DEFAULT_VOICE = {
  enabled: true, xp_per_interval: 5, interval_seconds: 300, min_session_seconds: 120, max_per_session: 500, max_per_day: 1500,
  max_per_week: 7000, max_per_season: 100000, include_channels: [], exclude_channels: [], include_roles: [], exclude_roles: [],
  exclude_afk: true, min_active_participants: 2, allow_alone: false, allow_self_muted: true, allow_self_deafened: false,
  allow_server_muted: false, allow_server_deafened: false,
};
export const DEFAULT_PROTECTION = { claim_after_end: true, claim_while_paused: true, audit_refusals: true };
// season_created: one message in the channel when a server season is published (also one that starts later).
// mention_role_id / mention_everyone: who the season messages (created, started, ended) mention; nobody by default.
export const DEFAULT_NOTIFICATIONS = {
  level_up: true, reward_unlocked: true, season_start: true, season_end: true, season_created: true,
  channel_id: null, dm: false, mention_role_id: null, mention_everyone: false,
};

// Why a server season cannot be switched on. Each code has a translated message in messages/<locale>.json (battlepass.reasons).
export const REASONS = {
  global_active: 'global_active', not_premium: 'not_premium', another_global_active: 'another_global_active',
  another_guild_active: 'another_guild_active', bad_status: 'bad_status', not_owner: 'not_owner', invalid_config: 'invalid_config',
};
