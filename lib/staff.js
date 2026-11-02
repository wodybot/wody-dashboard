// FILE: staff.js
// PUNE ÎN: lib/staff.js
// (fișier nou în proiectul wody-dashboard-main la această cale)

// Data layer for the public Team/Staff page (see app/[locale]/team/page.js).
// A real list of documents (staff_members collection), not the
// site_config single-document pattern. Each entry only stores a Discord
// user id plus the site-specific fields (rank, hierarchy group, sort
// position); the person's current username and avatar are never stored
// here at all, they're resolved live from Discord every time the page is
// read (see getDiscordUserById in lib/discord.js, called from the
// 'staff' route in route.js), so a staff member changing their Discord
// name or avatar picture is reflected automatically with no edit needed
// on this side, and no separate copy of their avatar is fetched or
// cached by the browser directly (same discordCdnUrl proxy every other
// avatar in this app already goes through, so this never talks to
// Discord's CDN from the visitor's browser and sets no cookie).
//
// "hierarchy" and "rank" are deliberately two independent free-text
// fields, not one: hierarchy is which section of the page a member is
// grouped under (e.g. "Leadership", "Moderators", "Support"), rank is
// the specific title shown on their card (e.g. "Head Admin", "Senior
// Moderator"). Multiple staff can share the same hierarchy and/or the
// same rank, nothing here is treated as unique except the Mongo _id.

export const STAFF_COLLECTION = 'staff_members';

const MAX_LEN = { rank: 40, hierarchy: 40, discordUserId: 25, socialUrl: 300 };
const SNOWFLAKE_RE = /^\d{15,25}$/;

// Known social platforms a team card can link to, rendered as small
// icon-only buttons under the rank pill on /team (see SOCIAL_ICONS in
// that page). Order here is display order. "discord" is a direct link
// (a user profile link like discord.com/users/<id>, or an invite), not
// necessarily the same account as discord_user_id, since a team member
// may want to point at a different/public-facing account or server.
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

// Validates a create/update body from the owner panel. `partial: true`
// (edits) only validates whatever fields are present; create requires
// discord_user_id, rank and hierarchy. Returns { ok: true, patch } or
// { ok: false, error }.
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
