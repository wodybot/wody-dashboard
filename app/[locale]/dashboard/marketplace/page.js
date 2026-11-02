import MarketplaceHubClient from '@/components/marketplace/HubClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const metadata = { title: 'Marketplace', robots: { index: false, follow: false } };

// Everything here is checked again by the API; this page only draws the screens.
export default function MarketplaceHubPage() { return <MarketplaceHubClient />; }
