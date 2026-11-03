import CollabHubClient from '@/components/collab/HubClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const metadata = { title: 'Collab', robots: { index: false, follow: false } };

export default function CollabHubPage() { return <CollabHubClient />; }
