import CommunityHubClient from './CommunityHubClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const metadata = { title: 'Community Discovery', robots: { index: false, follow: false } };

// Entry point for people who manage a listing without being Discord administrators of the
// server (editors, analytics viewers). Everything is checked again by the API.
export default function CommunityHubPage() { return <CommunityHubClient />; }
