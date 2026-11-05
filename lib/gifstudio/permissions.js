import { getSession } from '@/lib/session';
import { OWNER_ID } from '@/lib/owner-access';

// Only the site owner can use the GIF Preview Studio. This is checked on the server for every request.
export async function requireOwner() {
  const session = await getSession();
  if (!session?.user) return { error: 'unauthenticated', status: 401 };
  if (String(session.user.id) !== String(OWNER_ID)) return { error: 'forbidden', status: 403 };
  return { session, actor: { id: String(session.user.id), name: session.user.global_name || session.user.username || 'owner' } };
}
