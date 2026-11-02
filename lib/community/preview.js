// Turns draft content into the same shape the public profile receives, for the live preview.
import { discordCdnUrl } from '@/lib/utils';

export function previewProfile(content, state, guildId) {
  const stats = state?.stats || null;
  const img = (id) => (id ? `/api/community/img/${id}` : null);
  return {
    slug: content.slug || 'preview',
    name: content.name || '',
    short_description: content.short_description || '',
    description: content.description || '',
    category: content.category, subcategory: content.subcategory || '',
    tags: content.tags || [], languages: content.languages || [], server_type: content.server_type,
    features: content.features || [], socials: content.socials || {}, sections: content.sections || [],
    theme: content.theme, banner: img(content.banner_id), background: img(content.background_id),
    icon: stats?.icon_hash && guildId ? discordCdnUrl(`https://cdn.discordapp.com/icons/${guildId}/${stats.icon_hash}.png?size=128`) : null,
    badges: [], verified: (state?.badges || []).includes('verified'),
    invite: Boolean(content.invite_code),
    staff: (content.staff_roles || []).map((r) => ({ name: r.name, color: r.color })),
    stats: stats ? { members: stats.member_count ?? null, online: stats.online_count ?? null, voice: stats.voice_count ?? null, boosts: stats.boosts ?? null, created_at: stats.created_at ?? null, fetched_at: stats.fetched_at ?? null } : null,
    events: [], achievements: null,
  };
}
