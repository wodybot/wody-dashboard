import PublicProfilePage from '../profile/[username]/page';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const metadata = { title: 'Profile', robots: { index: false, follow: false } };

export default async function ShortProfilePage({ params }) {
  const { prefix } = await params;
  return PublicProfilePage({ params: Promise.resolve({ username: prefix }) });
}
