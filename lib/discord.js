const API = 'https://discord.com/api/v10';

export const PERM_MANAGE_GUILD = 0x20n;
export const PERM_ADMIN = 0x8n;

// Dashboard access: the server owner always has access, and so does anyone
// holding the Manage Guild or Administrator permission on that server. This
// mirrors the bot's own permission model (see helpers.is_moderator on the
// bot side, which treats administrator/owner/configured mod-role members as
// authorized), previously this was owner-only, which meant a server's own
// moderators/admins could run bot slash commands but couldn't reach the web
// dashboard at all.
export function canManage(permissionsStr, owner) {
  if (owner) return true;
  let perms;
  try {
    perms = BigInt(permissionsStr || 0);
  } catch {
    return false;
  }
  return (perms & PERM_ADMIN) === PERM_ADMIN || (perms & PERM_MANAGE_GUILD) === PERM_MANAGE_GUILD;
}

// -------- Simple in-memory TTL cache (per Node process) --------
const cache = new Map();
function cacheGet(k) {
  const e = cache.get(k);
  if (!e) return null;
  if (Date.now() > e.exp) { cache.delete(k); return null; }
  return e.v;
}
function cacheHas(k) {
  const e = cache.get(k);
  if (!e) return false;
  if (Date.now() > e.exp) { cache.delete(k); return false; }
  return true;
}
function cacheSet(k, v, ttlMs) {
  cache.set(k, { v, exp: Date.now() + ttlMs });
}

export async function exchangeCode(code, redirectUri) {
  const body = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID,
    client_secret: process.env.DISCORD_CLIENT_SECRET,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
  });
  const res = await fetch(`${API}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) throw new Error(`Token exchange failed: ${res.status}`);
  return res.json();
}

export async function getUser(accessToken) {
  const res = await fetch(`${API}/users/@me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error('user fetch failed');
  return res.json();
}

export async function getUserGuilds(accessToken) {
  // Per-token cache with a short TTL. This is NOT a cross-user cache: the
  // key is the user's own access token, so there's no risk of leaking one
  // user's guilds to another. Without this, every single dashboard panel
  // (settings, welcome, automod, tickets, meta, ...) independently re-fetches
  // this endpoint on every request, which quickly hits Discord's rate limit
  // when multiple tabs/guilds are open, Discord then returns 429, which
  // was being silently swallowed into an empty guild list, making the
  // dashboard incorrectly show "forbidden" (403) at random.
  const key = `ug:${accessToken}`;
  const cached = cacheGet(key);
  if (cached) return cached;
  const res = await fetch(`${API}/users/@me/guilds`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  if (res.status === 429) {
    // Rate limited by Discord: reuse the last good value if we have one
    // (even if slightly stale) instead of surfacing a false "forbidden".
    const stale = cache.get(key + ':stale');
    if (stale) return stale.v;
    throw new Error('rate_limited');
  }
  if (!res.ok) throw new Error('guilds fetch failed');
  const data = await res.json();
  cacheSet(key, data, 20_000);
  cache.set(key + ':stale', { v: data });
  return data;
}

export async function getBotUser() {
  const cached = cacheGet('bot:me');
  if (cached) return cached;
  const res = await fetch(`${API}/users/@me`, {
    headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` },
    cache: 'no-store',
  });
  if (!res.ok) return null;
  const data = await res.json();
  cacheSet('bot:me', data, 5 * 60_000);
  return data;
}

// Looks up ANY Discord user by id using the bot's own token, GET
// /users/{id}, which unlike getGuildMember above does not require the
// bot (or anyone) to share a specific guild with them, just that the
// user id exists. Used for the Staff page (see lib/staff.js): the owner
// panel only ever needs a Discord user id to add someone to the team,
// their current username and avatar are then always resolved live from
// here, never typed in or uploaded separately, so a staff member's own
// profile picture/name change on Discord is reflected automatically.
// Cached for 5 minutes per id, same TTL as getBotUser above, this is
// fetched on every public /team page load otherwise.
export async function getDiscordUserById(userId) {
  if (!userId) return null;
  const key = `user:${userId}`;
  // cacheGet() can't distinguish "never fetched" from "fetched and the
  // result was null" on its own (both return null), cacheHas() is the
  // one that actually answers "is there a live entry here at all",
  // needed so a negative-cached bad/removed id (see below) is honored
  // instead of retried on every single request for its 60s window.
  if (cacheHas(key)) return cacheGet(key);
  try {
    const res = await discordFetch(`${API}/users/${userId}`, {
      headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` },
      cache: 'no-store',
    });
    // 404 = Discord genuinely doesn't know this id (deleted/never existed
    // account), that's the only case worth remembering for a bit so a
    // stale/removed entry someone left in the Staff collection doesn't
    // hammer the API on every single /team page load.
    if (res.status === 404) {
      cacheSet(key, null, 60_000);
      return null;
    }
    if (!res.ok) {
      // Anything else (429 rate limit that survived discordFetch's own
      // retry, a 5xx, etc.) is a TRANSIENT failure, not "this person isn't
      // staff anymore". Caching that as null for 60s was exactly what made
      // a team member randomly vanish from the public page for up to a
      // minute, on a burst of parallel /users/{id} calls (one per staff
      // member, see the 'staff' route) hitting Discord's rate limit is
      // routine, and a refresh soon after just replayed the same 60s
      // window. Prefer the last good result instead of a false "gone".
      const stale = cache.get(key + ':stale');
      if (stale) return stale.v;
      return null; // no history yet, but NOT cached, so the very next request tries again immediately
    }
    const data = await res.json();
    cacheSet(key, data, 5 * 60_000);
    cache.set(key + ':stale', { v: data });
    return data;
  } catch {
    const stale = cache.get(key + ':stale');
    if (stale) return stale.v;
    return null;
  }
}

