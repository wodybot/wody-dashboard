import { toTokens, iconFileOf } from '@/lib/emoji-icons';

const API = 'https://discord.com/api/v10';

export const PERM_MANAGE_GUILD = 0x20n;
export const PERM_ADMIN = 0x8n;

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

// Several requests of one page ask for the same list at the same moment: they share one call to Discord (and a 429 waits briefly and
// tries once more) instead of each making its own and getting rate limited.
const guildsInFlight = new Map();
export async function getUserGuilds(accessToken) {
  const key = `ug:${accessToken}`;
  const cached = cacheGet(key);
  if (cached) return cached;
  if (guildsInFlight.has(key)) return guildsInFlight.get(key);
  const job = (async () => {
    for (let attempt = 0; ; attempt++) {
      const res = await fetch(`${API}/users/@me/guilds`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
      });
      if (res.status === 429) {
        const stale = cache.get(key + ':stale');
        if (stale) return stale.v;
        const wait = Math.min(3000, Math.max(300, Number(res.headers.get('retry-after') || 1) * 1000));
        if (attempt < 1) { await new Promise((r) => setTimeout(r, wait)); continue; }
        throw new Error('rate_limited');
      }
      if (!res.ok) throw new Error('guilds fetch failed');
      const data = await res.json();
      cacheSet(key, data, 60_000);
      cache.set(key + ':stale', { v: data });
      return data;
    }
  })().finally(() => guildsInFlight.delete(key));
  guildsInFlight.set(key, job);
  return job;
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

export async function getDiscordUserById(userId) {
  if (!userId) return null;
  const key = `user:${userId}`;
  if (cacheHas(key)) return cacheGet(key);
  try {
    const res = await discordFetch(`${API}/users/${userId}`, {
      headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` },
      cache: 'no-store',
    });
    if (res.status === 404) {
      cacheSet(key, null, 60_000);
      return null;
    }
    if (!res.ok) {
      const stale = cache.get(key + ':stale');
      if (stale) return stale.v;
      return null;
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

// The list of servers the bot is in is shared by every visitor. When it expires the last copy is served at once and refreshed in the
// background, so choosing a server never waits for the pages of the Discord list.
const botGuildsInFlight = new Map();
export async function getBotGuilds({ withCounts = false } = {}) {
  const cacheKey = withCounts ? 'bg:all:counts' : 'bg:all';
  const cached = cacheGet(cacheKey);
  if (cached) return cached;
  const stale = cache.get(cacheKey + ':stale');
  const refresh = () => {
    if (!botGuildsInFlight.has(cacheKey)) botGuildsInFlight.set(cacheKey, loadBotGuilds(withCounts).finally(() => botGuildsInFlight.delete(cacheKey)));
    return botGuildsInFlight.get(cacheKey);
  };
  if (stale && Date.now() < stale.exp) { refresh().catch(() => {}); return stale.v; }
  return refresh();
}

async function loadBotGuilds(withCounts) {
  const cacheKey = withCounts ? 'bg:all:counts' : 'bg:all';
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
          break;
        }
      } catch {
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
  cacheSet(cacheKey, all, 120_000);
  cache.set(cacheKey + ':stale', { v: all, exp: Date.now() + 24 * 3600_000 });
  return all;
}

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
        break;
      }
    } catch {
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

export async function getGuildMembersMap(guildId, userIds) {
  const unique = Array.from(new Set((userIds || []).filter(Boolean).map(String)));
  const CONCURRENCY = 13;
  const entries = [];
  for (let i = 0; i < unique.length; i += CONCURRENCY) {
    const batch = unique.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map(async (id) => [id, await getGuildMember(guildId, id)]));
    entries.push(...results);
  }
  return new Map(entries);
}

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
      try { code = (await res.json()).code; } catch { }
      if (code === DISCORD_UNKNOWN_MEMBER) result = { state: 'left', name: null, avatar_url: null };
    }
  } catch {
    result = unknown;
  }

  if (result.state !== 'member') {
    const u = await getDiscordUserById(userId).catch(() => null);
    if (u) {
      result = { ...result, name: u.global_name || u.username || null, avatar_url: avatarUrl(u) };
    }
  }

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


export function emojiForReactionEndpoint(raw) {
  const m = String(raw || '').trim().match(/^<a?:(\w+):(\d+)>$/);
  if (m) return `${m[1]}:${m[2]}`;
  return String(raw || '').trim();
}

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


// Every emoji that leaves the dashboard for Discord is one of the Wody application emoji (wody_bot_<name>): a {wy:name} token or a
// standard emoji written by someone is swapped for it, and one that cannot be resolved is dropped rather than sent as a standard emoji.
let appEmojiCache = { at: 0, map: new Map() };
async function applicationEmojis() {
  if (Date.now() - appEmojiCache.at < 10 * 60_000 && appEmojiCache.map.size) return appEmojiCache.map;
  try {
    const me = await getBotUser();
    if (!me?.id) return appEmojiCache.map;
    const res = await fetch(`${API}/applications/${me.id}/emojis`, { headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` }, cache: 'no-store' });
    if (!res.ok) return appEmojiCache.map;
    const body = await res.json();
    const map = new Map();
    for (const e of body.items || []) if (e?.name?.startsWith('wody_bot_')) map.set(e.name.slice(9), { id: e.id, name: e.name, animated: !!e.animated });
    if (map.size) appEmojiCache = { at: Date.now(), map };
  } catch { /* the cache of the last successful call stays */ }
  return appEmojiCache.map;
}

