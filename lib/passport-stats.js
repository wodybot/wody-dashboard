import { getDb } from '@/lib/mongo';
import { unstable_cache } from 'next/cache';

async function compute() {
  const db = await getDb();
  const passports = await db.collection('wody_passports').countDocuments({});
  const viewsAgg = await db.collection('wody_passports').aggregate([
    { $group: { _id: null, views: { $sum: '$views' } } },
  ]).toArray();
  const serversAgg = await db.collection('wody_passport_servers').aggregate([
    { $group: { _id: '$guild_id' } },
    { $count: 'n' },
  ]).toArray();
  return {
    passports: Number(passports) || 0,
    views: Number(viewsAgg[0]?.views) || 0,
    servers: Number(serversAgg[0]?.n) || 0,
  };
}

const cached = unstable_cache(compute, ['wody-passport-stats'], { revalidate: 600 });

export async function getPassportStats() {
  try {
    return { ok: true, ...(await cached()) };
  } catch (error) {
    console.error('passport stats unavailable', error?.message || error);
    return { ok: false };
  }
}
