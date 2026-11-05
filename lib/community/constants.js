
export const STATUSES = ['draft', 'pending_review', 'changes_requested', 'approved', 'published', 'rejected', 'suspended', 'unpublished'];

export const PUBLIC_STATUS = 'published';

export const SUBMITTABLE = ['draft', 'changes_requested', 'rejected'];

export const SECTION_KEYS = ['hero', 'about', 'statistics', 'features', 'staff', 'events', 'achievements', 'social', 'reviews'];
export const LOCKED_SECTIONS = ['hero'];

export const SERVER_TYPES = ['community', 'gaming', 'creator', 'education', 'business', 'open_source', 'roleplay', 'support', 'other'];

export const LANGUAGES = ['en', 'ro', 'fr', 'it', 'de', 'es', 'pt', 'nl', 'tr', 'ru', 'pl', 'ar', 'ja', 'ko', 'zh', 'hi', 'id', 'uk', 'cs', 'sv'];

export const SOCIAL_PLATFORMS = {
  website: { hosts: null },
  youtube: { hosts: ['youtube.com', 'youtu.be'] },
  twitch: { hosts: ['twitch.tv'] },
  tiktok: { hosts: ['tiktok.com'] },
  instagram: { hosts: ['instagram.com'] },
  x: { hosts: ['x.com', 'twitter.com'] },
  github: { hosts: ['github.com'] },
  facebook: { hosts: ['facebook.com', 'fb.com'] },
};

export const THEME_PRESETS = {
  dark: { primary: '#c46a2d', accent: '#e08a4e', secondary: '#1b1b22', background: '#0e0e12', card_style: 'solid', button_style: 'rounded' },
  midnight: { primary: '#5865f2', accent: '#8ea1ff', secondary: '#12142a', background: '#070815', card_style: 'solid', button_style: 'rounded' },
  minimal: { primary: '#e5e7eb', accent: '#9ca3af', secondary: '#16181d', background: '#0b0c0f', card_style: 'outline', button_style: 'square' },
  gaming: { primary: '#22c55e', accent: '#a3e635', secondary: '#0f1a14', background: '#070d0a', card_style: 'solid', button_style: 'square' },
  neon: { primary: '#d946ef', accent: '#22d3ee', secondary: '#160a1f', background: '#09040e', card_style: 'glow', button_style: 'pill' },
  glass: { primary: '#38bdf8', accent: '#818cf8', secondary: '#101826', background: '#080c14', card_style: 'glass', button_style: 'pill' },
  professional: { primary: '#2563eb', accent: '#0ea5e9', secondary: '#111827', background: '#0a0e17', card_style: 'outline', button_style: 'rounded' },
  community: { primary: '#f59e0b', accent: '#f472b6', secondary: '#1c1410', background: '#0e0907', card_style: 'solid', button_style: 'pill' },
};
export const THEME_KEYS = [...Object.keys(THEME_PRESETS), 'custom'];
export const CARD_STYLES = ['solid', 'outline', 'glass', 'glow'];
export const BUTTON_STYLES = ['rounded', 'pill', 'square'];

export const RESERVED_SLUGS = [
  'admin', 'api', 'dashboard', 'servers', 'server', 'login', 'logout', 'settings', 'wody', 'owner', 'panel', 'favorites',
  'guidelines', 'preview', 'preview-frame', 'new', 'edit', 'search', 'support', 'help', 'premium', 'terms', 'privacy', 'cookies',
  'null', 'undefined', 'about', 'contact', 'static', 'img', 'join', 'report', 'review', 'reviews', 'community', 'communities',
];

export const REPORT_REASONS = ['scam', 'malware', 'harassment', 'impersonation', 'misleading', 'invalid_invite', 'prohibited', 'other'];
export const REPORT_STATUSES = ['open', 'investigating', 'resolved', 'dismissed'];

export const REJECT_REASONS = ['incomplete', 'invalid_information', 'invalid_invite', 'duplicate', 'guidelines', 'prohibited', 'other'];
export const CHANGE_AREAS = ['profile', 'description', 'banner', 'category', 'tags', 'social_links', 'other'];

export const CHECKLIST_ITEMS = [
  'ownership', 'exists', 'invite', 'complete', 'description', 'category', 'tags', 'social', 'not_misleading', 'no_prohibited',
];

