import crypto from 'node:crypto';

const PLACEHOLDER = /replace|changeme|change_me|your[_-]|example\.com|<.*>/i;
const digits = (v) => /^\d{15,21}$/.test(v);
const https = (v) => /^https:\/\/[^\s/]+(\/\S*)?$/.test(v);
const min = (n) => (v) => v.length >= n;
const botToken = (v) => /^[\w-]{20,}\.[\w-]{5,}\.[\w-]{20,}$/.test(v);
const idList = (v) => v.split(',').map((x) => x.trim()).filter(Boolean).every(digits);
const origin = (v) => v === '*' ? false : v.split(',').map((x) => x.trim()).every((x) => /^https?:\/\/[^\s/]+$/.test(x));
const emoji = (v) => v.length >= 1;

const SPEC = [
  ['NEXT_PUBLIC_BASE_URL', 'Core', true, https, 'Canonical links, sitemap, social cards and OAuth return address.'],
  ['SESSION_SECRET', 'Core', true, min(32), 'Signs login sessions. Needs at least 32 random characters.'],
  ['BOT_MONGO_URL', 'Core', true, (v) => /^mongodb(\+srv)?:\/\//.test(v), 'Database connection. Without it most pages show an error.'],
  ['BOT_MONGO_DB', 'Core', false, null, 'Database name. Must match MONGODB_DB on the bot.'],
  ['DISCORD_BOT_TOKEN', 'Discord', true, botToken, 'Reads servers, channels and roles for the dashboard.'],
  ['DISCORD_CLIENT_ID', 'Discord', true, digits, 'Discord login and the invite link.'],
  ['DISCORD_CLIENT_SECRET', 'Discord', true, min(20), 'Discord login. Wrong value means nobody can sign in.'],
  ['DISCORD_REDIRECT_URI', 'Discord', true, https, 'Must be listed in the Discord application and sit on the same host as NEXT_PUBLIC_BASE_URL.'],
  ['DISCORD_OWNER_ID', 'Discord', true, digits, 'Who can open this panel.'],
  ['NEXT_PUBLIC_DISCORD_OWNER_ID', 'Discord', false, digits, 'Shows the owner link in the interface. Should equal DISCORD_OWNER_ID.'],
  ['CRON_SECRET', 'Security', false, min(16), 'Protects scheduled endpoints.'],
  ['HUMANCHECK_SECRET', 'Security', false, min(16), 'Signs the human check on public forms.'],
  ['STREAMS_TOKEN_KEY', 'Security', false, min(32), 'Encrypts linked streamer tokens. Must be identical on the bot.'],
  ['TWITCH_CLIENT_ID', 'Streams', false, min(10), 'Twitch notifications.'],
  ['TWITCH_CLIENT_SECRET', 'Streams', false, min(10), 'Twitch notifications.'],
  ['KICK_CLIENT_ID', 'Streams', false, min(10), 'Kick notifications.'],
  ['KICK_CLIENT_SECRET', 'Streams', false, min(10), 'Kick notifications.'],
  ['TIKTOK_CLIENT_KEY', 'Streams', false, min(10), 'TikTok notifications.'],
  ['TIKTOK_CLIENT_SECRET', 'Streams', false, min(10), 'TikTok notifications.'],
  ['YOUTUBE_API_KEY', 'YouTube', false, min(20), 'YouTube channel lookup when adding a notification.'],
  ['WEBSUB_CALLBACK_BASE_URL', 'YouTube', false, https, 'Public address of the bot for instant YouTube pushes.'],
  ['WEBSUB_HUB_URL', 'YouTube', false, https, 'WebSub hub (defaults to the public Google hub).'],
  ['YOUTUBE_NOTIFY_MAX_CHANNELS', 'YouTube', false, (v) => /^\d{1,3}$/.test(v), 'Channel limit per server.'],
  ['OWNER_AUDIT_CHANNEL_ID', 'Community', false, digits, 'Owner actions are logged in this channel.'],
  ['UPDATES_ANNOUNCE_CHANNEL_ID', 'Community', false, digits, 'New updates are announced in this channel.'],
  ['DISCORD_COMMUNITY_GUILD_ID', 'Community', false, digits, 'Support server used for Community and Marketplace.'],
  ['COMMUNITY_REVIEW_LOG_CHANNEL_ID', 'Community', false, digits, 'Server review log.'],
  ['COMMUNITY_ADMIN_IDS', 'Community', false, idList, 'Comma separated ids of extra reviewers.'],
  ['MARKETPLACE_AI_URL', 'Marketplace AI', false, https, 'Endpoint of the model that reviews listings.'],
  ['MARKETPLACE_AI_KEY', 'Marketplace AI', false, min(10), 'Key for that endpoint.'],
  ['MARKETPLACE_AI_MODEL', 'Marketplace AI', false, null, 'Model name.'],
  ['CORS_ORIGINS', 'Other', false, origin, 'Allowed outside origins for the public API. Never "*".'],
];

export function stateOf(value, required, check) {
  const v = String(value || '').trim();
  if (!v) return required ? 'missing' : 'unset';
  if (PLACEHOLDER.test(v)) return 'placeholder';
  if (check && !check(v)) return 'invalid';
  return 'ok';
}

export function configGroups(env = process.env) {
  const groups = [];
  for (const [name, group, required, check, info] of SPEC) {
    let g = groups.find((x) => x.name === group);
    if (!g) { g = { name: group, items: [] }; groups.push(g); }
    g.items.push({ name, required, info, state: stateOf(env[name], required, check) });
  }
  const item = (n) => groups.flatMap((g) => g.items).find((i) => i.name === n);
  const host = (u) => { try { return new URL(u).host; } catch { return null; } };
  const red = item('DISCORD_REDIRECT_URI');
  if (red.state === 'ok' && host(env.DISCORD_REDIRECT_URI) !== host(env.NEXT_PUBLIC_BASE_URL)) {
    red.state = 'invalid'; red.info = 'Host differs from NEXT_PUBLIC_BASE_URL, so login returns to the wrong site.';
  }
  const pub = item('NEXT_PUBLIC_DISCORD_OWNER_ID');
  if (pub.state === 'ok' && String(env.NEXT_PUBLIC_DISCORD_OWNER_ID).trim() !== String(env.DISCORD_OWNER_ID || '').trim()) {
    pub.state = 'invalid'; pub.info = 'Differs from DISCORD_OWNER_ID.';
  }
  return groups;
}

export function fingerprint(value) {
  const v = String(value || '').trim();
  return v ? crypto.createHash('sha256').update(v, 'utf8').digest('hex').slice(0, 8) : null;
}

export function botComparison(botDoc, env = process.env) {
  const out = [];
  const shared = botDoc?.shared;
  if (!shared) return out;
  const ours = fingerprint(env.STREAMS_TOKEN_KEY);
  if (shared.STREAMS_TOKEN_KEY && ours) {
    out.push({ id: 'streams_key', label: 'STREAMS_TOKEN_KEY is identical on bot and dashboard',
      state: shared.STREAMS_TOKEN_KEY === ours ? 'ok' : 'fail',
      detail: shared.STREAMS_TOKEN_KEY === ours ? 'Same key on both sides.' : 'The keys differ. Stream tokens saved by one side cannot be read by the other.' });
  } else if (ours || shared.STREAMS_TOKEN_KEY) {
    out.push({ id: 'streams_key', label: 'STREAMS_TOKEN_KEY is identical on bot and dashboard', state: 'fail',
      detail: ours ? 'Set here but not on the bot.' : 'Set on the bot but not here.' });
  }
  const db = String(env.BOT_MONGO_DB || '').trim();
  if (shared.MONGODB_DB && db) {
    out.push({ id: 'db_name', label: 'Same database name on bot and dashboard', state: shared.MONGODB_DB === db ? 'ok' : 'fail',
      detail: shared.MONGODB_DB === db ? 'Match.' : 'BOT_MONGO_DB differs from the bot\'s MONGODB_DB.' });
  }
  return out;
}

const withTimeout = async (fn, ms = 7000) => {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try { return await fn(ctl.signal); } finally { clearTimeout(timer); }
};

async function run(id, label, fn) {
  try {
    const r = await fn();
    return { id, label, state: r.state, detail: r.detail };
  } catch (e) {
    return { id, label, state: 'fail', detail: e?.name === 'AbortError' ? 'No answer within 7 seconds.' : 'The request could not be completed.' };
  }
}

const skip = (id, label, why) => ({ id, label, state: 'skipped', detail: why });
const has = (k) => Boolean(String(process.env[k] || '').trim());

export async function liveChecks({ db }) {
  const checks = [];
  const E = process.env;
  checks.push(run('mongo', 'Database answers', async () => {
    if (!has('BOT_MONGO_URL')) return { state: 'skipped', detail: 'BOT_MONGO_URL is not set.' };
    await db.command({ ping: 1 });
    const hb = await db.collection('bot_status').findOne({ _id: 'heartbeat' }, { projection: { last_heartbeat: 1 } });
    const age = hb?.last_heartbeat ? Date.now() - new Date(hb.last_heartbeat).getTime() : null;
    if (age == null) return { state: 'warn', detail: 'Connected, but the bot has never written a heartbeat here. Check that the bot uses the same database.' };
    return age < 90_000 ? { state: 'ok', detail: 'Connected and the bot is writing heartbeats.' } : { state: 'warn', detail: 'Connected, but the bot heartbeat is older than 90 seconds (bot offline?).' };
  }));
  const botAuth = () => ({ Authorization: `Bot ${E.DISCORD_BOT_TOKEN}` });
  checks.push(run('bot_token', 'Discord bot token is accepted', async () => {
    if (!has('DISCORD_BOT_TOKEN')) return { state: 'skipped', detail: 'DISCORD_BOT_TOKEN is not set.' };
    const r = await withTimeout((signal) => fetch('https://discord.com/api/v10/users/@me', { headers: botAuth(), signal, cache: 'no-store' }));
    if (r.status === 401) return { state: 'fail', detail: 'Discord rejected the token (reset it in the Developer Portal and update the variable).' };
    if (!r.ok) return { state: 'fail', detail: `Discord answered ${r.status}.` };
    const u = await r.json();
    if (has('DISCORD_CLIENT_ID') && String(u.id) !== String(E.DISCORD_CLIENT_ID).trim()) return { state: 'fail', detail: 'The token belongs to a different application than DISCORD_CLIENT_ID.' };
    return { state: 'ok', detail: 'Token valid and matches DISCORD_CLIENT_ID.' };
  }));
  checks.push(run('oauth', 'Discord login (client id + secret) works', async () => {
    if (!has('DISCORD_CLIENT_ID') || !has('DISCORD_CLIENT_SECRET')) return { state: 'skipped', detail: 'Client id or secret is not set.' };
    const r = await withTimeout((signal) => fetch('https://discord.com/api/v10/oauth2/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, signal, cache: 'no-store',
      body: new URLSearchParams({ grant_type: 'client_credentials', scope: 'identify', client_id: E.DISCORD_CLIENT_ID, client_secret: E.DISCORD_CLIENT_SECRET }),
    }));
    if (r.ok) return { state: 'ok', detail: 'Discord accepted the client id and secret.' };
    return { state: 'fail', detail: r.status === 401 ? 'Discord rejected the client secret. Copy a fresh one from OAuth2 in the Developer Portal.' : `Discord answered ${r.status}.` };
  }));
  for (const [id, label, key] of [['owner_audit', 'Owner audit channel is visible to the bot', 'OWNER_AUDIT_CHANNEL_ID'], ['updates_channel', 'Updates channel is visible to the bot', 'UPDATES_ANNOUNCE_CHANNEL_ID'], ['review_log', 'Review log channel is visible to the bot', 'COMMUNITY_REVIEW_LOG_CHANNEL_ID']]) {
    checks.push(run(id, label, async () => {
      if (!has(key)) return { state: 'skipped', detail: `${key} is not set.` };
      if (!has('DISCORD_BOT_TOKEN')) return { state: 'skipped', detail: 'No bot token.' };
      const r = await withTimeout((signal) => fetch(`https://discord.com/api/v10/channels/${String(E[key]).trim()}`, { headers: botAuth(), signal, cache: 'no-store' }));
      if (r.ok) return { state: 'ok', detail: 'The bot can see the channel.' };
      return { state: 'fail', detail: r.status === 404 ? 'No such channel.' : r.status === 403 ? 'The bot has no access to that channel.' : `Discord answered ${r.status}.` };
    }));
  }
  checks.push(run('community_guild', 'Support server: the bot is a member', async () => {
    if (!has('DISCORD_COMMUNITY_GUILD_ID')) return { state: 'skipped', detail: 'DISCORD_COMMUNITY_GUILD_ID is not set.' };
    const r = await withTimeout((signal) => fetch(`https://discord.com/api/v10/guilds/${String(E.DISCORD_COMMUNITY_GUILD_ID).trim()}`, { headers: botAuth(), signal, cache: 'no-store' }));
    return r.ok ? { state: 'ok', detail: 'The bot is in that server.' } : { state: 'fail', detail: r.status === 404 || r.status === 403 ? 'The bot is not in that server (or the id is wrong).' : `Discord answered ${r.status}.` };
  }));
  const tokenCheck = (id, label, idKey, secKey, url, bodyFn, notSetMsg) => run(id, label, async () => {
    if (!has(idKey) || !has(secKey)) return { state: 'skipped', detail: notSetMsg };
    const r = await withTimeout((signal) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: bodyFn(), signal, cache: 'no-store' }));
    const j = await r.json().catch(() => ({}));
    if (r.ok && (j.access_token || j.data?.access_token)) return { state: 'ok', detail: 'The service accepted the credentials.' };
    return { state: 'fail', detail: r.status === 400 || r.status === 401 || r.status === 403 ? 'The service rejected the credentials.' : `The service answered ${r.status}.` };
  });
  checks.push(tokenCheck('twitch', 'Twitch credentials work', 'TWITCH_CLIENT_ID', 'TWITCH_CLIENT_SECRET', 'https://id.twitch.tv/oauth2/token',
    () => new URLSearchParams({ client_id: E.TWITCH_CLIENT_ID, client_secret: E.TWITCH_CLIENT_SECRET, grant_type: 'client_credentials' }), 'Twitch client id or secret is not set.'));
  checks.push(tokenCheck('kick', 'Kick credentials work', 'KICK_CLIENT_ID', 'KICK_CLIENT_SECRET', 'https://id.kick.com/oauth/token',
    () => new URLSearchParams({ client_id: E.KICK_CLIENT_ID, client_secret: E.KICK_CLIENT_SECRET, grant_type: 'client_credentials' }), 'Kick client id or secret is not set.'));
  checks.push(tokenCheck('tiktok', 'TikTok credentials work', 'TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_SECRET', 'https://open.tiktokapis.com/v2/oauth/token/',
    () => new URLSearchParams({ client_key: E.TIKTOK_CLIENT_KEY, client_secret: E.TIKTOK_CLIENT_SECRET, grant_type: 'client_credentials' }), 'TikTok client key or secret is not set.'));
  checks.push(run('youtube', 'YouTube API key works', async () => {
    if (!has('YOUTUBE_API_KEY')) return { state: 'skipped', detail: 'YOUTUBE_API_KEY is not set.' };
    const r = await withTimeout((signal) => fetch(`https://www.googleapis.com/youtube/v3/channels?part=id&id=UC_x5XG1OV2P6uZZ5FSM9Ttw&key=${encodeURIComponent(E.YOUTUBE_API_KEY)}`, { signal, cache: 'no-store' }));
    if (r.ok) return { state: 'ok', detail: 'Google accepted the key.' };
    return { state: 'fail', detail: r.status === 400 || r.status === 403 ? 'Google rejected the key (invalid, restricted, or the YouTube Data API is not enabled).' : `Google answered ${r.status}.` };
  }));
  checks.push(run('websub', 'Bot public address answers', async () => {
    if (!has('WEBSUB_CALLBACK_BASE_URL')) return { state: 'skipped', detail: 'WEBSUB_CALLBACK_BASE_URL is not set.' };
    const r = await withTimeout((signal) => fetch(String(E.WEBSUB_CALLBACK_BASE_URL).trim(), { signal, cache: 'no-store', redirect: 'manual' }));
    return { state: 'ok', detail: `The address answered (HTTP ${r.status}).` };
  }));
  return Promise.all(checks);
}
