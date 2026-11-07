// How the dashboard explains an entry of the Error Log. The bot writes a short code (and, when it knows them, the exact permissions
// it lacks and the channel or role involved); this file turns the code into the kind of explanation and the fix to show.

export const PERMISSION_KEYS = Object.freeze([
  'view_channel', 'send_messages', 'send_messages_in_threads', 'read_message_history', 'add_reactions', 'manage_messages',
  'embed_links', 'attach_files', 'use_external_emojis', 'manage_roles', 'manage_channels', 'manage_guild', 'manage_threads',
  'create_public_threads', 'moderate_members', 'kick_members', 'ban_members', 'move_members', 'connect', 'mention_everyone',
  'manage_webhooks', 'manage_nicknames',
]);

const PASSING_FEED = new Set(['feed_rate_limited', 'feed_unavailable', 'feed_bad_data', 'feed_too_big']);
const INPUT_FEED = new Set(['feed_bad_input', 'feed_not_configured', 'feed_blocked']);
const PERMISSION_CODES = new Set(['missing_bot_permissions', 'missing_manage_guild', 'feed_no_permission', 'transcript_send_forbidden', 'channel_delete_forbidden']);

/** The kind of problem behind a code: decides the explanation and the fix that are shown. */
export function errorKind(code) {
  const c = String(code || '');
  if (!c) return 'generic';
  if (PERMISSION_CODES.has(c) || c.endsWith('_missing_permissions') || /(^|_)missing_manage_/.test(c)) return 'permissions';
  if (c.endsWith('channel_missing') || c === 'transcript_destination_unavailable') return 'channel';
  if (c.endsWith('role_missing')) return 'role_missing';
  if (c.endsWith('role_too_high') || c.endsWith('_hierarchy')) return 'role_order';
  if (c === 'role_not_assignable' || c.endsWith('_role_managed')) return 'role_managed';
  if (c.startsWith('card_')) return 'card';
  if (c === 'feed_not_found') return 'feed_source';
  if (PASSING_FEED.has(c)) return 'feed_passing';
  if (INPUT_FEED.has(c)) return 'feed_input';
  if (c === 'module_disabled') return 'module_disabled';
  if (c === 'internal_error' || c === 'lookup_failed') return 'internal';
  if (c === 'reward_nick_owner') return 'owner_nick';
  if (c.endsWith('_failed') || c.endsWith('_forbidden')) return 'refused';
  return 'generic';
}

/** The title key for a code: its own when it has one, the general permission title for "<kind>_missing_permissions". */
export function titleKey(code, has) {
  const c = String(code || '');
  if (c && has(`codes.${c}`)) return `codes.${c}`;
  if (c.endsWith('_missing_permissions')) return 'codes.missing_permissions';
  return null;
}

/** Only known permission names, without duplicates, in a stable order. */
export function cleanPerms(perms) {
  const wanted = new Set(Array.isArray(perms) ? perms.map(String) : []);
  return PERMISSION_KEYS.filter((k) => wanted.has(k));
}

/** A channel id written in the free text of older entries ("<#123>"), when the entry has none of its own. */
export function channelOf(entry) {
  if (entry?.channel_id) return String(entry.channel_id);
  const m = String(entry?.detail || '').match(/<#(\d{15,25})>/);
  return m ? m[1] : null;
}
