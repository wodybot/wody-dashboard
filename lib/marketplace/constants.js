// WODY Marketplace: shared constants (statuses, limits, categories, settings).
// Nothing here talks to the database. The bot (Python) mirrors the few values it
// needs in cogs/marketplace.py; keep both in sync when changing a status name.

export const LOCALES = ['en', 'ro', 'fr', 'it', 'de', 'es', 'pt', 'nl', 'tr'];

// Request lifecycle. Every new request starts in a non-public state.
//   draft                  only the author sees it
//   pending_verification   the automatic Financial Content Guard is running
//   pending_review        held for the Wody team (money detected, reports, guard failure)
//   pending_server         held for the owner of the origin server (only if that server turned approval on)
//   needs_changes          sent back to the author
//   approved               approved, waiting to be published (transient)
//   published              visible to everyone
//   rejected / suspended / expired   never visible
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
});
export const STATUS_LIST = Object.values(STATUS);
// The author may edit the content in these states.
export const EDITABLE = new Set([STATUS.DRAFT, STATUS.NEEDS_CHANGES, STATUS.REJECTED, STATUS.EXPIRED, STATUS.PUBLISHED, STATUS.PENDING_REVIEW, STATUS.PENDING_SERVER]);
// Never shown on any public surface.
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
  drafts: 10,              // drafts per user
  active: 15,              // published or pending requests per user
  perHourSubmit: 6,
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
export const CONTACT_MODES = ['internal', 'discord'];

export const DEFAULT_SETTINGS = Object.freeze({
  // Wody-wide policy (changed from the Owner Panel).
  lifetime_days: 30,            // how long a published request stays visible
  report_threshold: 3,          // distinct reporters that pull a request into the global queue
  edits_need_review: false,     // true = every edit goes to the global queue, not only money
  review_attachments: false,    // true = requests with images always go to the global queue
  public_contact_enabled: true, // master switch for the optional no-login contact form
  ai_moderation: true,          // use the AI provider when one is configured
  submissions_open: true,
});

// Categories. `names` are shown as they are in the dashboard and in the bot, so no
// translation round trip is needed. `icon` is a lucide icon name used by the UI.
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
export const SNOWFLAKE_RE = /^\d{15,25}$/;
export const ID_RE = /^[a-f0-9]{24}$/;

// Hosts whose links are never accepted in a request (URL shorteners and known scam bait).
export const BLOCKED_HOSTS = [
  'bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'is.gd', 'cutt.ly', 'rb.gy', 'shorturl.at', 'ow.ly', 'rebrand.ly', 'tiny.cc',
  'discord.gift', 'discordapp.gift', 'discord-nitro.com', 'discordnitro.gift', 'steamcommunlty.com', 'grabify.link', 'iplogger.org', '2no.co',
];