const TOKEN_G = /(?:\{|\[)wy:([a-z0-9_]+)(?:\}|\])/g;
const iconName = (raw) => {
  const t = String(raw || '').trim();
  const m = t.match(/^(?:\{|\[)wy:([a-z0-9_]+)(?:\}|\])$/);
  if (m) return m[1];
  return iconFileOf(t);
};

/** The payload with every emoji turned into a Wody application emoji. */
export async function withWodyEmojis(payload) {
  const map = await applicationEmojis();
  const markup = (name) => { const e = map.get(name); return e ? `<${e.animated ? 'a' : ''}:${e.name}:${e.id}>` : ''; };
  const text = (str) => toTokens(str).replace(TOKEN_G, (_, name) => markup(name));
  const walk = (node) => {
    if (typeof node === 'string') return text(node);
    if (Array.isArray(node)) return node.map(walk);
    if (!node || typeof node !== 'object') return node;
    const out = {};
    for (const [k, v] of Object.entries(node)) {
      if (k === 'emoji' && v && typeof v === 'object' && typeof v.name === 'string' && !v.id) {
        const e = map.get(iconName(v.name));
        if (e) out.emoji = { id: e.id, name: e.name, animated: e.animated };
        continue;
      }
      out[k] = walk(v);
    }
    return out;
  };
  return walk(payload);
}

export async function sendGuildMessage(channelId, payload) {
  payload = await withWodyEmojis(payload);
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
  payload = await withWodyEmojis(payload);
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
  const name = iconName(emoji);
  if (name) { const e = (await applicationEmojis()).get(name); if (!e) return false; emoji = `<:${e.name}:${e.id}>`; }
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
    cacheSet(key, fresh, 6 * 3600_000);
    return fresh;
  } catch {
    return url;
  }
}


export async function getBotGuild(guildId, { withCounts = false } = {}) {
  const suffix = withCounts ? "?with_counts=true" : "";
  const res = await discordFetch(`${API}/guilds/${guildId}${suffix}`, {
    headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` },
  });
  return res.ok ? res.json() : null;
}

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

export const IS_COMPONENTS_V2 = 1 << 15;

const COMPONENT_TYPE = {
  ACTION_ROW: 1,
  TEXT_DISPLAY: 10,
  SECTION: 9,
  THUMBNAIL: 11,
  MEDIA_GALLERY: 12,
  SEPARATOR: 14,
  CONTAINER: 17,
};

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

export function embedToV2Payload(embed, buttonRows = [], extraText = null) {
  const topLevel = [];
  if (extraText) topLevel.push({ type: COMPONENT_TYPE.TEXT_DISPLAY, content: extraText });
  topLevel.push(embedToV2Container(embed, buttonRows));
  return { flags: IS_COMPONENTS_V2, components: topLevel };
}

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

export function snowflakeDate(id) {
  try { return new Date(Number((BigInt(id) >> 22n) + 1420070400000n)); } catch { return null; }
}

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
