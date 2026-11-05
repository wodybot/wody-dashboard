// What the Wody bot can do in a channel, computed from Discord's own data (roles + channel overwrites) with the documented
// algorithm. Used to offer only eligible channels instantly; the bot re-checks with its gateway cache before activation.
const P = {
  ADMINISTRATOR: 1n << 3n,
  VIEW_CHANNEL: 1n << 10n,
  SEND_MESSAGES: 1n << 11n,
  EMBED_LINKS: 1n << 14n,
  ATTACH_FILES: 1n << 15n,
  READ_MESSAGE_HISTORY: 1n << 16n,
};
const ALL = (1n << 53n) - 1n;

const big = (v) => { try { return BigInt(v ?? 0); } catch { return 0n; } };

export function channelPermissions({ guild, botId, botRoleIds, channel }) {
  if (String(guild.owner_id) === String(botId)) return ALL;
  const roles = new Map((guild.roles || []).map((r) => [String(r.id), r]));
  let perms = big(roles.get(String(guild.id))?.permissions);             // @everyone
  for (const rid of botRoleIds || []) perms |= big(roles.get(String(rid))?.permissions);
  if (perms & P.ADMINISTRATOR) return ALL;

  const overwrites = channel.permission_overwrites || [];
  const ev = overwrites.find((o) => String(o.id) === String(guild.id));
  if (ev) { perms &= ~big(ev.deny); perms |= big(ev.allow); }
  let deny = 0n;
  let allow = 0n;
  for (const o of overwrites) {
    if (Number(o.type) === 0 && (botRoleIds || []).map(String).includes(String(o.id))) { deny |= big(o.deny); allow |= big(o.allow); }
  }
  perms &= ~deny; perms |= allow;
  const me = overwrites.find((o) => Number(o.type) === 1 && String(o.id) === String(botId));
  if (me) { perms &= ~big(me.deny); perms |= big(me.allow); }
  return perms;
}

export function botCan(perms) {
  const has = (p) => (perms & p) === p;
  const view = has(P.VIEW_CHANNEL);
  return {
    view,
    send: view && has(P.SEND_MESSAGES),
    history: view && has(P.READ_MESSAGE_HISTORY),
    embed: view && has(P.EMBED_LINKS),
    attach: view && has(P.ATTACH_FILES),
  };
}

/** Required to relay: see the channel, send, read history. Embeds / attachments only improve fidelity. */
export function eligible(can) {
  return can.view && can.send && can.history;
}

export { P };
