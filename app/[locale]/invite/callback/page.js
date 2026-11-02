// FILE: page.js
// PUNE ÎN: app/[locale]/invite/callback/page.js
// (înlocuiește fișierul existent la această cale)

// Where Discord sends the browser back to after someone picks a server and
// approves the bot-invite OAuth screen. See InviteCallbackClient.jsx for
// the actual redirect logic (reading guild_id, checking login, forwarding
// into that server's dashboard).
//
// Split into this thin server page.js + a separate 'use client' file on
// purpose: with the client logic and 'use client' directly in page.js,
// Next.js's build-time static generation for this route and its route
// segment config (`dynamic`) interacted badly and reliably failed the
// production build with an opaque "ReferenceError: t is not defined"
// inside a minified chunk, taking the ENTIRE site's build down with it
// (not just this one page: `next build` exits on the first prerender
// failure). A plain, unambiguous server component page.js, whose only
// job is to declare the route as fully dynamic and render the client
// component, builds cleanly.
import InviteCallbackClient from './InviteCallbackClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const metadata = { robots: { index: false, follow: false } };

export default function InviteCallbackPage() {
  return <InviteCallbackClient />;
}
