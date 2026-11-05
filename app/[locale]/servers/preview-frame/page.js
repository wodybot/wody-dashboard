import PreviewFrame from './PreviewFrame';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Preview', robots: { index: false, follow: false } };

export default function PreviewFramePage() { return <PreviewFrame />; }
