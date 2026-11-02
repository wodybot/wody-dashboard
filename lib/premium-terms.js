import { getMessages } from 'next-intl/server';

// The names of the modules in the current language. The FAQ and help pages show them in gold inside every
// answer that talks about Premium (see components/brand-text.jsx).
export async function moduleTerms() {
  try {
    const messages = await getMessages();
    return Object.values(messages.modules || {}).map((m) => m && m.title).filter((x) => typeof x === 'string' && x.length > 2 && x !== 'General' && x !== 'Premium');
  } catch {
    return [];
  }
}
