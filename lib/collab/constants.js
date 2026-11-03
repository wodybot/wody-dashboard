
export const LOCALES = ['en', 'ro', 'fr', 'it', 'de', 'es', 'pt', 'nl', 'tr'];

export const STATUS = Object.freeze({
  DRAFT: 'draft',
  PENDING_VERIFICATION: 'pending_verification',
  PENDING_REVIEW: 'pending_review',
  PENDING_SERVER: 'pending_server',
  NEEDS_CHANGES: 'needs_changes',
  APPROVED: 'approved',
  PUBLISHED: 'published',
  REJECTED: 'rejected',
  SUSPENDED: 'suspended',
  EXPIRED: 'expired',
  DELETED: 'deleted',
});
export const STATUS_LIST = Object.values(STATUS);
export const EDITABLE = new Set([STATUS.DRAFT, STATUS.NEEDS_CHANGES, STATUS.REJECTED, STATUS.EXPIRED, STATUS.PUBLISHED, STATUS.PENDING_REVIEW, STATUS.PENDING_SERVER]);
export const NON_PUBLIC = new Set(STATUS_LIST.filter((s) => s !== STATUS.PUBLISHED));

export const LIMITS = Object.freeze({
  title: { min: 8, max: 100 },
  description: { min: 40, max: 4000 },
  outcome: { max: 800 },
  requirements: { max: 800 },
  tags: { max: 8, each: 24 },
  links: { max: 5 },
  questions: { max: 5, each: 200 },
  attachments: { max: 3, bytes: 1_500_000 },
  deadlineDays: 365,
  drafts: 10,
  active: 5,
  perHourSubmit: 6,
  postCooldownSec: 60,
  deleteMax: 3,
  deleteWindowSec: 3600,
  blockMinutes: 30,
  dupHours: 24,
  perServerDay: 4,
  perDayCreate: 20,
  applyPerHour: 12,
  intro: { min: 20, max: 1500 },
  experience: { max: 1500 },
  approach: { max: 1500 },
  duration: { max: 80 },
  answer: { max: 600 },
  skills: { max: 12 },
  portfolio: { max: 5 },
  message: { min: 5, max: 1500 },
  contactName: { max: 60 },
  reportDetails: { max: 600 },
  cardSummary: 220,
  pageSize: 30,
});