export async function getBotGuilds({ withCounts = false } = {}) {
  // Two separate cache slots: the plain list (used almost everywhere) and
  // the with_counts=true variant (owner panel server lists, which need
  // approximate_member_count / approximate_presence_count).
  const cacheKey = withCounts ? 'bg:all:counts' : 'bg:all';
  const cached = cacheGet(cacheKey);
  if (cached) return cached;
  // Discord returns at most 200 guilds per request and the bot is in more
  // than that, so the list is read page by page (after=<last id>) until a
  // short page comes back. Before, only the first 200 were ever shown, which
  // is why the owner panel's server list and counts were incomplete.
  // A 429 / 5xx / network error is retried; if the whole read still fails the
  // last complete copy is served instead of a partial or empty list.
  const all = [];
  let after = null;
  for (let page = 0; page < 100; page++) {
    const qs = new URLSearchParams({ limit: '200' });
    if (withCounts) qs.set('with_counts', 'true');
    if (after) qs.set('after', after);
    let batch = null;
    let lastStatus = 0;
    for (let attempt = 0; attempt < 4 && batch === null; attempt++) {
      try {
        const res = await fetch(`${API}/users/@me/guilds?${qs}`, {
          headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` },
          cache: 'no-store',
        });
        lastStatus = res.status;
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) { batch = data; break; }
        } else if (res.status === 429) {
          let wait = 1000;
          try {
            const body = await res.json();
            if (typeof body.retry_after === 'number') wait = Math.ceil(body.retry_after * 1000);
          } catch {
            const h = res.headers.get('retry-after');
            if (h) wait = Math.ceil(parseFloat(h) * 1000);
          }
          await new Promise((r) => setTimeout(r, Math.min(wait, 5000)));
          continue;
        } else if (res.status >= 400 && res.status < 500) {
          break; // 401/403: retrying will not help
        }
      } catch {
        /* network error: retry */
      }
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
    if (batch === null) {
      const stale = cache.get(cacheKey + ':stale');
      if (stale) return stale.v;
      throw new Error(`bot guilds fetch failed (${lastStatus})`);
    }
    all.push(...batch);
    if (batch.length < 200) break;
    after = batch[batch.length - 1].id;
  }
  cacheSet(cacheKey, all, 60_000);
  cache.set(cacheKey + ':stale', { v: all, exp: Date.now() + 24 * 3600_000 });
  return all;
}

// Fetch a guild list (channels / roles) with the failure handling the dashboard needs.
// Before, ANY non-OK answer (a Discord 429 rate limit, a 5xx, a network blip) became an
// empty list, and the dashboard then showed "no channels" until the page was reloaded even
// though the server has plenty. Now: wait out Discord's Retry-After once, retry a couple of
// times, fall back to the last good copy, and only if there is really nothing report failure.
async function fetchGuildList(kind, guildId) {
  const key = `${kind}:${guildId}`;
  const cached = cacheGet(key);
  if (cached) return { data: cached, ok: true };
  let lastStatus = 0;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`${API}/guilds/${guildId}/${kind === 'gc' ? 'channels' : 'roles'}`, {
        headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` },
        cache: 'no-store',
      });
      lastStatus = res.status;
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          cacheSet(key, data, 30_000);
          cache.set(key + ':stale', { v: data, exp: Date.now() + 24 * 3600_000 });
          return { data, ok: true };
        }
      } else if (res.status === 429) {
        let wait = 1000;
        try {
          const body = await res.json();
          if (typeof body.retry_after === 'number') wait = Math.ceil(body.retry_after * 1000);
        } catch {
          const header = res.headers.get('retry-after');
          if (header) wait = Math.ceil(parseFloat(header) * 1000);
        }
        await new Promise((r) => setTimeout(r, Math.min(wait, 4000)));
        continue;
      } else if (res.status >= 400 && res.status < 500) {
        break; // 401/403/404: retrying will not help
      }
    } catch {
      /* network error: retry */
    }
    await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
  }
  const stale = cache.get(key + ':stale');
  if (stale) return { data: stale.v, ok: true, stale: true };
  return { data: [], ok: false, status: lastStatus };
}

