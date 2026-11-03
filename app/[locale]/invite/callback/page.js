
import InviteCallbackClient from './InviteCallbackClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const metadata = { robots: { index: false, follow: false } };

export default function InviteCallbackPage() {
  return <InviteCallbackClient />;
}
