// Server-only. The social buttons in the site footer, edited by the owner in the owner panel (Appearance).
// One document in site_config, same cached read / revalidate-on-save pattern as the banners. The platforms and
// the link rules are the same as on the profile (lib/collab/constants.js SOCIALS + lib/collab/profile.js
// normalizeSocial): only https links to the chosen platform, never a raw text.
import { getDb } from '@/lib/mongo';
import { unstable_cache, revalidateTag } from 'next/cache';
import { normalizeSocials } from '@/lib/collab/profile';
import { COMMUNITY_INVITE, TIKTOK_URL, YOUTUBE_URL } from '@/lib/content';

export const FOOTER_SOCIALS_COLLECTION = 'site_config';
export const FOOTER_SOCIALS_ID = 'footer_socials';
export const FOOTER_SOCIALS_TAG = 'footer-socials-config';

// What the footer showed before this was editable, so nothing changes until the owner saves a list.
export const FOOTER_SOCIALS_DEFAULTS = Object.freeze({ links: { discord: COMMUNITY_INVITE, tiktok: TIKTOK_URL, youtube: YOUTUBE_URL } });

async function readFromDb() {
  try {
    const db = await getDb();
    const doc = await db.collection(FOOTER_SOCIALS_COLLECTION).findOne({ _id: FOOTER_SOCIALS_ID });
    if (!doc || typeof doc.links !== 'object' || doc.links === null) return { links: { ...FOOTER_SOCIALS_DEFAULTS.links } };
    const { socials } = normalizeSocials(doc.links);   // drops anything that is not a valid link of its platform
    return { links: socials };
  } catch (e) {
    console.error('readFooterSocials failed, using the defaults', e);
    return { links: { ...FOOTER_SOCIALS_DEFAULTS.links } };
  }
}

const getCached = unstable_cache(readFromDb, ['footer-socials-config-v1'], { revalidate: 60, tags: [FOOTER_SOCIALS_TAG] });

export async function getFooterSocials() { return getCached(); }

// body: { links: { youtube: '...', ... } }  ->  { ok, links } | { ok:false, error, errors }
export function parseFooterSocials(body) {
  if (!body || typeof body !== 'object' || !body.links || typeof body.links !== 'object' || Array.isArray(body.links)) return { ok: false, error: 'invalid_body' };
  const { socials, errors } = normalizeSocials(body.links);
  if (errors.length) return { ok: false, error: 'invalid_links', errors };
  return { ok: true, links: socials };
}

export async function saveFooterSocials(links, ownerId) {
  const db = await getDb();
  await db.collection(FOOTER_SOCIALS_COLLECTION).updateOne(
    { _id: FOOTER_SOCIALS_ID },
    { $set: { links, updated_at: new Date(), updated_by: ownerId || null }, $setOnInsert: { created_at: new Date() } },
    { upsert: true },
  );
  revalidateTag(FOOTER_SOCIALS_TAG);
  return readFromDb();
}