export const REPORT_REASONS = ['scam', 'money', 'spam', 'illegal', 'impersonation', 'unsafe_link', 'other'];
export const REJECT_REASONS = ['money_not_allowed', 'spam', 'unsafe_content', 'rules', 'duplicate', 'other'];
export const SOCIALS = Object.freeze([
  { id: 'youtube', label: 'YouTube', hosts: ['youtube.com', 'm.youtube.com', 'youtu.be'], handle: (h) => `https://www.youtube.com/@${h}`, placeholder: '@channel' },
  { id: 'twitch', label: 'Twitch', hosts: ['twitch.tv', 'm.twitch.tv'], handle: (h) => `https://www.twitch.tv/${h}`, placeholder: 'username' },
  { id: 'tiktok', label: 'TikTok', hosts: ['tiktok.com', 'm.tiktok.com'], handle: (h) => `https://www.tiktok.com/@${h}`, placeholder: '@username' },
  { id: 'instagram', label: 'Instagram', hosts: ['instagram.com'], handle: (h) => `https://www.instagram.com/${h}`, placeholder: '@username' },
  { id: 'x', label: 'X', hosts: ['x.com', 'twitter.com', 'mobile.twitter.com'], handle: (h) => `https://x.com/${h}`, placeholder: '@username' },
  { id: 'github', label: 'GitHub', hosts: ['github.com'], handle: (h) => `https://github.com/${h}`, placeholder: 'username' },
  { id: 'behance', label: 'Behance', hosts: ['behance.net'], handle: (h) => `https://www.behance.net/${h}`, placeholder: 'username' },
  { id: 'linkedin', label: 'LinkedIn', hosts: ['linkedin.com'], handle: (h) => `https://www.linkedin.com/in/${h}`, placeholder: 'username' },
  { id: 'discord', label: 'Discord', hosts: ['discord.gg', 'discord.com', 'discordapp.com'], handle: null, placeholder: 'https://discord.gg/invite' },
  { id: 'telegram', label: 'Telegram', hosts: ['t.me', 'telegram.me'], handle: (h) => `https://t.me/${h}`, placeholder: '@username' },
  { id: 'facebook', label: 'Facebook', hosts: ['facebook.com', 'm.facebook.com', 'fb.com'], handle: (h) => `https://www.facebook.com/${h}`, placeholder: 'username' },
  { id: 'reddit', label: 'Reddit', hosts: ['reddit.com'], handle: (h) => `https://www.reddit.com/user/${h}`, placeholder: 'username' },
  { id: 'snapchat', label: 'Snapchat', hosts: ['snapchat.com'], handle: (h) => `https://www.snapchat.com/add/${h}`, placeholder: 'username' },
  { id: 'threads', label: 'Threads', hosts: ['threads.net', 'threads.com'], handle: (h) => `https://www.threads.net/@${h}`, placeholder: '@username' },
  { id: 'bluesky', label: 'Bluesky', hosts: ['bsky.app'], handle: (h) => `https://bsky.app/profile/${h}`, placeholder: 'name.bsky.social' },
  { id: 'pinterest', label: 'Pinterest', hosts: ['pinterest.com', 'pin.it'], handle: (h) => `https://www.pinterest.com/${h}`, placeholder: 'username' },
  { id: 'spotify', label: 'Spotify', hosts: ['spotify.com'], handle: null, placeholder: 'https://open.spotify.com/...' },
  { id: 'soundcloud', label: 'SoundCloud', hosts: ['soundcloud.com'], handle: (h) => `https://soundcloud.com/${h}`, placeholder: 'username' },
  { id: 'kick', label: 'Kick', hosts: ['kick.com'], handle: (h) => `https://kick.com/${h}`, placeholder: 'username' },
  { id: 'steam', label: 'Steam', hosts: ['steamcommunity.com'], handle: (h) => `https://steamcommunity.com/id/${h}`, placeholder: 'username' },
  { id: 'dribbble', label: 'Dribbble', hosts: ['dribbble.com'], handle: (h) => `https://dribbble.com/${h}`, placeholder: 'username' },
  { id: 'artstation', label: 'ArtStation', hosts: ['artstation.com'], handle: (h) => `https://www.artstation.com/${h}`, placeholder: 'username' },
  { id: 'vimeo', label: 'Vimeo', hosts: ['vimeo.com'], handle: (h) => `https://vimeo.com/${h}`, placeholder: 'username' },
  { id: 'medium', label: 'Medium', hosts: ['medium.com'], handle: (h) => `https://medium.com/@${h}`, placeholder: '@username' },
  { id: 'patreon', label: 'Patreon', hosts: ['patreon.com'], handle: (h) => `https://www.patreon.com/${h}`, placeholder: 'username' },
  { id: 'kofi', label: 'Ko-fi', hosts: ['ko-fi.com'], handle: (h) => `https://ko-fi.com/${h}`, placeholder: 'username' },
  { id: 'fiverr', label: 'Fiverr', hosts: ['fiverr.com'], handle: (h) => `https://www.fiverr.com/${h}`, placeholder: 'username' },
  { id: 'upwork', label: 'Upwork', hosts: ['upwork.com'], handle: null, placeholder: 'https://www.upwork.com/freelancers/...' },
  { id: 'website', label: 'Website', hosts: null, handle: null, placeholder: 'https://example.com' },
]);
export const SOCIAL_IDS = SOCIALS.map((s) => s.id);

export const NOTIF_GROUPS = Object.freeze({
  published: 'status', held_review: 'status', held_server: 'status', rejected: 'status', changes: 'status', suspended: 'status', expired: 'status', expiring_soon: 'status', auto_removed: 'status',
  application_new: 'applications', application_selected: 'applications', application_declined: 'applications',
  message_new: 'messages',
});
export const notifTab = (type) => (type === 'announce_channel' || type === 'announce_channel_off' ? 'servers' : type === 'message_new' ? 'messages' : type === 'application_selected' || type === 'application_declined' ? 'applications' : 'requests');
export const NOTIF_CRITICAL = new Set(['rejected', 'changes', 'suspended', 'announce_channel', 'announce_channel_off']);
export const NOTIF_DEFAULTS = Object.freeze({ dm: true, inapp: true, status: true, applications: true, messages: true });

export const CONTACT_MODES = ['internal', 'discord'];

export const DEFAULT_SETTINGS = Object.freeze({
  lifetime_days: 7,
  inactive_days: 7,
  report_threshold: 3,
  edits_need_review: false,
  review_attachments: false,
  public_contact_enabled: true,
  ai_moderation: true,
  submissions_open: true,
});

