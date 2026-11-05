// Wody Link: limits and defaults. The bot clamps the same bounds (wody_link/constants.py); tests keep the two in step.
export const COLL = { bridges: 'link_bridges', deliveries: 'link_deliveries', history: 'link_history', runtime: 'link_runtime' };
export const MODULE_KEY = 'link';

export const MAX_BRIDGES_PER_OWNER = 10;
export const MAX_BRIDGES_PER_CHANNEL = 3;
export const NAME_MAX = 60;
export const HISTORY_PAGE = 20;

export const STATUSES = ['active', 'paused', 'suspended', 'degraded'];

export const TRANSLATION_LANGUAGES = [
  'en', 'ro', 'fr', 'it', 'de', 'es', 'pt', 'nl', 'tr', 'pl', 'ru', 'uk', 'cs', 'hu', 'bg', 'el', 'sv', 'ar', 'zh', 'ja', 'ko',
];

export const DEFAULT_TRANSLATION = { enabled: false, a_lang: 'en', b_lang: 'ro', detect_source: true };

export const DEFAULT_ANTISPAM = {
  enabled: true,
  max_messages: 10,
  window_seconds: 10,
  max_duplicates: 2,
  duplicate_window_seconds: 30,
  max_mentions: 5,
  restriction_seconds: 60,
};

export const ANTISPAM_BOUNDS = {
  max_messages: [3, 30],
  window_seconds: [3, 60],
  max_duplicates: [1, 10],
  duplicate_window_seconds: [5, 300],
  max_mentions: [0, 20],
  restriction_seconds: [15, 900],
};

export const HISTORY_TYPES = [
  'created', 'modified', 'paused', 'resumed', 'deleted', 'suspended', 'degraded', 'suppressed', 'delivery_failed',
  'translation_failed', 'permission_failed', 'queue_overload', 'retry_scheduled',
];
export const DELIVERY_STATUSES = ['pending', 'delivered', 'retry_scheduled', 'failed', 'suppressed', 'deleted'];
