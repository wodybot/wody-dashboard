
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
