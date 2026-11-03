
export const ADV_MAX_FIELDS = 10;
export const ADV_MAX_BUTTONS = 5;
const MAX_TOTAL_TEXT = 3900;

export function parseAdvancedEmbed(adv, { content = '', embed = null } = {}) {
  const out = { author: null, fields: [], buttons: [] };
  if (!adv || typeof adv !== 'object') return out;
  if (typeof adv.author === 'string' && adv.author.trim()) out.author = adv.author.trim().slice(0, 256);
  if (Array.isArray(adv.fields)) {
    out.fields = adv.fields.slice(0, ADV_MAX_FIELDS).map((f) => ({
      name: String(f?.name || '').trim().slice(0, 256),
      value: String(f?.value || '').trim().slice(0, 1024),
    }));
    if (out.fields.some((f) => !f.name || !f.value)) return { error: 'invalid_field' };
  }
  if (Array.isArray(adv.buttons)) {
    for (const b of adv.buttons.slice(0, ADV_MAX_BUTTONS)) {
      const label = String(b?.label || '').trim().slice(0, 80);
      if (!label) return { error: 'invalid_button_label' };
      let href;
      try {
        const u = new URL(String(b?.url || '').trim());
        if (!['https:', 'http:'].includes(u.protocol) || u.username || u.password || u.href.length > 512) throw new Error('bad_url');
        href = u.href;
      } catch { return { error: 'invalid_button_url' }; }
      const btn = { label, url: href };
      const emoji = String(b?.emoji || '').trim();
      if (emoji) {
        if (emoji.length > 8 || !/\p{Extended_Pictographic}/u.test(emoji)) return { error: 'invalid_button_emoji' };
        btn.emoji = emoji;
      }
      out.buttons.push(btn);
    }
  }
  const total = [content, embed?.title, embed?.description, out.author, embed?.footer?.text, ...out.fields.flatMap((f) => [f.name, f.value])]
    .filter((x) => typeof x === 'string').reduce((n, x) => n + x.length, 0);
  if (total > MAX_TOTAL_TEXT) return { error: 'too_long' };
  return out;
}

export function linkButtonRows(buttons) {
  if (!buttons?.length) return [];
  return [{
    type: 1,
    components: buttons.map((b) => ({ type: 2, style: 5, label: b.label, url: b.url, ...(b.emoji ? { emoji: { name: b.emoji } } : {}) })),
  }];
}
