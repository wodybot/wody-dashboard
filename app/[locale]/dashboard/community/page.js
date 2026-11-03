import CommunityHubClient from './CommunityHubClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const metadata = { title: 'Community Discovery', robots: { index: false, follow: false } };

export default function CommunityHubPage() { return <CommunityHubClient />; }
