import { Globe, Youtube, Twitch, Instagram, Github, Facebook, Twitter } from 'lucide-react';

function TikTok(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M16.6 0h-3.32v16.34a3.11 3.11 0 0 1-3.11 3.08 3.11 3.11 0 0 1 0-6.22c.31 0 .61.05.89.13V9.9a6.5 6.5 0 0 0-.89-.06A6.44 6.44 0 0 0 3.7 16.28a6.44 6.44 0 0 0 6.47 6.44 6.44 6.44 0 0 0 6.47-6.44V7.94a8.2 8.2 0 0 0 4.76 1.52V6.13a4.85 4.85 0 0 1-4.8-4.8V0Z" />
    </svg>
  );
}

export const SOCIAL_ICON = { website: Globe, youtube: Youtube, twitch: Twitch, tiktok: TikTok, instagram: Instagram, x: Twitter, github: Github, facebook: Facebook };