export async function getGuildChannelsResult(guildId) {
  return fetchGuildList('gc', guildId);
}

export async function getGuildRolesResult(guildId) {
  return fetchGuildList('gr', guildId);
}

export async function getGuildChannels(guildId) {
  return (await fetchGuildList('gc', guildId)).data;
}

// Resolve a guild member's display name (nickname if set, otherwise their
// Discord username) from their user id. Used so the dashboard can show
// people's Discord names instead of raw numeric IDs. Cached briefly per
// guild+user, and never throws, callers get `null` on any failure (left
// the server, bot lost access, rate limited, etc.) and can fall back to
// showing nothing rather than crashing the panel.
export async function getGuildMember(guildId, userId, _retried = false) {
  if (!guildId || !userId) return null;
  const key = `gm:${guildId}:${userId}`;
  if (cacheHas(key)) return cacheGet(key);
  try {
    const res = await fetch(`${API}/guilds/${guildId}/members/${userId}`, {
      headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` },
      cache: 'no-store',
    });
    if (res.status === 429 && !_retried) {
      // Rate-limited, NOT "user left the server", these used to be treated
      // identically, which is why lists of 15-25 members (leaderboard,
      // tickets, reviews) showed a bunch of real members as "Unknown user":
      // the first few requests succeeded, the rest got 429'd and were
      // permanently cached as null for 30s. Wait out Discord's own
      // Retry-After and try once more before giving up.
      let retryAfterMs = 1000;
      try {
        const body = await res.json();
        if (typeof body.retry_after === 'number') retryAfterMs = Math.ceil(body.retry_after * 1000);
      } catch {
        const header = res.headers.get('retry-after');
        if (header) retryAfterMs = Math.ceil(parseFloat(header) * 1000);
      }
      await new Promise((r) => setTimeout(r, Math.min(retryAfterMs, 5000)));
      return getGuildMember(guildId, userId, true);
    }
    if (!res.ok) {
      // Real failures (404 = left the server, 403 = bot kicked, etc.), safe
      // to cache as "unknown" for a bit.
      cacheSet(key, null, 30_000);
      return null;
    }
    const data = await res.json();
    const name = data.nick || data.user?.global_name || data.user?.username || null;
    cacheSet(key, name, 60_000);
    return name;
  } catch {
    return null;
  }
}

// Resolve many user ids at once (small lists only, tickets, leaderboard,
// etc.). Runs the lookups with a small concurrency cap instead of firing
// them all at once, 15-25 simultaneous requests to the same Discord route
// reliably trips the per-route rate limit (see the 429 handling above),
// which used to surface as real members showing "Unknown user".
export async function getGuildMembersMap(guildId, userIds) {
  const unique = Array.from(new Set((userIds || []).filter(Boolean).map(String)));
  const CONCURRENCY = 5;
  const entries = [];
  for (let i = 0; i < unique.length; i += CONCURRENCY) {
    const batch = unique.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map(async (id) => [id, await getGuildMember(guildId, id)]));
    entries.push(...results);
  }
  return new Map(entries);
}

// Same idea as getGuildMember/getGuildMembersMap above, but for the public
// leaderboard page, which needs an avatar to render alongside each name,
// not just a display name. Kept as a separate function (own cache key
// namespace) rather than widening getGuildMember's return shape, so every
// existing caller of the name-only version is unaffected.
//
// Always resolves to { state, name, avatar_url } and NEVER to null. `state`
// is the important part:
//   'member'  -> Discord returned the guild member, they are in the server.
//   'left'    -> Discord answered 404 with code 10007 (Unknown Member): the
//                account exists but is verifiably NOT in this guild.
//   'unknown' -> we could not tell (429 that survived the retries, 5xx,
//                timeout, 401/403, unknown guild, network error...).
// Previously every failure was collapsed into null and the leaderboard
// rendered null as "left the server", so real members showed up as having
// left whenever Discord rate-limited or hiccuped. Only 'left' may be shown
// as left; 'unknown' is rendered like a normal member.
const DISCORD_UNKNOWN_MEMBER = 10007;

async function getGuildMemberProfile(guildId, userId) {
  const unknown = { state: 'unknown', name: null, avatar_url: null };
  if (!guildId || !userId) return unknown;
  const key = `gmp:${guildId}:${userId}`;
  if (cacheHas(key)) return cacheGet(key);

  let result = unknown;
  try {
    let res = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      res = await discordFetch(
        `${API}/guilds/${guildId}/members/${userId}`,
        { headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` }, cache: 'no-store' },
        { retries: 1 },
      );
      if (res.status !== 429) break;
      // Rate-limited is NOT "left the server": honor Discord's own
      // Retry-After and try again, up to a few times.
      let retryAfterMs = 1000;
      try {
        const body = await res.clone().json();
        if (typeof body.retry_after === 'number') retryAfterMs = Math.ceil(body.retry_after * 1000);
      } catch {
        const header = res.headers.get('retry-after');
        if (header) retryAfterMs = Math.ceil(parseFloat(header) * 1000) || 1000;
      }
      await new Promise((r) => setTimeout(r, Math.min(Math.max(retryAfterMs, 250), 5000)));
    }

    if (res && res.ok) {
      const data = await res.json();
      result = {
        state: 'member',
        name: data.nick || data.user?.global_name || data.user?.username || null,
        avatar_url: data.user ? avatarUrl(data.user) : null,
      };
    } else if (res && res.status === 404) {
      let code = null;
      try { code = (await res.json()).code; } catch { /* non-JSON 404 -> stay unknown */ }
      if (code === DISCORD_UNKNOWN_MEMBER) result = { state: 'left', name: null, avatar_url: null };
    }
  } catch {
    result = unknown;
  }

  // Someone who is gone (or whose membership we couldn't verify) still has
  // a real Discord account: show their actual name/avatar instead of
  // "User 123456...". getDiscordUserById never throws.
  if (result.state !== 'member') {
    const u = await getDiscordUserById(userId).catch(() => null);
    if (u) {
      result = { ...result, name: u.global_name || u.username || null, avatar_url: avatarUrl(u) };
    }
  }

  // Confirmed answers are cached; "unknown" is deliberately NOT cached so
  // the next page load re-checks instead of freezing a transient failure.
  if (result.state !== 'unknown') cacheSet(key, result, 60_000);
  return result;
}

