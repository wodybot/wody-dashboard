'use client';
import { useEffect, useState } from 'react';
import ListingView from '@/components/community/ListingView';

export default function PreviewFrame() {
  const [data, setData] = useState(null);
  useEffect(() => {
    const onMessage = (e) => {
      if (e.origin !== window.location.origin || e.data?.type !== 'wody-community-preview') return;
      setData({ listing: e.data.listing, catalog: e.data.catalog });
    };
    window.addEventListener('message', onMessage);
    window.parent?.postMessage({ type: 'wody-community-preview-ready' }, window.location.origin);
    return () => window.removeEventListener('message', onMessage);
  }, []);
  useEffect(() => {
    if (!data || typeof ResizeObserver === 'undefined') return undefined;
    const post = () => window.parent?.postMessage({ type: 'wody-community-preview-height', height: document.documentElement.scrollHeight }, window.location.origin);
    post();
    const ro = new ResizeObserver(post);
    ro.observe(document.body);
    return () => ro.disconnect();
  }, [data]);
  if (!data) return <div className="flex min-h-[60vh] items-center justify-center" role="status"><span className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white/70" /></div>;
  return <ListingView listing={data.listing} catalog={data.catalog} preview optimize={false} fullBleed />;
}
