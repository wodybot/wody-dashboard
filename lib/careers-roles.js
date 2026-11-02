// Config server-only pentru pilulele de pe /careers ("Where we could use
// help"). Aceeași colecție site_config, același tipar cached-read /
// revalidate-on-save ca lib/promo-banner.js și lib/og-embed.js: un singur
// document global, editabil din owner panel fără redeploy, vizibil imediat
// pe pagina publică după salvare.
//
// Lista implicită (DEFAULT_ROLES) e cea deja scrisă în
// messages/<locale>.json sub careers.focusAreas, ca fallback cât timp
// owner-ul nu a salvat încă nimic din panel; după prima salvare din
// panel, lista din DB ia locul textului tradus (owner-ul editează o
// singură listă, nu 9 fișiere de traducere).

import { getDb } from '@/lib/mongo';
import { unstable_cache, revalidateTag } from 'next/cache';

export const CAREERS_ROLES_COLLECTION = 'site_config';
export const CAREERS_ROLES_ID = 'careers_roles';
export const CAREERS_ROLES_CACHE_TAG = 'careers-roles-config';

export const CAREERS_DEFAULT_ROLES = Object.freeze([
  'Bot development',
  'Dashboard & web',
  'Design',
  'Community management',
  'Documentation',
  'QA & testing',
]);

const MAX_ROLE_LEN = 40;
const MAX_ROLES = 20;

function sanitizeRoles(list) {
  if (!Array.isArray(list)) return null;
  const roles = list
    .map((r) => String(r || '').trim().slice(0, MAX_ROLE_LEN))
    .filter(Boolean)
    .slice(0, MAX_ROLES);
  return roles.length ? roles : null;
}

// Returnează { ok: true, patch } sau { ok: false, error }.
export function parseCareersRolesPatch(body) {
  if (!body || typeof body !== 'object') return { ok: false, error: 'invalid_body' };
  if (!('roles' in body)) return { ok: false, error: 'empty_patch' };
  const roles = sanitizeRoles(body.roles);
  if (!roles) return { ok: false, error: 'invalid_roles' };
  return { ok: true, patch: { roles } };
}

async function readCareersRolesFromDb() {
  try {
    const db = await getDb();
    const doc = await db.collection(CAREERS_ROLES_COLLECTION).findOne({ _id: CAREERS_ROLES_ID });
    const roles = sanitizeRoles(doc?.roles);
    // null aici inseamna "owner-ul nu a salvat inca nimic", nu o lista
    // salvată goală (aia oricum nu se poate salva, vezi parseCareersRolesPatch
    // de mai sus), deci pagina publică poate cădea în siguranță pe
    // traducerea existentă din messages/<locale>.json.
    return { roles, isCustom: !!roles };
  } catch (e) {
    console.error('readCareersRolesFromDb failed, defaulting', e);
    return { roles: null, isCustom: false };
  }
}

const getCachedCareersRoles = unstable_cache(
  readCareersRolesFromDb,
  ['careers-roles-config-v1'],
  { revalidate: 60, tags: [CAREERS_ROLES_CACHE_TAG] },
);

export async function getCareersRolesConfig() {
  return getCachedCareersRoles();
}

export async function saveCareersRolesPatch(patch, ownerId) {
  const db = await getDb();
  await db.collection(CAREERS_ROLES_COLLECTION).updateOne(
    { _id: CAREERS_ROLES_ID },
    {
      $set: { ...patch, updated_at: new Date(), updated_by: ownerId || null },
      $setOnInsert: { created_at: new Date() },
    },
    { upsert: true },
  );
  revalidateTag(CAREERS_ROLES_CACHE_TAG);
  return readCareersRolesFromDb();
}
