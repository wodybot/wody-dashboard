// Modules that have their own page under /modules/<key>. Kept apart from lib/module-seo.js (which carries all the page copy)
// so client components can use the list without bundling the copy.
export const MODULE_SEO_SLUGS = [
  'tickets', 'automod', 'moderation', 'reaction_roles', 'levels',
  'welcome', 'goodbye', 'captcha', 'giveaways', 'pools', 'suggestions', 'auto_responses', 'custom_commands', 'embeds',
  'scheduled_messages', 'forums', 'logging', 'birthdays', 'invite_tracking', 'lookups', 'feeds', 'community', 'bump',
  'economy', 'blackjack', 'backups', 'temporary_voice', 'youtube_notify', 'stream_notifications',
];

export function hasModulePage(slug) {
  return MODULE_SEO_SLUGS.includes(slug);
}
