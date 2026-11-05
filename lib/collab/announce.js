import { M } from './db.js';
import { LOCALES } from './constants.js';
import { toLong } from '@/lib/mongo';
import { notifyUser } from './notify.js';

const SITE = () => (process.env.NEXT_PUBLIC_BASE_URL || 'https://wody.online').replace(/\/+$/, '');

const COLORS = {
  web_development: 0x3b82f6, discord_bots: 0x5865f2, server_setup: 0x14b8a6, graphic_design: 0xec4899, video_editing: 0xef4444,
  ui_ux_design: 0xa855f7, programming: 0x22c55e, writing_translation: 0xf59e0b, audio_production: 0x06b6d4, other_services: 0xe6cd8c,
};

export const ANNOUNCE_TEXTS = {
  en: { label: 'New collab', cta: 'Click here to read it', by: 'by' },
  ro: { label: 'Colaborare nouă', cta: 'Apasă aici ca să o vezi', by: 'de la' },
  fr: { label: 'Nouvelle collab', cta: 'Cliquez ici pour la lire', by: 'par' },
  it: { label: 'Nuova collab', cta: 'Clicca qui per leggerla', by: 'di' },
  de: { label: 'Neue Kollaboration', cta: 'Hier klicken zum Lesen', by: 'von' },
  es: { label: 'Nueva colaboración', cta: 'Haz clic aquí para verla', by: 'de' },
  pt: { label: 'Nova colaboração', cta: 'Clique aqui para ver', by: 'de' },
  nl: { label: 'Nieuwe collab', cta: 'Klik hier om het te lezen', by: 'door' },
  tr: { label: 'Yeni iş birliği', cta: 'Okumak için buraya tıkla', by: 'kimden' },
};

const plain = (s, n) => String(s ?? '').replace(/[\u0000-\u001f]/g, ' ').replace(/[*_~`|>#@\\[\]()<]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);

let sender = async (channelId, payload) => {
  const { sendGuildMessage } = await import('@/lib/discord');
  return sendGuildMessage(channelId, payload);
};
export function setAnnounceSender(fn) { sender = fn; }
let remover = async (channelId, messageId) => {
  const { deleteGuildMessage } = await import('@/lib/discord');
  return deleteGuildMessage(channelId, messageId);
};
export function setAnnounceRemover(fn) { remover = fn; }

export function buildAnnouncement({ locale, category, categoryName, title, authorName, requestId }) {
  const L = ANNOUNCE_TEXTS[locale] || ANNOUNCE_TEXTS.en;
  const url = `${SITE()}/${LOCALES.includes(locale) ? locale : 'en'}/collab/${String(requestId)}`;
  const name = plain(authorName, 40);
  const lines = [`**${plain(title, 100)}**`];
  if (name) lines.push(`-# ${L.by} ${name}`);
  lines.push(`[${L.cta}](${url})`);
  return {
    flags: 1 << 15,
    components: [{
      type: 17,
      accent_color: COLORS[category] ?? COLORS.other_services,
      components: [
        { type: 10, content: `-# WODY Collab · ${plain(categoryName, 40)}` },
        { type: 10, content: lines.join('\n') },
      ],
    }],
  };
}

export async function announceCollab(db, req, content) {
  try {
    const gid = content?.origin_guild_id;
    if (!gid) return false;
    const srv = await db.collection(M.servers).findOne({ guild_id: gid }, { projection: { announce_channel_id: 1 } });
    const own = String(content.category || '').startsWith('sc_') ? await db.collection(M.serverCategories).findOne({ slug: content.category, guild_id: String(gid) }).catch(() => null) : null;
    const ok = (v) => (v && /^\d{15,25}$/.test(String(v)) ? String(v) : null);
    const targets = [];
    if (ok(own?.channel_id)) targets.push(ok(own.channel_id));
    if (ok(srv?.announce_channel_id) && (!ok(own?.channel_id) || own?.also_default)) targets.push(ok(srv.announce_channel_id));
    const channels = [...new Set(targets)].slice(0, 2);
    if (!channels.length) return false;
    const claim = await db.collection(M.requests).updateOne({ _id: req._id, announced_at: { $exists: false } }, { $set: { announced_at: new Date() } });
    if (!claim.modifiedCount) return false;
    const gs = await db.collection('guild_settings').findOne({ guild_id: toLong(gid) }, { projection: { language: 1 } }).catch(() => null);
    const locale = LOCALES.includes(gs?.language) ? gs.language : 'en';
    const cat = own ? null : (await db.collection(M.categories).findOne({ slug: content.category }).catch(() => null)) || null;
    const categoryName = own?.name || cat?.names?.[locale] || cat?.names?.en || content.category;
    const msg = buildAnnouncement({ locale, category: content.category, categoryName, title: content.title, authorName: req.author?.name, requestId: req._id });
    const sent = [];
    for (const ch of channels) {
      const r = await sender(ch, msg).catch((e) => { console.error('collab announce send', e?.message); return null; });
      if (r?.id) sent.push({ channel_id: String(ch), message_id: String(r.id) });
    }
    if (sent.length) await db.collection(M.requests).updateOne({ _id: req._id }, { $set: { announced_messages: sent } }).catch(() => {});
    return true;
  } catch (e) {
    console.error('collab announce', e?.message);
    return false;
  }
}

export async function notifyOwnerChannelChange(db, { ownerId, guildName, byName, off }) {
  try {
    if (!ownerId) return false;
    await notifyUser(db, ownerId, off ? 'announce_channel_off' : 'announce_channel', { title: guildName, reason: byName || 'an administrator' });
    return true;
  } catch (e) {
    console.error('collab announce owner notice', e?.message);
    return false;
  }
}

export async function retractAnnouncements(db, reqOrId) {
  try {
    const _id = reqOrId?._id ?? reqOrId;
    const req = await db.collection(M.requests).findOne({ _id }, { projection: { announced_messages: 1 } });
    const list = Array.isArray(req?.announced_messages) ? req.announced_messages : [];
    if (!list.length) return 0;
    const left = [];
    for (const m of list) {
      const done = await remover(m.channel_id, m.message_id).catch(() => false);
      if (!done) left.push(m);
    }
    await db.collection(M.requests).updateOne({ _id }, { $set: { announced_messages: left } });
    return list.length - left.length;
  } catch (e) {
    console.error('collab retract', e?.message);
    return 0;
  }
}
