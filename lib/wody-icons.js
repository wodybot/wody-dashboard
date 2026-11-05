// Registry of the Wody custom emoji used by the website. The files are the same artwork that the bot uploads as application
// emoji (wody_bot_<name>), so the site and the bot show one identity. A key maps a MEANING to a real file name; nothing here is
// a Unicode emoji and no Discord id is ever shown. If a key or a file is unknown the component renders a neutral shape.
export const WODY_ICON_FILES = Object.freeze({
  // studio and navigation
  studio: 'tools', preview: 'show', gif: 'feed_pictures', image: 'image', library: 'folder', timeline: 'workflow',
  design: 'colors', discord: 'integration', export: 'export', publish: 'publish', settings: 'settings', advanced: 'configuration',
  dashboard: 'dashboard_globe', link_preview: 'link_preview', module: 'modules', updates: 'news', features: 'features',
  // status
  success: 'success', error: 'error', warning: 'warning', loading: 'loading', info: 'info', pending: 'pending',
  draft: 'draft', generating: 'processing', ready: 'check', published: 'publish', scheduled: 'scheduled', archived: 'inventory',
  failed: 'error', disabled: 'disabled', enabled: 'enabled', online: 'online',
  // actions
  edit: 'edit', duplicate: 'copy', delete: 'delete', restore: 'restore', regenerate: 'refresh', history: 'time',
  link: 'link', download: 'download', upload: 'upload', save: 'save', reset: 'reset', add: 'plus', close: 'close', cancel: 'stop',
  search: 'search', lock: 'lock', unlock: 'unlock', copy: 'copy', play: 'play', pause: 'pause', skip: 'skip', next: 'next', back: 'back',
  // platform concepts
  security: 'shield', performance: 'performance', storage: 'storage', audit: 'audit_log', calendar: 'calendar', premium: 'premium',
  language: 'language', owner: 'owner', server: 'server', servers: 'servers', members: 'members_online', help: 'help', faq: 'faq',
  docs: 'docs', privacy: 'privacy', rules: 'rules', seo: 'search', desktop: 'eco_desktop', attachment: 'attachment',
  // modules shown on the site
  profile: 'profile', passport: 'passport_id', collab: 'collab', battlepass: 'medal', counting: 'counter', statistics: 'stats',
  invite: 'invite', economy: 'economy', leaderboard: 'leaderboard', quests: 'quest', rewards: 'reward', level: 'level_up',
  trophy: 'trophy', xp: 'xp_gain', gift: 'gift', crown: 'crown', star: 'star', sparkles: 'sparkles', rocket: 'rocket',
  // themes
  theme: 'colors', dragon: 'eco_dragon', fire: 'fire', ice: 'eco_snow', storm: 'eco_wave', shadow: 'eco_moon', nature: 'eco_seedling',
  medal: 'medal', photo: 'photo', rank: 'rank', gem: 'gem', inventory: 'inventory', question: 'question', colors: 'colors', wody: 'wody', avatar: 'avatar', music: 'music',
  effects: 'sparkles', character: 'avatar', environment: 'cloud', assets: 'attachment', intro: 'play',
});

export const WODY_ICON_KEYS = Object.freeze(Object.keys(WODY_ICON_FILES));
export const WODY_ICON_BASE = '/emojis/wody';
export const wodyIconFile = (key) => WODY_ICON_FILES[key] || null;
export const wodyIconUrl = (key) => (WODY_ICON_FILES[key] ? `${WODY_ICON_BASE}/${WODY_ICON_FILES[key]}.png` : null);