export const SEED_CATEGORIES = [
  { slug: 'web_development', icon: 'Globe', names: { en: 'Web Development', ro: 'Dezvoltare web', fr: 'Développement web', it: 'Sviluppo web', de: 'Webentwicklung', es: 'Desarrollo web', pt: 'Desenvolvimento web', nl: 'Webontwikkeling', tr: 'Web geliştirme' } },
  { slug: 'discord_bots', icon: 'Bot', names: { en: 'Discord Bots', ro: 'Boți Discord', fr: 'Bots Discord', it: 'Bot Discord', de: 'Discord-Bots', es: 'Bots de Discord', pt: 'Bots do Discord', nl: 'Discord-bots', tr: 'Discord botları' } },
  { slug: 'server_setup', icon: 'Server', names: { en: 'Server Setup', ro: 'Configurare server', fr: 'Configuration de serveur', it: 'Configurazione server', de: 'Server-Einrichtung', es: 'Configuración de servidor', pt: 'Configuração de servidor', nl: 'Serverinrichting', tr: 'Sunucu kurulumu' } },
  { slug: 'graphic_design', icon: 'Palette', names: { en: 'Graphic Design', ro: 'Design grafic', fr: 'Design graphique', it: 'Grafica', de: 'Grafikdesign', es: 'Diseño gráfico', pt: 'Design gráfico', nl: 'Grafisch ontwerp', tr: 'Grafik tasarım' } },
  { slug: 'video_editing', icon: 'Clapperboard', names: { en: 'Video Editing', ro: 'Editare video', fr: 'Montage vidéo', it: 'Montaggio video', de: 'Videobearbeitung', es: 'Edición de video', pt: 'Edição de vídeo', nl: 'Videobewerking', tr: 'Video düzenleme' } },
  { slug: 'ui_ux_design', icon: 'LayoutTemplate', names: { en: 'UI/UX Design', ro: 'Design UI/UX', fr: 'Design UI/UX', it: 'Design UI/UX', de: 'UI/UX-Design', es: 'Diseño UI/UX', pt: 'Design UI/UX', nl: 'UI/UX-ontwerp', tr: 'UI/UX tasarımı' } },
  { slug: 'programming', icon: 'Code2', names: { en: 'Programming', ro: 'Programare', fr: 'Programmation', it: 'Programmazione', de: 'Programmierung', es: 'Programación', pt: 'Programação', nl: 'Programmeren', tr: 'Programlama' } },
  { slug: 'writing_translation', icon: 'PenLine', names: { en: 'Writing & Translation', ro: 'Scriere și traduceri', fr: 'Rédaction et traduction', it: 'Scrittura e traduzione', de: 'Texten und Übersetzen', es: 'Redacción y traducción', pt: 'Escrita e tradução', nl: 'Schrijven en vertalen', tr: 'Yazı ve çeviri' } },
  { slug: 'audio_production', icon: 'AudioLines', names: { en: 'Audio Production', ro: 'Producție audio', fr: 'Production audio', it: 'Produzione audio', de: 'Audioproduktion', es: 'Producción de audio', pt: 'Produção de áudio', nl: 'Audioproductie', tr: 'Ses prodüksiyonu' } },
  { slug: 'other_services', icon: 'Sparkles', names: { en: 'Other Services', ro: 'Alte servicii', fr: 'Autres services', it: 'Altri servizi', de: 'Weitere Dienste', es: 'Otros servicios', pt: 'Outros serviços', nl: 'Overige diensten', tr: 'Diğer hizmetler' } },
];

export const CATEGORY_RE = /^[a-z][a-z0-9_]{2,39}$/;
export const SERVER_CAT_PREFIX = 'sc_';
export const SERVER_CAT_RE = /^sc_[a-f0-9]{12}$/;
export const isServerCat = (slug) => SERVER_CAT_RE.test(String(slug || ''));
export const SERVER_CAT_ACCESS = ['public', 'roles', 'private'];
export const SERVER_CAT_LIMITS = Object.freeze({ perServer: 5, name: { min: 2, max: 40 }, roles: 10 });
export const SNOWFLAKE_RE = /^\d{15,25}$/;
export const ID_RE = /^[a-f0-9]{24}$/;

export const BLOCKED_HOSTS = [
  'bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'is.gd', 'cutt.ly', 'rb.gy', 'shorturl.at', 'ow.ly', 'rebrand.ly', 'tiny.cc',
  'discord.gift', 'discordapp.gift', 'discord-nitro.com', 'discordnitro.gift', 'steamcommunlty.com', 'grabify.link', 'iplogger.org', '2no.co',
];
