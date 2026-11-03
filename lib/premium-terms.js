import { getMessages } from 'next-intl/server';

export async function moduleTerms() {
  try {
    const messages = await getMessages();
    return Object.values(messages.modules || {}).map((m) => m && m.title).filter((x) => typeof x === 'string' && x.length > 2 && x !== 'General' && x !== 'Premium');
  } catch {
    return [];
  }
}
