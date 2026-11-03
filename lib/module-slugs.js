export const MODULE_SEO_SLUGS = [
  'tickets', 'automod', 'moderation', 'reaction_roles', 'levels',
  'welcome', 'goodbye', 'captcha', 'giveaways', 'pools', 'suggestions', 'auto_responses', 'custom_commands', 'embeds',
  'scheduled_messages', 'forums', 'logging', 'birthdays', 'invite_tracking', 'lookups', 'feeds', 'community', 'bump',
  'economy', 'blackjack', 'backups', 'temporary_voice', 'youtube_notify', 'stream_notifications',
];

export function hasModulePage(slug) {
  return MODULE_SEO_SLUGS.includes(slug);
}
