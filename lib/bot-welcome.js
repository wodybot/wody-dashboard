import { getDb } from '@/lib/mongo';

export const BOT_WELCOME_ID = 'bot_welcome';

function shape(doc) {
  return {
    guild_join_welcome: doc?.guild_join_welcome !== false,
    updated_at: doc?.updated_at || null,
    updated_by: doc?.updated_by || null,
  };
}

export async function getBotWelcomeConfig() {
  const db = await getDb();
  return shape(await db.collection('site_config').findOne({ _id: BOT_WELCOME_ID }));
}

export async function saveBotWelcomeConfig(enabled, ownerId) {
  const db = await getDb();
  await db.collection('site_config').updateOne(
    { _id: BOT_WELCOME_ID },
    { $set: { guild_join_welcome: !!enabled, updated_at: new Date(), updated_by: ownerId || null }, $setOnInsert: { created_at: new Date() } },
    { upsert: true },
  );
  return getBotWelcomeConfig();
}