export const SORTS = ['recommended', 'bumped', 'popular', 'newest', 'members', 'growing', 'updated'];
export const ACTIVITY_LEVELS = ['any', 'active', 'very_active'];
export const MEMBER_BANDS = ['any', 'lt100', '100_1k', '1k_10k', 'gt10k'];

export const MANAGER_ROLES = ['manager', 'editor', 'analytics'];
export const MANAGER_PERMISSIONS = ['edit', 'submit', 'analytics'];
export const ROLE_PRESETS = {
  owner: ['edit', 'submit', 'analytics', 'managers'],
  manager: ['edit', 'submit', 'analytics'],
  editor: ['edit'],
  analytics: ['analytics'],
};

export const LIMITS = {
  name: [2, 60],
  short: [20, 160],
  description: [100, 4000],
  tags: 8,
  languages: 5,
  features: 10,
  staff_roles: 8,
  bannerBytes: 2 * 1024 * 1024,
  backgroundBytes: 2 * 1024 * 1024,
  review: [10, 1000],
  reportText: 500,
  note: 1000,
  message: 1000,
  managers: 10,
  slug: [3, 48],
};

export const IMAGE_RULES = {
  banner: { minW: 600, minH: 200, maxW: 4096, maxH: 4096 },
  background: { minW: 800, minH: 400, maxW: 4096, maxH: 4096 },
};

export const DEFAULT_SETTINGS = {
  auto_publish_on_approve: true,
  require_invite: true,
  require_banner: true,
  min_members: 0,
  max_listings_per_user: 10,
  reviews_enabled: true,
  reviews_require_moderation: true,
  reviews_min_account_days: 0,
  reports_enabled: true,
  reports_rate_limit_per_day: 10,
  analytics_enabled: true,
  discovery_page_size: 24,
  featured_slots: 12,
  require_checklist: true,
  url_prefix: 'server',
  bump_cooldown_hours: 2,
  maintenance_message: '',
};

export const SEED_CATEGORIES = [
  'gaming', 'community', 'creators', 'education', 'technology', 'music', 'art', 'anime', 'esports', 'roleplay', 'business', 'support',
];
export const SEED_SUBCATEGORIES = {
  gaming: ['pc', 'console', 'mobile', 'minecraft', 'fps', 'mmo'],
  community: ['chat', 'social', 'dating_free', 'regional'],
  creators: ['streamers', 'youtubers', 'artists'],
  education: ['languages', 'programming', 'study'],
  technology: ['development', 'open_source', 'hardware'],
  music: ['listening', 'production'],
  art: ['drawing', 'photo', 'design'],
  anime: ['discussion', 'manga'],
  esports: ['teams', 'tournaments'],
  roleplay: ['text', 'voice'],
  business: ['startup', 'finance'],
  support: ['help', 'mental_health'],
};
export const SEED_TAGS = [
  'friendly', 'active', 'events', 'giveaways', 'tournaments', 'chill', 'international', 'beginner_friendly', 'moderated',
  'voice_chat', 'bots', 'memes', 'competitive', 'casual', 'learning', 'creative',
];
export const SEED_FEATURES = [
  'gaming', 'events', 'giveaways', 'tournaments', 'active_community', 'support', 'education', 'roleplay', 'music', 'development', 'community',
];
export const SEED_BADGES = [
  { key: 'verified', official: true, color: '#22c55e', icon: 'shield-check' },
  { key: 'featured', official: true, color: '#f59e0b', icon: 'star' },
  { key: 'established', official: true, color: '#38bdf8', icon: 'landmark' },
  { key: 'growing', official: true, color: '#a78bfa', icon: 'trending-up' },
  { key: 'partner', official: true, color: '#f472b6', icon: 'handshake' },
];
export const FEATURED_PLACEMENTS = ['home', 'category', 'sidebar'];

export const RESERVED_PREFIXES = [
  'api', 'blog', 'careers', 'commands', 'contact', 'cookies', 'dashboard', 'help', 'invite', 'leaderboard', 'modules', 'premium',
  'privacy', 'team', 'terms', 'updates', 'verify', 'servers', 'login', 'logout', 'admin', 'static', 'img', 'icons', 'sitemap', 'robots',
  'en', 'ro', 'fr', 'it', 'de', 'es', 'pt', 'nl', 'tr', '_next',
];
export const PREFIX_RE = /^[a-z0-9](?:[a-z0-9-]{0,22}[a-z0-9])$/;
export const TERMS_VERSION = '2026-10';
