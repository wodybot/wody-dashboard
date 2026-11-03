import { cleanImageRef, absoluteImage } from '@/lib/site-image-path';

export const UPDATE_LAYOUTS = ['classic', 'poster'];
export const UPDATE_LIMITS = { title: 150, body: 5000, tag: 40, gallery: 4, credits: 8, creditName: 40, creditRole: 40 };

const strip = (v, max) => String(v || '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F<>]/g, '').trim().slice(0, max);

/** Validates the optional presentation fields of an update. Returns { ok, patch } or { ok: false, error }. */
export function parseUpdateExtras(body) {
  const patch = {};
  const layout = String(body.layout || 'classic');
  if (!UPDATE_LAYOUTS.includes(layout)) return { ok: false, error: 'invalid_layout' };
  patch.layout = layout;
  const image = cleanImageRef(body.image_url);
  if (image === null) return { ok: false, error: 'invalid_image' };
  patch.image_url = image;
  const gallery = Array.isArray(body.gallery) ? body.gallery.slice(0, UPDATE_LIMITS.gallery) : [];
  patch.gallery = [];
  for (const g of gallery) {
    const ref = cleanImageRef(g);
    if (ref === null) return { ok: false, error: 'invalid_image' };
    if (ref) patch.gallery.push(ref);
  }
  const credits = Array.isArray(body.credits) ? body.credits.slice(0, UPDATE_LIMITS.credits) : [];
  patch.credits = credits
    .map((c) => ({ name: strip(c?.name, UPDATE_LIMITS.creditName), role: strip(c?.role, UPDATE_LIMITS.creditRole) }))
    .filter((c) => c.name);
  return { ok: true, patch };
}

const TYPE = { SECTION: 9, TEXT: 10, THUMBNAIL: 11, GALLERY: 12, SEPARATOR: 14, CONTAINER: 17 };
const TAG_COLORS = { Feature: 0xc46a2d, Fix: 0x0ea5e9, Announcement: 0x8b5cf6, Update: 0x6b7280 };

export function creditsText(credits) {
  return (credits || []).map((c) => (c.role ? `**${c.name}** · ${c.role}` : `**${c.name}**`)).join('\n');
}

/** The Discord message (Components V2) for an update, built from the stored document. */
export function updateDiscordPayload(item, { siteUrl, avatarUrl }) {
  const id = String(item._id);
  const stamp = `<t:${Math.floor(new Date(item.created_at).getTime() / 1000)}:D>`;
  const children = [];
  const body = String(item.body || '').replace(/!\[[^\]]*\]\([^)]*\)/g, '').trim();
  const room = 3400 - String(creditsText(item.credits)).length;
  const bodyText = body.length > room ? `${body.slice(0, room - 1)}…` : body;
  const abs = (u) => absoluteImage(u, siteUrl);

  if (item.layout === 'poster') {
    children.push({ type: TYPE.GALLERY, items: [{ media: { url: `${siteUrl}/api/update-card/${id}` }, description: String(item.title).slice(0, 200) }] });
    children.push({ type: TYPE.TEXT, content: `-# ${item.tag} · ${stamp}\n\n${bodyText}` });
  } else {
    const head = `-# ${item.tag} · ${stamp}\n## ${item.title}\n\n${bodyText}`;
    if (item.image_url) children.push({ type: TYPE.GALLERY, items: [{ media: { url: abs(item.image_url) } }] });
    children.push(avatarUrl && !item.image_url
      ? { type: TYPE.SECTION, components: [{ type: TYPE.TEXT, content: head }], accessory: { type: TYPE.THUMBNAIL, media: { url: avatarUrl } } }
      : { type: TYPE.TEXT, content: head });
  }
  if (item.gallery?.length) {
    children.push({ type: TYPE.SEPARATOR, divider: true, spacing: 1 });
    children.push({ type: TYPE.GALLERY, items: item.gallery.map((g) => ({ media: { url: abs(g) } })) });
  }
  if (item.credits?.length) {
    children.push({ type: TYPE.SEPARATOR, divider: true, spacing: 1 });
    children.push({ type: TYPE.TEXT, content: `-# Credits:\n${creditsText(item.credits)}` });
  }
  children.push({ type: TYPE.SEPARATOR, divider: true, spacing: 1 });
  children.push({ type: TYPE.TEXT, content: `-# [View this update on the website](${siteUrl}/updates)` });
  return { flags: 1 << 15, components: [{ type: TYPE.CONTAINER, accent_color: TAG_COLORS[item.tag] || TAG_COLORS.Update, components: children }] };
}
