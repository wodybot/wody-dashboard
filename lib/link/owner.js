// Wody Link ownership. A user manages a server here only when Discord says they OWN it right now.
//
// Not used on purpose: canManage(), Administrator, Manage Server, roles, anything the browser sends. The check asks Discord
// (bot token, GET /guilds/{id}) who the current owner is; that call also proves the bot is in the server. Nothing is cached
// for mutations; the only cache is the short-lived OAuth server list used to *offer* choices, and every action re-verifies.
import { getUserGuilds, getBotGuilds } from '@/lib/discord';

const API = 'https://discord.com/api/v10';

export async function liveGuild(guildId) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(`${API}/guilds/${guildId}`, {
        headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` },
        cache: 'no-store',
        signal: AbortSignal.timeout(6000),
      });
      if (res.ok) return { ok: true, guild: await res.json() };
      if (res.status === 403 || res.status === 404) return { ok: false, reason: 'bot_not_in_guild' };
      if (res.status === 429 && attempt === 0) {
        let wait = 1000;
        try { const b = await res.json(); if (typeof b.retry_after === 'number') wait = Math.ceil(b.retry_after * 1000); } catch { /* keep default */ }
        await new Promise((r) => setTimeout(r, Math.min(wait, 2000)));
        continue;
      }
      return { ok: false, reason: 'unavailable' };
    } catch {
      if (attempt === 1) return { ok: false, reason: 'unavailable' };
    }
  }
  return { ok: false, reason: 'unavailable' };
}

export function isOwnerOf(guild, userId) {
  return Boolean(guild?.owner_id) && Boolean(userId) && String(guild.owner_id) === String(userId);
}

const FAIL = {
  bot_not_in_guild: { status: 400, code: 'bot_not_in_guild' },
  unavailable: { status: 503, code: 'discord_unavailable' },
};

/**
 * Backend gate used by every Wody Link operation that names a server.
 * -> { ok: true, guild } | { ok: false, status, code }
 */
export async function requireOwner(session, guildId, { db } = {}) {
  const userId = session?.user?.id;
  if (!userId) return { ok: false, status: 401, code: 'unauthenticated' };
  if (!/^\d{15,25}$/.test(String(guildId || ''))) return { ok: false, status: 400, code: 'invalid_id' };
  if (db) {
    const banned = await db.collection('guild_bans').findOne({ guild_id: String(guildId), active: true });
    if (banned) return { ok: false, status: 403, code: 'guild_banned' };
  }
  const live = await liveGuild(guildId);
  if (!live.ok) return { ok: false, ...FAIL[live.reason] };
  if (!isOwnerOf(live.guild, userId)) return { ok: false, status: 403, code: 'not_server_owner' };
  return { ok: true, guild: live.guild };
}

/** Same gate for several servers at once (all must pass). */
export async function requireOwnerOfAll(session, guildIds, opts) {
  const guilds = {};
  for (const id of [...new Set(guildIds.map(String))]) {
    const r = await requireOwner(session, id, opts);
    if (!r.ok) return { ...r, guild_id: id };
    guilds[id] = r.guild;
  }
  return { ok: true, guilds };
}

/**
 * Offer-only list: servers Discord's OAuth data says the user owns, where Wody is installed.
 * (The OAuth `owner` flag is Discord's own statement; Administrator rights never appear here.)
 */
export async function ownedServers(session) {
  let mine;
  let bot;
  try {
    mine = await getUserGuilds(session.accessToken);
    bot = await getBotGuilds();
  } catch {
    return { unavailable: true, owned: [], withBot: [] };
  }
  const botIds = new Set(bot.map((g) => String(g.id)));
  const owned = mine.filter((g) => g.owner === true);
  return {
    unavailable: false,
    owned: owned.map((g) => String(g.id)),
    withBot: owned.filter((g) => botIds.has(String(g.id))).map((g) => ({ id: String(g.id), name: g.name, icon: g.icon || null })),
    botNames: new Map(bot.map((g) => [String(g.id), { name: g.name, icon: g.icon || null }])),
  };
}
