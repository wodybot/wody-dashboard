'use client';
// Social link buttons. The look is the one of the footer buttons (round, same border, same hover), so the
// profile matches the rest of the site. Links come from the profile API, which stores only canonical https
// addresses of the allowed platforms; they open in a new tab with noopener and nofollow.
import { Github, Globe, Instagram, Linkedin, Twitch, Youtube, Brush, Send, Facebook, MessagesSquare, Ghost, AtSign, Cloud, Pin, Music2, Headphones, Tv, Gamepad2, Dribbble, Palette, Video, Newspaper, Heart, Coffee, Briefcase, Handshake } from 'lucide-react';
import { SOCIALS } from '@/lib/collab/constants';

function TikTokIcon({ className }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className={className} aria-hidden="true">
      <path d="M9 0h1.98c.144.715.54 1.617 1.235 2.512C12.895 3.389 13.797 4 15 4v2c-1.753 0-3.07-.814-4-1.829V11a5 5 0 1 1-5-5v2a3 3 0 1 0 3 3z" />
    </svg>
  );
}
function DiscordIcon({ className = 'w-4 h-4' }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className={className} aria-hidden="true">
      <path d="M13.545 2.907a13.2 13.2 0 0 0-3.257-1.011.05.05 0 0 0-.052.025c-.141.25-.297.577-.406.833a12.2 12.2 0 0 0-3.658 0 8 8 0 0 0-.412-.833.05.05 0 0 0-.052-.025c-1.125.194-2.22.534-3.257 1.011a.04.04 0 0 0-.021.018C.356 6.024-.213 9.047.066 12.032q.003.022.021.037a13.3 13.3 0 0 0 3.995 2.02.05.05 0 0 0 .056-.019q.463-.63.818-1.329a.05.05 0 0 0-.01-.059l-.018-.011a9 9 0 0 1-1.248-.595.05.05 0 0 1-.02-.066l.015-.019q.127-.095.248-.195a.05.05 0 0 1 .051-.007c2.619 1.196 5.454 1.196 8.041 0a.05.05 0 0 1 .053.007q.121.1.248.195a.05.05 0 0 1-.004.085 8 8 0 0 1-1.249.594.05.05 0 0 0-.03.03.05.05 0 0 0 .003.041c.24.465.515.909.817 1.329a.05.05 0 0 0 .056.019 13.2 13.2 0 0 0 4.001-2.02.05.05 0 0 0 .021-.037c.334-3.451-.559-6.449-2.366-9.106a.03.03 0 0 0-.02-.019m-8.198 7.307c-.789 0-1.438-.724-1.438-1.612s.637-1.613 1.438-1.613c.807 0 1.45.73 1.438 1.613 0 .888-.637 1.612-1.438 1.612m5.316 0c-.788 0-1.438-.724-1.438-1.612s.637-1.613 1.438-1.613c.807 0 1.451.73 1.438 1.613 0 .888-.631 1.612-1.438 1.612" />
    </svg>
  );
}
function XIcon({ className }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12.6.75h2.454l-5.36 6.142L16 15.25h-4.937l-3.867-5.07-4.425 5.07H.316l5.733-6.57L0 .75h5.063l3.495 4.633L12.6.75Zm-.86 13.028h1.36L4.323 2.145H2.865z" />
    </svg>
  );
}

export const SOCIAL_ICONS = {
  youtube: Youtube, twitch: Twitch, tiktok: TikTokIcon, instagram: Instagram, x: XIcon, github: Github, behance: Brush, linkedin: Linkedin,
  discord: DiscordIcon, telegram: Send, facebook: Facebook, reddit: MessagesSquare, snapchat: Ghost, threads: AtSign, bluesky: Cloud,
  pinterest: Pin, spotify: Music2, soundcloud: Headphones, kick: Tv, steam: Gamepad2, dribbble: Dribbble, artstation: Palette,
  vimeo: Video, medium: Newspaper, patreon: Heart, kofi: Coffee, fiverr: Briefcase, upwork: Handshake, website: Globe,
};

// variant "footer" is the look of the site footer buttons (round, 40px, fills with the brand colour on hover) and is
// centred on phones; `extra` is one more item put at the end of the row (the footer uses it for the e-mail button).
export default function SocialLinks({ socials = {}, className = '', size = 'md', label = 'Social links', variant = 'profile', extra = null }) {
  // TikTok (the linked account) always comes first, the rest follow the usual order.
  const items = [...SOCIALS].sort((a, b) => (b.id === 'tiktok') - (a.id === 'tiktok')).filter((s) => typeof socials?.[s.id] === 'string' && /^https:\/\//i.test(socials[s.id]));
  const footer = variant === 'footer';
  if (!items.length && !extra) return null;
  // The layout follows the number of links: a few sit in one tidy row; many become an even grid on phones (5 per
  // row, nothing gets squeezed or cut) and wrap in rows on larger screens, a little tighter when there are a lot.
  const count = items.length + (extra ? 1 : 0);
  const many = count > 6;
  const lots = count > 12;
  const box = footer ? 'h-10 w-10' : size === 'sm' || lots ? 'h-9 w-9' : 'h-11 w-11';
  const icon = footer || size === 'sm' || lots ? 'h-4 w-4' : 'h-[18px] w-[18px]';
  const layout = many
    ? `grid ${lots ? 'grid-cols-6' : 'grid-cols-5'} justify-items-center gap-2 sm:flex sm:flex-wrap ${footer ? 'sm:justify-center lg:justify-start' : 'sm:justify-start'} ${lots ? 'sm:gap-1.5' : ''}`
    : `flex flex-wrap items-center gap-2.5 ${footer ? 'justify-center lg:justify-start' : ''}`;
  const look = footer
    ? 'border-border/60 bg-secondary/60 text-muted-foreground hover:border-primary hover:bg-primary hover:text-primary-foreground'
    : 'border-border/60 bg-secondary/60 text-muted-foreground hover:border-[#e6cd8c] hover:bg-[#e6cd8c] hover:text-[#1a1208]';
  return (
    <ul className={`${layout} ${className}`} aria-label={label}>
      {items.map((s) => {
        const Icon = SOCIAL_ICONS[s.id] || Globe;
        return (
          <li key={s.id}>
            <a
              href={socials[s.id]} target="_blank" rel={footer ? 'noopener noreferrer' : 'noopener noreferrer nofollow ugc'} aria-label={s.label} title={s.label}
              className={`${box} inline-flex items-center justify-center rounded-full border ${look} transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e6cd8c]`}
            >
              <Icon className={icon} />
            </a>
          </li>
        );
      })}
      {extra ? <li>{extra}</li> : null}
    </ul>
  );
}
