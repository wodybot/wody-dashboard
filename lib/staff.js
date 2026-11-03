

export const STAFF_COLLECTION = 'staff_members';

const MAX_LEN = { rank: 40, hierarchy: 40, discordUserId: 25, socialUrl: 300 };
const SNOWFLAKE_RE = /^\d{15,25}$/;

export const SOCIAL_PLATFORMS = ['discord', 'youtube', 'instagram', 'facebook', 'tiktok', 'twitter'];

function parseSocials(raw) {
  if (raw == null) return {};
  if (typeof raw !== 'object') return null;
  const out = {};
  for (const key of SOCIAL_PLATFORMS) {
    const v = raw[key];
    if (v == null || v === '') continue;
    const s = String(v).trim();
    if (!s) continue;
    if (!/^https?:\/\//i.test(s)) return null;
    out[key] = s.slice(0, MAX_LEN.socialUrl);
  }
  return out;
}

export function parseStaffInput(body, { partial = false } = {}) {
  if (!body || typeof body !== 'object') return { ok: false, error: 'invalid_body' };
  const patch = {};
  const has = (k) => k in body;
  const need = (k) => !partial || has(k);

  if (need('discord_user_id')) {
    const v = String(body.discord_user_id || '').trim();
    if (!SNOWFLAKE_RE.test(v)) return { ok: false, error: 'invalid_discord_user_id' };
    patch.discord_user_id = v;
  }
  if (need('rank')) {
    const v = String(body.rank || '').trim();
    if (!v) return { ok: false, error: 'invalid_rank' };
    patch.rank = v.slice(0, MAX_LEN.rank);
  }
  if (need('hierarchy')) {
    const v = String(body.hierarchy || '').trim();
    if (!v) return { ok: false, error: 'invalid_hierarchy' };
    patch.hierarchy = v.slice(0, MAX_LEN.hierarchy);
  }
  if (has('position')) {
    const n = Number(body.position);
    if (!Number.isFinite(n)) return { ok: false, error: 'invalid_position' };
    patch.position = Math.trunc(n);
  }
  if (has('hierarchy_position')) {
    const n = Number(body.hierarchy_position);
    if (!Number.isFinite(n)) return { ok: false, error: 'invalid_hierarchy_position' };
    patch.hierarchy_position = Math.trunc(n);
  }
  if (has('socials')) {
    const socials = parseSocials(body.socials);
    if (socials === null) return { ok: false, error: 'invalid_socials' };
    patch.socials = socials;
  }

  if (Object.keys(patch).length === 0) return { ok: false, error: 'empty_patch' };
  return { ok: true, patch };
}
