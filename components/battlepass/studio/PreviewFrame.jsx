'use client';
// Rendered inside the Page Studio's preview iframe: the real public page, drawn from the draft the studio sends by postMessage.
import { useEffect, useState } from 'react';
import PassPage from '../PassPage';
import { studioTheme } from '@/lib/battlepass/studio/theme';
import { normalizeConfig, defaultConfig } from '@/lib/battlepass/studio/schema';

export default function PreviewFrame({ data }) {
  const [config, setConfig] = useState(data.config);
  useEffect(() => {
    const onMessage = (e) => {
      if (e.origin !== window.location.origin || e.source !== window.parent) return;
      if (e.data?.type === 'wody-studio-config' && e.data.config) {
        // the draft goes through the same validation as a save, so even the preview never renders an unsafe link or style
        const n = normalizeConfig(e.data.config, defaultConfig());
        if (n.ok) setConfig(n.config);
      }
    };
    window.addEventListener('message', onMessage);
    window.parent?.postMessage({ type: 'wody-studio-ready' }, window.location.origin);
    return () => window.removeEventListener('message', onMessage);
  }, []);
  return (
    <PassPage season={data.season} initialState={data.state} viewer={data.viewer} backHref="/" loginHref="#" leaderboard={data.leaderboard}
      studio={{ config, stats: data.stats }} theme={studioTheme(data.season.page, config)} />
  );
}