export async function getGuildMembersProfileMap(guildId, userIds) {
  const unique = Array.from(new Set((userIds || []).filter(Boolean).map(String)));
  const CONCURRENCY = 5;
  const entries = [];
  for (let i = 0; i < unique.length; i += CONCURRENCY) {
    const batch = unique.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map(async (id) => [id, await getGuildMemberProfile(guildId, id)]));
    entries.push(...results);
  }
  return new Map(entries);
}

// Full raw member payload (roles included), used by the public Captcha
// verify endpoint to confirm someone actually belongs to the guild before
// granting a role. getGuildMember() above intentionally only returns a
// display name for the existing admin panels, this one keeps the full
// object since the caller needs member.roles.
export async function getGuildMemberRaw(guildId, userId) {
  if (!guildId || !userId) return null;
  try {
    const res = await discordFetch(`${API}/guilds/${guildId}/members/${userId}`, {
      headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// Grants a single role to a guild member using the bot's own token. Used
// only by the Captcha verification flow (app/api/verify/[guildId]/route.js),
// and only after that route has already confirmed the caller is signed in
// AND is an actual member of the target guild. Discord itself still enforces
// that the bot's top role must sit above the role being granted and that the
// bot has Manage Roles, this just surfaces those failures as a clear
// message instead of a raw HTTP status.
export async function addGuildMemberRole(guildId, userId, roleId, reason) {
  try {
    const res = await discordFetch(`${API}/guilds/${guildId}/members/${userId}/roles/${roleId}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
        ...(reason ? { 'X-Audit-Log-Reason': encodeURIComponent(reason).slice(0, 500) } : {}),
      },
    });
    if (res.status === 204) return { ok: true };
    return { ok: false, status: res.status, detail: await describeFailedResponse(res) };
  } catch (e) {
    return { ok: false, status: 0, detail: String(e.message || e) };
  }
}

export async function getGuildRoles(guildId) {
  return (await fetchGuildList('gr', guildId)).data;
}

// -------- Bot-token message helpers (used by dashboard-driven creation flows,
// e.g. giveaways / reaction-roles created from the web UI instead of Discord
// slash commands). These call the Discord REST API directly with the bot
// token, the same credential already used for channels/roles above. --------

// Custom emoji pasted from Discord (e.g. "<:name:123456789012345678>" or the
// animated "<a:name:123...>") must be sent to the reactions endpoint as
// "name:id", no angle brackets, no "a:" prefix. Unicode emoji pass through
// unchanged. We keep the *original* string in the database (that's what the
// bot's on_raw_reaction_add listener compares against), and only transform it
// right before hitting the reactions endpoint.
export function emojiForReactionEndpoint(raw) {
  const m = String(raw || '').trim().match(/^<a?:(\w+):(\d+)>$/);
  if (m) return `${m[1]}:${m[2]}`;
  return String(raw || '').trim();
}

// Discord's own edge occasionally returns a bare 502/503/504 with an HTML
// error page instead of JSON (a Cloudflare/edge-level hiccup in front of
// Discord's API, not something wrong with our request), this happens more
// than you'd expect and used to surface as a wall of raw HTML in the
// dashboard's error toast (see route.js embeds/send). Two problems fixed
// here for every bot-token call below:
//   1. No timeout existed at all, a hung Discord edge could block the
//      request indefinitely instead of failing fast.
//   2. No retry on a transient 5xx, one Discord-side blip immediately
//      failed the user's action instead of quietly recovering.
// DISCORD_FETCH_TIMEOUT_MS caps how long we wait per attempt.
// Retrying a POST that creates a message is not perfectly safe (the first
// attempt could in rare cases have actually gone through even though we
// got a 5xx/timeout), but a genuine double-post from this is far rarer in
// practice than the current guaranteed failure on any edge hiccup, so this
// still nets out as a real improvement for send/edit/delete/react.
const DISCORD_FETCH_TIMEOUT_MS = 15_000;
const RETRYABLE_STATUS = new Set([429, 502, 503, 504]);

async function discordFetch(url, options, { retries = 1 } = {}) {
  for (let attempt = 0; ; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DISCORD_FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      if (RETRYABLE_STATUS.has(res.status) && attempt < retries) {
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
        continue;
      }
      return res;
    } catch (e) {
      // Network error or our own timeout abort, retry once the same way.
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
        continue;
      }
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }
}

// Turns a failed response into a short, human-readable message instead of
// ever leaking a raw HTML error page (Discord edge outage pages, proxy
// timeout pages, etc.) into the UI.
async function describeFailedResponse(res) {
  const raw = await res.text().catch(() => '');
  const trimmed = raw.trim();
  if (!trimmed || trimmed.startsWith('<')) {
    return `Discord's API is temporarily unavailable (HTTP ${res.status}). Please try again in a moment.`;
  }
  try {
    const data = JSON.parse(trimmed);
    return data.message || trimmed.slice(0, 300);
  } catch {
    return trimmed.slice(0, 300);
  }
}

// Sets (or, with an empty value, removes) the bot's own nickname in one
// server: PATCH /guilds/{id}/members/@me, bot token. Needs the bot's
// "Change Nickname" permission there. Returns { ok, status }.
export async function setBotNickname(guildId, nick) {
  const res = await discordFetch(`${API}/guilds/${guildId}/members/@me`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
      'Content-Type': 'application/json',
      'X-Audit-Log-Reason': encodeURIComponent('Nickname changed from the Wody dashboard'),
    },
    body: JSON.stringify({ nick: nick || null }),
  });
  return { ok: res.ok, status: res.status };
}

export async function sendGuildMessage(channelId, payload) {
  const res = await discordFetch(`${API}/channels/${channelId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Discord message send failed (${res.status}): ${await describeFailedResponse(res)}`);
  }
  return res.json();
}

export async function editGuildMessage(channelId, messageId, payload) {
  const res = await discordFetch(`${API}/channels/${channelId}/messages/${messageId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  return res.ok ? res.json() : null;
}

export async function deleteGuildMessage(channelId, messageId) {
  const res = await discordFetch(`${API}/channels/${channelId}/messages/${messageId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` },
  });
  return res.ok || res.status === 404;
}

export async function addMessageReaction(channelId, messageId, emoji) {
  const enc = encodeURIComponent(emojiForReactionEndpoint(emoji));
  const res = await discordFetch(`${API}/channels/${channelId}/messages/${messageId}/reactions/${enc}/@me`, {
    method: 'PUT',
    headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` },
  });
  return res.ok;
}

export function avatarUrl(user) {
  if (!user) return null;
  if (user.avatar) {
    const ext = user.avatar.startsWith('a_') ? 'gif' : 'png';
    return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${ext}?size=128`;
  }
  const disc = parseInt(user.discriminator || '0', 10);
  return `https://cdn.discordapp.com/embed/avatars/${disc % 5}.png`;
}

export function guildIconUrl(g) {
  if (!g?.icon) return null;
  const ext = g.icon.startsWith('a_') ? 'gif' : 'png';
  return `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.${ext}?size=128`;
}

// A Discord attachment CDN URL (cdn.discordapp.com/attachments/... or
// media.discordapp.net/attachments/...) carries a signed, time-limited
// `ex=`/`is=`/`hm=` query string, typically valid roughly a day from
// whenever Discord last issued it. Pasting one of these into "Discord
// Link Preview" media_url (the easiest way for a non-technical owner to
// get an image URL: upload it in a Discord DM/channel, copy the link)
// therefore looks fine at save time and then goes broken/grey a few days
// later once that signature expires, exactly the symptom reported: this
// is the fix, called every time the stored URL is about to be served
// rather than only once at save time, since a URL months old needs
// refreshing just as much as one from yesterday.
const ATTACHMENT_URL_RE = /^https:\/\/(cdn\.discordapp\.com|media\.discordapp\.net)\/attachments\//i;

export async function refreshDiscordAttachmentUrl(url) {
  if (!url || !ATTACHMENT_URL_RE.test(url)) return url;
  const key = `attrefresh:${url}`;
  if (cacheHas(key)) return cacheGet(key);
  try {
    const res = await fetch(`${API}/attachments/refresh-urls`, {
      method: 'POST',
      headers: {
        Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ attachment_urls: [url] }),
      cache: 'no-store',
    });
    if (!res.ok) return url;
    const data = await res.json();
    const fresh = data?.refreshed_urls?.[0]?.refreshed || url;
    // Cached well under Discord's own ~24h signature lifetime, so this
    // never hands out a URL that's about to expire again.
    cacheSet(key, fresh, 6 * 3600_000);
    return fresh;
  } catch {
    return url;
  }
}


// Owner-enforcement helpers. These are intentionally narrow bot-token calls:
// the owner-only API route decides authorization and persistence first, then
// uses these helpers to notify the guild owner and remove the bot.
export async function getBotGuild(guildId, { withCounts = false } = {}) {
  const suffix = withCounts ? "?with_counts=true" : "";
  const res = await discordFetch(`${API}/guilds/${guildId}${suffix}`, {
    headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` },
  });
  return res.ok ? res.json() : null;
}

// Member count of a server for the dashboard's General tab. getBotGuild() above
// is a live Discord call every time (and returns the whole guild object), which
// made the "Server Information" numbers slow to appear. This keeps only the two
// count fields, caches them for a minute per server and lets simultaneous
// requests share one Discord call. Once a value is known, a slow Discord (> 2.5 s)
// never holds the page back: the last known count is returned and refreshed in
// the background. getBotGuild() itself is unchanged (owner enforcement etc. still
// read the live guild object).
const guildCountsInflight = new Map();
export async function getBotGuildCounts(guildId, { ttlMs = 60_000, slowMs = 2_500 } = {}) {
  const key = `guild:counts:${guildId}`;
  const cached = cacheGet(key);
  if (cached) return cached;
  const stale = cache.get(`${key}:stale`)?.v || null;
  let live = guildCountsInflight.get(key);
  if (!live) {
    live = (async () => {
      let g;
      try {
        g = await getBotGuild(guildId, { withCounts: true });
      } catch (e) {
        if (stale) return stale;
        throw e;
      }
      if (!g) return stale;
      const slim = { approximate_member_count: g.approximate_member_count, member_count: g.member_count };
      cacheSet(key, slim, ttlMs);
      cache.set(`${key}:stale`, { v: slim });
      return slim;
    })().finally(() => guildCountsInflight.delete(key));
    guildCountsInflight.set(key, live);
  }
  if (!stale) return live;
  let timer;
  const slow = new Promise((resolve) => { timer = setTimeout(() => resolve(stale), slowMs); });
  return Promise.race([live, slow]).finally(() => clearTimeout(timer));
}

const SUPPRESS_EMBEDS = 1 << 2;
export async function sendDirectMessage(userId, payload) {
  const headers = {
    Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
    'Content-Type': 'application/json',
  };
  const dm = await discordFetch(`${API}/users/@me/channels`, {
    method: 'POST', headers, body: JSON.stringify({ recipient_id: String(userId) }),
  });
  if (!dm.ok) throw new Error(`Discord DM channel failed (${dm.status})`);
  const channel = await dm.json();
  // No link preview (image + text card) under DMs sent from the dashboard. Skipped for Components v2 and
  // for messages that carry their own embeds, where it would hide what is meant to be shown.
  const body = { ...payload };
  const isV2 = (Number(body.flags) || 0) & IS_COMPONENTS_V2;
  if (!isV2 && !(Array.isArray(body.embeds) && body.embeds.length)) body.flags = (Number(body.flags) || 0) | SUPPRESS_EMBEDS;
  return sendGuildMessage(channel.id, body);
}

export async function leaveGuild(guildId) {
  const res = await discordFetch(`${API}/users/@me/guilds/${guildId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` },
  });
  return res.ok || res.status === 404;
}

// ---------------------------------------------------------------------- //
// Components v2 payload builder, the Node-side equivalent of the Python
// bot's embed_to_v2_view()/embed_to_v2_container() helpers (see helpers.py).
// Every message this dashboard posts directly to Discord (ticket panels,
// captcha panels) goes through this instead of the legacy `embeds` field,
// so the whole product renders consistently on the newer component system
// instead of half the app using Components v2 and half still on classic
// embeds.
// ---------------------------------------------------------------------- //
export const IS_COMPONENTS_V2 = 1 << 15;

// Component type numbers, per Discord's Components v2 reference.
const COMPONENT_TYPE = {
  ACTION_ROW: 1,
  TEXT_DISPLAY: 10,
  SECTION: 9,
  THUMBNAIL: 11,
  MEDIA_GALLERY: 12,
  SEPARATOR: 14,
  CONTAINER: 17,
};

/**
 * Rebuild a classic embed object ({ title, description, color, footer,
 * image, thumbnail, fields, author }) as a Components v2 Container,
 * carrying the same information. `buttonRows` are existing type-1 ActionRow
 * objects (as already built by ticketPanelComponents()/
 * captchaPanelComponents()) and are attached inside this same container.
 */
export function embedToV2Container(embed, buttonRows = []) {
  const children = [];

  const headerLines = [];
  if (embed.author?.name) headerLines.push(`-# ${embed.author.name}`);
  if (embed.title) headerLines.push(`## ${embed.title}`);
  const headerText = headerLines.join('\n');
  const bodyText = embed.description || '';
  const textBlock = [headerText, bodyText].filter(Boolean).join('\n\n');

  const thumbUrl = embed.thumbnail?.url;
  if (textBlock && thumbUrl) {
    children.push({
      type: COMPONENT_TYPE.SECTION,
      components: [{ type: COMPONENT_TYPE.TEXT_DISPLAY, content: textBlock }],
      accessory: { type: COMPONENT_TYPE.THUMBNAIL, media: { url: thumbUrl } },
    });
  } else if (textBlock) {
    children.push({ type: COMPONENT_TYPE.TEXT_DISPLAY, content: textBlock });
  } else if (thumbUrl) {
    children.push({ type: COMPONENT_TYPE.MEDIA_GALLERY, items: [{ media: { url: thumbUrl } }] });
  }

  for (const f of embed.fields || []) {
    children.push({ type: COMPONENT_TYPE.TEXT_DISPLAY, content: `**${f.name || ''}**\n${f.value || ''}` });
  }

  if (embed.image?.url) {
    children.push({ type: COMPONENT_TYPE.MEDIA_GALLERY, items: [{ media: { url: embed.image.url } }] });
  }

  const footerText = embed.footer?.text;
  if (footerText) {
    children.push({ type: COMPONENT_TYPE.SEPARATOR, divider: true, spacing: 1 });
    children.push({ type: COMPONENT_TYPE.TEXT_DISPLAY, content: `-# ${footerText}` });
  }

  for (const row of buttonRows) children.push(row);

  if (children.length === 0) children.push({ type: COMPONENT_TYPE.TEXT_DISPLAY, content: '\u200b' });

  const container = { type: COMPONENT_TYPE.CONTAINER, components: children };
  if (typeof embed.color === 'number') container.accent_color = embed.color;
  return container;
}

/**
 * Full message payload ({ flags, components }) for sendGuildMessage()/
 * editGuildMessage(), replacing the legacy `{ embeds, components }` shape.
 * A Components v2 message can't carry `content` or `embeds` at all once
 * flagged, so any plain-text line (a ping, etc.) goes in `extraText`
 * instead and renders as its own text line above the container.
 */
export function embedToV2Payload(embed, buttonRows = [], extraText = null) {
  const topLevel = [];
  if (extraText) topLevel.push({ type: COMPONENT_TYPE.TEXT_DISPLAY, content: extraText });
  topLevel.push(embedToV2Container(embed, buttonRows));
  return { flags: IS_COMPONENTS_V2, components: topLevel };
}

// Search members of one guild by name (Discord's own member search, bot
// token). Used by the Birthdays admin to find a member. Never throws.
export async function searchGuildMembers(guildId, query, limit = 10) {
  const q = String(query || '').trim();
  if (!guildId || q.length < 1) return [];
  try {
    const url = `${API}/guilds/${guildId}/members/search?query=${encodeURIComponent(q.slice(0, 32))}&limit=${Math.min(25, limit)}`;
    const res = await discordFetch(url, { headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` }, cache: 'no-store' }, { retries: 1 });
    if (!res.ok) return [];
    const rows = await res.json();
    return rows.filter((m) => m.user && !m.user.bot).map((m) => ({
      id: m.user.id,
      name: m.nick || m.user.global_name || m.user.username,
      username: m.user.username,
      avatar_url: avatarUrl(m.user),
    }));
  } catch {
    return [];
  }
}

// Community Discovery: resolve a public invite through the official API.
// Returns null when the invite is unknown, expired or revoked.
export async function getInvite(code) {
  if (!/^[A-Za-z0-9-]{2,32}$/.test(String(code || ''))) return null;
  const res = await discordFetch(`${API}/invites/${code}?with_counts=true&with_expiration=true`, {
    headers: process.env.DISCORD_BOT_TOKEN ? { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` } : {},
    cache: 'no-store',
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`invite lookup failed (${res.status})`);
  return res.json();
}

// Creation time encoded in a Discord snowflake.
export function snowflakeDate(id) {
  try { return new Date(Number((BigInt(id) >> 22n) + 1420070400000n)); } catch { return null; }
}

// -------- Auto-join the Wody community server (login "Join our Discord") --------
// Uses the official OAuth2 flow: the visitor ticked the checkbox and approved
// the "guilds.join" scope on Discord's own consent screen, then the bot adds
// them with PUT /guilds/{id}/members/{user.id}. Requirements: the bot is in
// the community server and has the Create Invite permission there.
// The server id comes from DISCORD_COMMUNITY_GUILD_ID, or (when unset) is read
// from the public community invite code once and kept in memory.
const COMMUNITY_INVITE_CODE = 'z9Jvp2V7Eh';
let communityGuildIdCache = null;

async function getCommunityGuildId() {
  const fromEnv = (process.env.DISCORD_COMMUNITY_GUILD_ID || '').trim();
  if (/^\d{15,25}$/.test(fromEnv)) return fromEnv;
  if (communityGuildIdCache) return communityGuildIdCache;
  const res = await fetch(`${API}/invites/${COMMUNITY_INVITE_CODE}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`community invite lookup failed: ${res.status}`);
  const inv = await res.json();
  const id = inv?.guild?.id || inv?.guild_id;
  if (!id) throw new Error('community invite has no guild');
  communityGuildIdCache = String(id);
  return communityGuildIdCache;
}

// Returns 'joined' (201), 'already' (204) or throws on failure.
export async function joinCommunityGuild(userId, accessToken) {
  if (!userId || !accessToken) throw new Error('missing user or token');
  const guildId = await getCommunityGuildId();
  const res = await fetch(`${API}/guilds/${guildId}/members/${userId}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ access_token: accessToken }),
    cache: 'no-store',
  });
  if (res.status === 201) return 'joined';
  if (res.status === 204) return 'already';
  throw new Error(`community join failed: ${res.status} ${await res.text().catch(() => '')}`);
}
