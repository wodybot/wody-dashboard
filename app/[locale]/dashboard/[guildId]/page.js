// FILE: page.js
// PUNE ÎN: app/[locale]/dashboard/[guildId]/page.js
// (înlocuiește fișierul existent la această cale)

// Thin server page.js + a separate 'use client' file (GuildDashboardClient),
// same split and same reasoning as app/[locale]/invite/callback/page.js
// and app/[locale]/dashboard/page.js: with 'use client' directly in
// page.js, Next.js's build-time static generation for this route
// reliably failed the production build with an opaque "ReferenceError: t
// is not defined", taking the ENTIRE site's build down with it (next
// build exits on the first prerender failure, not just this one page).
// A plain, unambiguous server component page.js, whose only job is to
// declare the route as fully dynamic and render the client component,
// builds cleanly. No props are passed through: GuildDashboardClient reads
// guildId itself via useParams(), exactly as it always has.
import GuildDashboardClient from './GuildDashboardClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function GuildDashboardPage() {
  return <GuildDashboardClient />;
}
