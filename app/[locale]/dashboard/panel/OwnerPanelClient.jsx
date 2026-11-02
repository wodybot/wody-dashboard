'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { discordCdnUrl, proxiedImageUrl } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TopNav, Footer } from '@/components/nav';
import { PromoBanner } from '@/components/promo-banner';
import SocialLinks, { SOCIAL_ICONS } from '@/components/profile/SocialLinks';
import { SOCIALS } from '@/lib/collab/constants';
import { RichTextEditor } from '@/components/rich-text-editor';
import { SimpleMarkdown } from '@/components/simple-markdown';
import { OWNER_ID, COMMUNITY_INVITE, INVITE_URL } from '@/lib/content';
import dynamic from 'next/dynamic';
const CommunityAdminPanel = dynamic(() => import('@/components/community/AdminPanel'), { ssr: false });
const CollabAdminPanel = dynamic(() => import('@/components/collab/AdminPanel'), { ssr: false });
const OwnerAccessAdmin = dynamic(() => import('@/components/community/OwnerAccess'), { ssr: false });
import {
  Crown, Sparkles, Key, Copy, Plus, Loader2, RefreshCw, Home,
  Server, Users, ShieldCheck, ShieldAlert, Megaphone, Trash2, Ban, Undo2, MessageSquare,
  LayoutGrid, ChevronRight, Leaf, Send, History, Image as ImageIcon, Search, Share2, Handshake,
  BookOpen, Pencil, X, ArrowUp, KeyRound, Menu, ArrowLeft, ArrowDown, ExternalLink, GripVertical, Timer, Compass,
  Briefcase,
} from 'lucide-react';
import PartnersAdmin from '@/components/partners/PartnersAdmin';
import { DiscordMessage, DiscordText } from '@/components/dashboard-kit';

// Dynamic, not a static top-level import: this page is the only place in
// the app that renders the decorative layer directly (everywhere else
// goes through the runtime-conditional AutumnEffectsMount). A static
// import here previously caused webpack to fold the leaf SVGs/gradients
// into a shared vendor chunk that shipped on every route in the site,
// Autumn on or off, dynamic() keeps this page's preview feature from
// leaking into anyone else's bundle.
const AutumnEffectsLayer = dynamic(() => import('@/components/autumn/autumn-effects-layer'), { ssr: false });
// Same runtime-conditional-import pattern, for the new unified seasonal
// preview (Autumn/Winter/Halloween) shown further down this file.
const SeasonalEffectsLayer = dynamic(() => import('@/components/seasonal/seasonal-effects-layer'), { ssr: false });

const UPDATE_TAGS = ['Feature', 'Fix', 'Announcement', 'Update'];

// Section config for the panel's nav (sidebar on desktop, horizontal tab
// strip on mobile). Kept as plain data so the nav and the content switch
// stay in sync from one source instead of two separate hardcoded lists.
const SECTIONS = [
  { id: 'overview', label: 'Overview', icon: LayoutGrid, group: 'General', desc: 'Key numbers and shortcuts' },
  { id: 'keys', label: 'License Keys', icon: Key, group: 'Premium', desc: 'Generate and revoke keys' },
  { id: 'premium-servers', label: 'Premium Servers', icon: Crown, group: 'Premium', desc: 'Servers with Premium active' },
  { id: 'all-servers', label: 'All Servers', icon: Server, group: 'Servers', desc: 'Every server, joins, leaves, invites' },
  { id: 'enforcement', label: 'Server Enforcement', icon: ShieldAlert, group: 'Servers', desc: 'Ban or unban servers' },
  { id: 'community', label: 'Community Discovery', icon: Compass, group: 'Servers', desc: 'Review listings' },
  { id: 'collab', label: 'Collab', icon: Briefcase, group: 'Servers', desc: 'Moderation queue, reports, settings' },
  { id: 'updates', label: 'Announcements', icon: Megaphone, group: 'Content', desc: 'Public updates page' },
  { id: 'blog', label: 'Blog', icon: BookOpen, group: 'Content', desc: 'Write and publish posts' },
  { id: 'staff', label: 'Team / Staff', icon: Users, group: 'Content', desc: 'Team page members' },
  { id: 'partners', label: 'Partners', icon: Handshake, group: 'Content', desc: 'Partner bots page' },
  { id: 'appearance', label: 'Appearance', icon: Leaf, group: 'Website', desc: 'Banners, effects, link preview' },
  { id: 'access', label: 'Panel Access', icon: KeyRound, group: 'Security', desc: 'Who can open the community part' },
];

// Sections grouped by category, in nav order. The sidebar (desktop) and
// the section picker (phones/tablets) are both built from this, so the
// panel reads as a few clear categories instead of one long flat list.
function groupSections(list) {
  return list.reduce((groups, s) => {
    const g = groups.find((x) => x.name === s.group);
    if (g) g.items.push(s); else groups.push({ name: s.group, items: [s] });
    return groups;
  }, []);
}
// People with delegated access only ever see the community management part.
const DELEGATE_SECTIONS = SECTIONS.filter((s) => s.id === 'community' || s.id === 'collab');

const AUTUMN_DEFAULT = {
  enabled: false,
  effects: { leaves: true, shadows: true, animations: true },
  density: 'low',
  intensity: 'low',
};

// Successor to AUTUMN_DEFAULT: a single "season" config that covers
// Autumn/Winter/Halloween, one at a time (see lib/season-effects.js).
// AUTUMN_DEFAULT/the old load/save functions below are left in place,
// unused by the card now, purely so nothing else in this file that might
// still reference them breaks; the panel itself only renders the new
// Seasonal Effects card.
const SEASON_DEFAULT = {
  enabled: false,
  season: 'autumn',
  effects: { particles: true, shadows: true, animations: true },
  density: 'low',
  intensity: 'low',
};
const SEASON_OPTIONS = [
  { value: 'autumn', label: 'Autumn' },
  { value: 'winter', label: 'Winter' },
  { value: 'halloween', label: 'Halloween' },
];

const SHOWCASE_DEFAULT = { minMembers: 5, maxDisplay: 28, excludedGuildIds: [] };
const PROMO_BANNER_DEFAULT = { enabled: false, imageUrl: '', buttonText: '', buttonUrl: '' };
const COUNTDOWN_BANNER_DEFAULT = { enabled: false, text: '', target_at: null, ended_text: '', background_url: '', background_dim: 45 };
// Mirrors CAREERS_DEFAULT_ROLES in lib/careers-roles.js (same text that
// also exists in messages/<locale>.json under careers.focusAreas), so
// the panel's editor starts out already filled in even if the owner has
// never saved anything there.
const CAREERS_DEFAULT_ROLES = [
  'Bot development',
  'Dashboard & web',
  'Design',
  'Community management',
  'Documentation',
  'QA & testing',
];
const OG_LOOKS = [
  { id: 'passport', name: 'Passport', note: 'Every module on the left, the WODY Passport ad on the right.' },
  { id: 'showcase', name: 'Showcase', note: 'Centered, every module as a tidy cloud.' },
  { id: 'minimal', name: 'Minimal', note: 'Big wordmark, quiet and typographic.' },
  { id: 'classic', name: 'Classic', note: 'The original card with the modules only.' },
];
const OG_EMBED_DEFAULT = {
  title: 'Wody',
  subtitle: 'THE ALL-IN-ONE DISCORD BOT',
  tagline: 'Everything you need to manage your Discord community.',
  variant: 'passport',
  modules: [
    'Welcome & Auto Role', 'Goodbye', 'Moderation', 'AutoMod', 'Full Logging', 'Tickets', 'Reaction Roles', 'Captcha',
    'Giveaways', 'Polls', 'Levels & XP', 'Suggestions', 'Auto Responses', 'Custom Commands',
    'Embed Builder', 'Scheduled Messages', 'Forums', 'Backups', 'Temporary Voice',
    'YouTube Notifications', 'Stream Notifications', 'Birthdays', 'Invite Tracking', 'Community Discovery',
    'Economy', 'Games', 'Blackjack', 'WODY Passport', 'Global Leaderboard',
  ],
  media_url: '',
  // Mirrors OG_EMBED_DEFAULT_BUTTONS in lib/og-embed.js, kept as a
  // separate literal here (this file is client-side, that one is
  // server-only and pulls INVITE_URL from lib/content the same way this
  // page already does at the top), so if this list is ever missing from
  // a freshly-loaded config (old data, or the GET failing) the buttons
  // editor still opens pre-filled with the real defaults instead of empty.
  buttons: [
    { label: 'Add to Server', url: INVITE_URL },
    { label: 'Dashboard', url: 'https://wody.online/dashboard' },
    { label: 'Support', url: COMMUNITY_INVITE },
    { label: 'Vote', url: 'https://top.gg/bot/1514491897647861773' },
  ],
  buttons_heading: '',
};
// Discord's own hard limit on how many buttons fit in one action row.
const MAX_OG_BUTTONS = 5;

const BLOG_FORM_DEFAULT = {
  title: '', slug: '', excerpt: '', content: '', cover_image_url: '',
  seo_title: '', seo_description: '', author_name: '', published: true,
};

const STAFF_FORM_DEFAULT = {
  discord_user_id: '', rank: '', hierarchy: '', position: 0, hierarchy_position: 0,
  socials: { discord: '', youtube: '', instagram: '', facebook: '', tiktok: '', twitter: '' },
};

async function safeJson(url, options) {
  try {
    const res = await fetch(url, options);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// Parses the "Excluded server IDs" textarea (comma and/or newline
// separated free text) into a deduplicated array of ID strings.
// Shared by the "Joined in the last 7 days" and "Left in the last 7 days"
// lists further down: both now span a whole week instead of a single day,
// so a bare time like "16:36" is no longer enough to tell entries apart,
// this adds the date too (e.g. "Sep 26, 4:36 PM").
function formatJoinLeaveTimestamp(value) {
  if (!value) return '';
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function parseIdsText(text) {
  return [...new Set(String(text || '').split(/[\s,]+/).map((s) => s.trim()).filter(Boolean))];
}

// Parses the OG-embed "Modules" textarea, one module name per line
// (module names routinely contain spaces, e.g. "Auto Role", "Video
// Notifications", so this can't split on whitespace the way
// parseIdsText above does for bare IDs).
function parseModulesText(text) {
  return String(text || '').split('\n').map((s) => s.trim()).filter(Boolean);
}

// Minimal markdown-lite preview renderer, shared by every "show roughly
// what Discord will render" preview in this panel: the "message a
// server owner" composer further down, and the Discord Link Preview
// card's title/subtitle/tagline/buttons-heading text below. Just enough
// of Discord's own markdown (**bold**, *italic*, [text](url), bare
// URLs) for a sanity-check preview, not a full parser (no nesting, no
// code blocks) and not something any bot-facing code relies on; Discord
// itself does the real rendering on the recipient's end in every case
// this feeds into (a DM, or the actual component-embed text Discord
// fetches from app/discord-embed.json/route.js).
function renderDiscordMarkdownLines(text, keyPrefix = '') {
  const lines = String(text || '').split('\n');
  return lines.map((line, li) => {
    const parts = [];
    const re = /\*\*(.+?)\*\*|\*(.+?)\*|\[(.+?)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s]+)/g;
    let last = 0;
    let m;
    let key = 0;
    while ((m = re.exec(line))) {
      if (m.index > last) parts.push(line.slice(last, m.index));
      if (m[1] !== undefined) parts.push(<strong key={`${keyPrefix}${li}-${key++}`}>{m[1]}</strong>);
      else if (m[2] !== undefined) parts.push(<em key={`${keyPrefix}${li}-${key++}`}>{m[2]}</em>);
      else if (m[3] !== undefined) parts.push(<span key={`${keyPrefix}${li}-${key++}`} className="text-[#00a8fc] underline">{m[3]}</span>);
      else if (m[5] !== undefined) parts.push(<span key={`${keyPrefix}${li}-${key++}`} className="text-[#00a8fc] underline">{m[5]}</span>);
      last = re.lastIndex;
    }
    if (last < line.length) parts.push(line.slice(last));
    return <div key={`${keyPrefix}${li}`}>{parts.length ? parts : '\u00A0'}</div>;
  });
}

// Old name kept as a thin alias: this exact function used to live here
// under this name, only used by the owner-message composer preview.
function renderOwnerMessagePreview(text) {
  return renderDiscordMarkdownLines(text, 'dm-');
}

function StatusBadge({ status }) {
  const map = {
    active: { label: 'Active', className: 'bg-green-500/15 text-green-400 border-green-500/30' },
    revoked: { label: 'Revoked', className: 'bg-red-500/15 text-red-400 border-red-500/30' },
    // An expired key is functionally dead the same way a revoked one is
    // it can no longer back any server so it gets the same "invalidated"
    // treatment, just labeled distinctly so it's clear it wasn't a manual
    // revoke by the owner.
    expired: { label: 'Expired', className: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30' },
    exhausted: { label: 'Exhausted', className: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' },
  };
  const s = map[status] || { label: status, className: '' };
  return <Badge variant="outline" className={`text-[10px] ${s.className}`}>{s.label}</Badge>;
}

export default function OwnerPanelClient({ restricted = false }) {
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [checked, setChecked] = useState(false);
  const [section, setSection] = useState(restricted ? 'community' : 'overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const visibleSections = restricted ? DELEGATE_SECTIONS : SECTIONS;
  const SECTION_GROUPS = groupSections(visibleSections);
  // Which Appearance card is showing right now. Six independent cards
  // used to just stack one under another on this one tab, a long scroll
  // to get from "Seasonal Effects" down to "Careers page roles". Chips
  // instead of sub-tabs so they wrap naturally on a narrow phone screen
  // instead of needing horizontal scrolling or a dropdown.
  const [appearanceCategory, setAppearanceCategory] = useState('seasonal');
  const APPEARANCE_CATEGORIES = [
    { id: 'seasonal', label: 'Seasonal Effects', icon: Leaf },
    { id: 'showcase', label: 'Community Showcase', icon: Users },
    { id: 'promo', label: 'Promo Banner', icon: ImageIcon },
    { id: 'countdown', label: 'Countdown Banner', icon: Timer },
    { id: 'footer', label: 'Footer Social Links', icon: Share2 },
    { id: 'discord', label: 'Discord Link Preview', icon: Share2 },
    { id: 'careers', label: 'Careers Page Roles', icon: BookOpen },
  ];

  const [genDays, setGenDays] = useState(30);
  const [genLimit, setGenLimit] = useState(1);
  const [genNote, setGenNote] = useState('');
  const [genBusy, setGenBusy] = useState(false);

  const [keys, setKeys] = useState([]);
  const [keysLoading, setKeysLoading] = useState(true);

  const [servers, setServers] = useState([]);
  const [serversLoading, setServersLoading] = useState(true);
  const [removingGuild, setRemovingGuild] = useState(null);

  // Servers the bot joined in the last 7 days (owner/guilds/joined-7d),
  // shown as its own separate list rather than folded into "All Servers",
  // since "what's new lately" and "browse everything" are different
  // questions with different answers.
  const [joinedServers, setJoinedServers] = useState([]);
  const [joinedLoading, setJoinedLoading] = useState(true);

  // Same idea, mirrored for the other direction: servers the bot left in
  // the last 7 days (owner/guilds/left-7d). Covers any way a guild drops
  // off the bot's list (kicked, server deleted, removed manually), not
  // just owner-initiated bans, which already have their own list further
  // down (guild_bans).
  const [leftServers, setLeftServers] = useState([]);
  const [leftLoading, setLeftLoading] = useState(true);

  // Welcome message Wody posts when it is added to a server (owner/bot-welcome).
  const [botWelcome, setBotWelcome] = useState(null); // null = not loaded / failed
  const [botWelcomeLoading, setBotWelcomeLoading] = useState(true);
  const [botWelcomeSaving, setBotWelcomeSaving] = useState(false);

  // Invite Tracking health (owner/invite-tracking): servers with it on, recent errors, sync problems.
  const [inviteHealth, setInviteHealth] = useState(null);
  const [inviteLoading, setInviteLoading] = useState(true);

  const [allServers, setAllServers] = useState([]);
  const [allServersLoading, setAllServersLoading] = useState(true);
  // "All Servers" search: filters the already-loaded list client-side by
  // guild ID (exact substring, so pasting a full or partial ID both
  // work) or name (case-insensitive substring). No extra request, the
  // full list is already in allServers.
  const [serverSearchQuery, setServerSearchQuery] = useState('');

  // Message-a-server-owner composer (Dialog). `dmGuild` holds the server
  // row the composer was opened for (null = closed); `dmOwner`/`dmLastSent`
  // are populated by owner-info right after opening, resolved fresh from
  // Discord every time rather than reused from the All Servers list, so
  // the composer never shows a stale owner for a server that's changed
  // hands since that list last loaded.
  const [dmGuild, setDmGuild] = useState(null);
  const [dmOwner, setDmOwner] = useState(null);
  const [dmLastSentAt, setDmLastSentAt] = useState(null);
  const [dmInfoLoading, setDmInfoLoading] = useState(false);
  const [dmMessage, setDmMessage] = useState('');
  const [dmSending, setDmSending] = useState(false);
  const [guildBans, setGuildBans] = useState([]);
  const [guildBansLoading, setGuildBansLoading] = useState(true);
  const [banMessage, setBanMessage] = useState('');
  const [banBusy, setBanBusy] = useState(null);

  const [updTitle, setUpdTitle] = useState('');
  const [updTag, setUpdTag] = useState('Feature');
  const [updBody, setUpdBody] = useState('');
  const [updBusy, setUpdBusy] = useState(false);
  const [updates, setUpdates] = useState([]);
  const [updatesLoading, setUpdatesLoading] = useState(true);
  const [deletingUpdate, setDeletingUpdate] = useState(null);

  // Blog
  const [blogPosts, setBlogPosts] = useState([]);
  const [blogLoading, setBlogLoading] = useState(true);
  const [blogEditingId, setBlogEditingId] = useState(null);
  const [blogForm, setBlogForm] = useState(BLOG_FORM_DEFAULT);
  const [blogSaving, setBlogSaving] = useState(false);
  const [blogDeletingId, setBlogDeletingId] = useState(null);
  // Whether the owner has manually edited the slug field for the post
  // currently being written. Until they do, the slug auto-fills from the
  // title as they type (see the Title onChange below); once touched, it
  // stops overwriting whatever they typed there themselves.
  const [blogSlugTouched, setBlogSlugTouched] = useState(false);

  // Staff / Team
  const [staffMembers, setStaffMembers] = useState([]);
  const [staffLoading, setStaffLoading] = useState(true);
  const [staffForm, setStaffForm] = useState(STAFF_FORM_DEFAULT);
  const [staffLookupResult, setStaffLookupResult] = useState(null);
  const [staffLookingUp, setStaffLookingUp] = useState(false);
  const [staffSaving, setStaffSaving] = useState(false);
  const [staffEditingId, setStaffEditingId] = useState(null);
  const [staffDeletingId, setStaffDeletingId] = useState(null);

  // Appearance -> Seasonal Effects -> Autumn. Draft state is what the
  // owner is currently editing/previewing; it's only pushed to the
  // backend (and to every visitor) on Save.
  const [autumnSaved, setAutumnSaved] = useState(AUTUMN_DEFAULT);
  const [autumnDraft, setAutumnDraft] = useState(AUTUMN_DEFAULT);
  const [autumnLoading, setAutumnLoading] = useState(true);
  const [autumnSaving, setAutumnSaving] = useState(false);
  const [autumnPreview, setAutumnPreview] = useState(false);
  const autumnDirty = JSON.stringify(autumnSaved) !== JSON.stringify(autumnDraft);

  // Appearance -> Seasonal Effects (Autumn/Winter/Halloween). This is the
  // card actually rendered now; the Autumn-only state above is left
  // declared but unused by any JSX, see the SEASON_DEFAULT comment.
  const [seasonSaved, setSeasonSaved] = useState(SEASON_DEFAULT);
  const [seasonDraft, setSeasonDraft] = useState(SEASON_DEFAULT);
  const [seasonLoading, setSeasonLoading] = useState(true);
  const [seasonSaving, setSeasonSaving] = useState(false);
  const [seasonPreview, setSeasonPreview] = useState(false);
  const seasonDirty = JSON.stringify(seasonSaved) !== JSON.stringify(seasonDraft);

  // Appearance -> Community Showcase. Same saved/draft/dirty shape as
  // Autumn just above, minus the preview toggle (there's nothing to
  // preview live, the homepage strip already reflects real guild data).
  const [showcaseSaved, setShowcaseSaved] = useState(SHOWCASE_DEFAULT);
  const [showcaseDraft, setShowcaseDraft] = useState(SHOWCASE_DEFAULT);
  const [showcaseLoading, setShowcaseLoading] = useState(true);
  const [showcaseLoadFailed, setShowcaseLoadFailed] = useState(false);
  const [showcaseSaving, setShowcaseSaving] = useState(false);
  // Free-text textarea for excluded guild IDs (one per line or comma
  // separated) is easier to edit than a chip list for something used
  // rarely; parsed into an array only on save.
  const [showcaseExclusionsText, setShowcaseExclusionsText] = useState('');
  const showcaseDirty =
    JSON.stringify({ minMembers: showcaseSaved.minMembers, maxDisplay: showcaseSaved.maxDisplay }) !==
      JSON.stringify({ minMembers: showcaseDraft.minMembers, maxDisplay: showcaseDraft.maxDisplay }) ||
    JSON.stringify(parseIdsText(showcaseExclusionsText)) !== JSON.stringify(showcaseSaved.excludedGuildIds || []);


// Mirrors exactly what discord-embed.json/route.js sends Discord (see
// getDiscordComponentEmbed in lib/discord-component-embed.js): a type-17
// Container with the `# title` heading, `**subtitle**\ntagline` text,
// the card image, an optional multi-line buttons_heading block, then the
// button row, same content, same order, same markdown, rendered here
// with Discord's own dark-theme container/button styling so this reads
// as "what it'll actually look like", not just a list of the fields
// that feed it. buttons_heading goes through the full SimpleMarkdown
// renderer (bold, italic, code, bullet/numbered lists, quotes,
// headings), same as Blog and Updates content, since Discord's own text
// components support that same set. imageSrc is cache-busted the same
// way the old preview's was, so a save is reflected immediately instead
// of showing a stale cached image.
// Live preview for the Countdown Banner card in the owner panel, same
// rendering as the public bar in components/countdown-banner.jsx, but
// fed directly from the panel's draft state (no fetch). An exact date
// filled in above takes priority (same as on save), then a duration
// (days/hours/minutes/seconds), then whatever target_at is already
// saved, if any.
function CountdownBannerPreview({ draft, duration, exactDate }) {
  const totalSeconds = (Number(duration.days) || 0) * 86400 + (Number(duration.hours) || 0) * 3600 + (Number(duration.minutes) || 0) * 60 + (Number(duration.seconds) || 0);
  const exactMs = exactDate ? new Date(exactDate).getTime() : NaN;
  const previewTargetMs = !Number.isNaN(exactMs)
    ? exactMs
    : (totalSeconds > 0
      ? Date.now() + totalSeconds * 1000
      : (draft.target_at ? new Date(draft.target_at).getTime() : null));
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!previewTargetMs) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [previewTargetMs]);

  if (!previewTargetMs) {
    return (
      <p className="text-xs text-muted-foreground rounded-lg border border-dashed border-border/60 px-3 py-2.5">
        Fill in an exact date or a duration above, or save one at least once, to see the
        countdown in the preview.
      </p>
    );
  }

  const remainingMs = previewTargetMs - now;
  const isOver = remainingMs <= 0;
  const format = (ms) => {
    const total = Math.max(0, Math.floor(ms / 1000));
    const days = Math.floor(total / 86400);
    const hours = Math.floor((total % 86400) / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    const pad = (n) => String(n).padStart(2, '0');
    return days > 0 ? `${days}d ${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s` : `${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;
  };

  return (
    <div className={`relative overflow-hidden rounded-lg border border-[#c46a35]/25 ${draft.background_url ? 'bg-[#120a06]' : 'bg-gradient-to-r from-[#7c3010]/25 via-[#a3481c]/20 to-[#7c3010]/25 backdrop-blur-sm'}`}>
      {draft.background_url ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={proxiedImageUrl(draft.background_url)} alt="" aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center" />
          <span aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ backgroundColor: `rgba(10, 6, 4, ${(Number(draft.background_dim ?? 45) || 0) / 100})` }} />
        </>
      ) : null}
      <div className="relative flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 px-4 py-2 text-center text-sm [text-shadow:0_1px_2px_rgba(0,0,0,0.6)]">
        <span className="font-medium text-[#f2c091]">{draft.text || 'Event'}</span>
        {!isOver && <span className="font-mono tabular-nums text-[#f6d9b8]">{format(remainingMs)}</span>}
        {isOver && draft.ended_text && <span className="text-[#f2c091]/80">{draft.ended_text}</span>}
        {isOver && !draft.ended_text && <span className="text-muted-foreground italic">It has ended, without an end text the bar no longer shows on the site</span>}
      </div>
    </div>
  );
}

function DiscordComponentPreview({ config, imageSrc }) {
  const buttons = Array.isArray(config.buttons) ? config.buttons : [];
  // Mirrors lib/discord-component-embed.js exactly: a custom media_url
  // REPLACES the generated card entirely (title/subtitle/tagline/module
  // pills baked into the PNG), it doesn't sit inside it. This preview
  // used to always show the generated /opengraph-image regardless of
  // media_url, which made a saved custom image look like it had no
  // effect at all, when on Discord itself it already fully replaced the
  // card, the preview just wasn't reflecting it.
  const customMedia = config.media_url?.trim();
  return (
    <div className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm">
      <div className="px-4 pt-4 pb-3">
        <div className="text-sm font-medium text-foreground">Discord Link Preview</div>
        <div className="mt-1 text-xs text-muted-foreground">
          What Discord actually renders when someone pastes wody.online in chat: title, text,
          image and buttons, in order. The image itself is a static picture (a Discord limit on
          every site&apos;s link preview, not something this can turn on); the title/text/buttons
          around it are live components and support Discord&apos;s **bold** / *italic* markdown.
        </div>
      </div>
      <div className="px-4 pb-4">
        {/* Discord's own message-area background so the card reads at
            the same contrast it will in an actual channel. */}
        <div className="rounded-lg bg-[#313338] p-4">
          <div className="max-w-[440px] rounded-[8px] border border-[#3f4248] bg-[#2b2d31] p-4">
            <div className="text-white text-[22px] font-bold leading-tight break-words">
              {config.title || '\u00A0'}
            </div>
            <div className="mt-1.5 text-[#dbdee1] text-[14px] leading-[1.4] break-words">
              {renderDiscordMarkdownLines(`**${config.subtitle || ''}**\n${config.tagline || ''}`, 'ogsub-')}
            </div>
            <div className="mt-3 rounded-[6px] overflow-hidden border border-black/30 bg-black/20">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={proxiedImageUrl(customMedia || imageSrc)}
                alt="Discord link preview"
                className="w-full h-auto block min-h-[180px] object-cover"
              />
            </div>
            {config.buttons_heading?.trim() && (
              <div className="mt-3 text-[#dbdee1] text-[14px] leading-[1.4]">
                <SimpleMarkdown text={config.buttons_heading} />
              </div>
            )}
            {buttons.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {buttons.map((b, i) => (
                  <div
                    key={i}
                    className="inline-flex items-center gap-1.5 rounded-[4px] bg-[#4e5058] px-3.5 py-2 text-[13px] font-medium text-white"
                  >
                    <span className="max-w-[160px] truncate">{b.label || 'Button'}</span>
                    <ExternalLink className="w-3.5 h-3.5 opacity-80 shrink-0" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

  // Appearance -> Promo Banner. Same saved/draft/dirty shape as the other
  // Appearance cards above.
  const [bannerSaved, setBannerSaved] = useState(PROMO_BANNER_DEFAULT);
  const [bannerDraft, setBannerDraft] = useState(PROMO_BANNER_DEFAULT);
  const [bannerLoading, setBannerLoading] = useState(true);
  const [bannerSaving, setBannerSaving] = useState(false);
  const bannerDirty = JSON.stringify(bannerSaved) !== JSON.stringify(bannerDraft);

  // Appearance -> Countdown Banner. Same saved/draft/dirty shape, plus a
  // separate, local-only duration input (days/hours/minutes/seconds):
  // that's never sent as-is, it's only used to COMPUTE a new target_at
  // (now + duration) at the moment Save is pressed. Leaving all four at
  // 0 means "don't touch the running countdown", so changing just the
  // text or toggling it on/off never accidentally resets an in-progress
  // countdown.
  const [countdownSaved, setCountdownSaved] = useState(COUNTDOWN_BANNER_DEFAULT);
  const [countdownDraft, setCountdownDraft] = useState(COUNTDOWN_BANNER_DEFAULT);
  const [countdownLoading, setCountdownLoading] = useState(true);
  const [countdownSaving, setCountdownSaving] = useState(false);
  const [countdownDuration, setCountdownDuration] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  // Alternative to the duration fields above: an exact date+time
  // (browser-local, converted to a UTC instant on save), for "counts
  // down until 25 September at 18:00" instead of "counts down for 3
  // days from whenever I hit save". Empty string means unused; whichever
  // one is actually filled in wins on save, see saveCountdownBanner.
  const [countdownExactDate, setCountdownExactDate] = useState('');
  const countdownDirty =
    JSON.stringify(countdownSaved) !== JSON.stringify(countdownDraft) ||
    Object.values(countdownDuration).some((v) => Number(v) > 0) ||
    !!countdownExactDate;

  // Appearance -> Discord/social link-preview embed. Same saved/draft/
  // dirty shape as the other Appearance cards. modulesText is the
  // textarea's raw one-per-line text, parsed into an array only on save
  // or when computing dirty state, same pattern as the showcase card's
  // excluded-IDs textarea above.
  const [ogSaved, setOgSaved] = useState(OG_EMBED_DEFAULT);
  const [ogDraft, setOgDraft] = useState(OG_EMBED_DEFAULT);
  const [ogLoading, setOgLoading] = useState(true);
  const [ogSaving, setOgSaving] = useState(false);
  const [ogModulesText, setOgModulesText] = useState(OG_EMBED_DEFAULT.modules.join('\n'));
  const [ogPreviewNonce, setOgPreviewNonce] = useState(0);
  const ogDirty =
    ogDraft.title !== ogSaved.title ||
    ogDraft.subtitle !== ogSaved.subtitle ||
    ogDraft.tagline !== ogSaved.tagline ||
    ogDraft.media_url !== ogSaved.media_url ||
    ogDraft.variant !== ogSaved.variant ||
    ogDraft.buttons_heading !== ogSaved.buttons_heading ||
    JSON.stringify(ogDraft.buttons) !== JSON.stringify(ogSaved.buttons) ||
    JSON.stringify(parseModulesText(ogModulesText)) !== JSON.stringify(ogSaved.modules);

  // Buttons editor helpers (Appearance -> Discord Link Preview -> the
  // button row Discord actually renders under the card, see
  // lib/discord-component-embed.js). Kept as plain array edits on
  // ogDraft.buttons rather than a parsed-textarea pattern like modules
  // above, because each button is two fields (label + url), not one
  // line of free text.
  function updateOgButton(index, field, value) {
    setOgDraft((prev) => ({
      ...prev,
      buttons: prev.buttons.map((b, i) => (i === index ? { ...b, [field]: value } : b)),
    }));
  }
  function addOgButton() {
    setOgDraft((prev) => (
      prev.buttons.length >= MAX_OG_BUTTONS
        ? prev
        : { ...prev, buttons: [...prev.buttons, { label: '', url: '' }] }
    ));
  }
  function removeOgButton(index) {
    setOgDraft((prev) => ({ ...prev, buttons: prev.buttons.filter((_, i) => i !== index) }));
  }
  function moveOgButton(index, dir) {
    setOgDraft((prev) => {
      const to = index + dir;
      if (to < 0 || to >= prev.buttons.length) return prev;
      const buttons = [...prev.buttons];
      [buttons[index], buttons[to]] = [buttons[to], buttons[index]];
      return { ...prev, buttons };
    });
  }

  // Careers page roles (Appearance -> Careers page roles). Server truth
  // is null as long as the owner hasn't saved anything yet (see
  // lib/careers-roles.js); the panel still shows something editable, so
  // both states (saved and draft) start from CAREERS_DEFAULT_ROLES if
  // the server hasn't returned its own list.
  const [careersRolesSaved, setCareersRolesSaved] = useState(CAREERS_DEFAULT_ROLES);
  const [careersRolesDraft, setCareersRolesDraft] = useState(CAREERS_DEFAULT_ROLES);
  const [careersRolesLoading, setCareersRolesLoading] = useState(true);
  const [careersRolesSaving, setCareersRolesSaving] = useState(false);
  const careersRolesDirty = JSON.stringify(careersRolesDraft) !== JSON.stringify(careersRolesSaved);

  async function loadCareersRoles() {
    setCareersRolesLoading(true);
    const r = await safeJson('/api/site/careers-roles');
    const roles = r?.roles?.length ? r.roles : CAREERS_DEFAULT_ROLES;
    setCareersRolesSaved(roles);
    setCareersRolesDraft(roles);
    setCareersRolesLoading(false);
  }

  async function saveCareersRoles() {
    const roles = careersRolesDraft.map((r) => r.trim()).filter(Boolean);
    if (roles.length === 0) {
      toast.error('Add at least one role');
      return;
    }
    setCareersRolesSaving(true);
    const r = await safeJson('/api/site/careers-roles', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roles }),
    });
    setCareersRolesSaving(false);
    if (!r) {
      toast.error('Failed to save the careers page roles');
      return;
    }
    const saved = r.roles?.length ? r.roles : CAREERS_DEFAULT_ROLES;
    setCareersRolesSaved(saved);
    setCareersRolesDraft(saved);
    toast.success('Careers page updated');
  }

  function updateCareersRole(index, value) {
    setCareersRolesDraft((prev) => prev.map((r, i) => (i === index ? value : r)));
  }
  function addCareersRole() {
    setCareersRolesDraft((prev) => (prev.length >= 20 ? prev : [...prev, '']));
  }
  function removeCareersRole(index) {
    setCareersRolesDraft((prev) => prev.filter((_, i) => i !== index));
  }
  function moveCareersRole(index, dir) {
    setCareersRolesDraft((prev) => {
      const to = index + dir;
      if (to < 0 || to >= prev.length) return prev;
      const roles = [...prev];
      [roles[index], roles[to]] = [roles[to], roles[index]];
      return roles;
    });
  }

  // Server truth, not a client-side hint: every list below only ever
  // renders after /api/premium/me confirms this session's Discord user id
  // matches the owner id, and every API route it calls re-checks that
  // same thing independently server-side, so hiding this page's UI is a
  // convenience, not the actual access control.
  const [user, setUser] = useState(null);
  // Yes/no per server setting (owner/config-status), never the values.
  const [configStatus, setConfigStatus] = useState(null);

  useEffect(() => {
    (async () => {
      const r = await safeJson('/api/premium/me');
      if (!r?.is_owner && !r?.is_delegate) {
        router.replace('/dashboard');
        return;
      }
      setMe(r);
      if (!r.is_owner) {
        // Delegated access: community management only, none of the owner data is requested.
        const u = await safeJson('/api/auth/me');
        setUser(u?.user || null);
        setChecked(true);
        return;
      }
      safeJson('/api/owner/config-status').then((c) => setConfigStatus(c?.items || null));
      const u = await safeJson('/api/auth/me');
      setUser(u?.user || null);
      setChecked(true);
      loadKeys();
      loadServers();
      loadAllServers();
      loadJoined();
      loadLeft();
      loadBotWelcome();
      loadInvites();
      loadGuildBans();
      loadUpdates();
      loadSeason();
      loadShowcase();
      loadBanner();
      loadFooterSocials();
      loadCountdownBanner();
      loadOgEmbed();
      loadCareersRoles();
      loadBlogPosts();
      loadStaff();
    })();
  }, []);

  async function loadAutumn() {
    setAutumnLoading(true);
    const r = await safeJson('/api/site/autumn');
    const cfg = r || AUTUMN_DEFAULT;
    setAutumnSaved(cfg);
    setAutumnDraft(cfg);
    setAutumnLoading(false);
  }

  async function saveAutumn() {
    setAutumnSaving(true);
    const r = await safeJson('/api/site/autumn', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(autumnDraft),
    });
    setAutumnSaving(false);
    if (!r) {
      toast.error('Failed to save Autumn settings');
      return;
    }
    setAutumnSaved(r);
    setAutumnDraft(r);
    toast.success(r.enabled ? 'Autumn Mode is now live for every visitor' : 'Autumn Mode turned off');
  }

  async function loadSeason() {
    setSeasonLoading(true);
    const r = await safeJson('/api/site/season-effects');
    const cfg = r || SEASON_DEFAULT;
    setSeasonSaved(cfg);
    setSeasonDraft(cfg);
    setSeasonLoading(false);
  }

  async function saveSeason() {
    setSeasonSaving(true);
    const r = await safeJson('/api/site/season-effects', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(seasonDraft),
    });
    setSeasonSaving(false);
    if (!r) {
      toast.error('Failed to save Seasonal Effects settings');
      return;
    }
    setSeasonSaved(r);
    setSeasonDraft(r);
    const label = SEASON_OPTIONS.find((o) => o.value === r.season)?.label || r.season;
    toast.success(r.enabled ? `${label} is now live for every visitor` : 'Seasonal effects turned off');
  }

  function updateSeasonDraft(patch) {
    setSeasonDraft((prev) => ({
      ...prev,
      ...patch,
      effects: { ...prev.effects, ...(patch.effects || {}) },
    }));
  }

  function updateAutumnDraft(patch) {
    setAutumnDraft((prev) => ({
      ...prev,
      ...patch,
      effects: { ...prev.effects, ...(patch.effects || {}) },
    }));
  }

  async function loadShowcase() {
    setShowcaseLoading(true);
    const r = await safeJson('/api/site/community-showcase');
    // If it could not be read, keep Save disabled: saving the defaults would erase the real excluded list.
    setShowcaseLoadFailed(!r || r.error);
    const cfg = (r && !r.error) ? r : SHOWCASE_DEFAULT;
    setShowcaseSaved(cfg);
    setShowcaseDraft(cfg);
    setShowcaseExclusionsText((cfg.excludedGuildIds || []).join('\n'));
    setShowcaseLoading(false);
  }

  async function saveShowcase() {
    // Clamp client-side too so a stray "0" or empty field never gets sent
    // mid-typing; the API re-validates and clamps again regardless.
    const patch = {
      minMembers: Math.max(0, Math.trunc(Number(showcaseDraft.minMembers) || 0)),
      maxDisplay: Math.min(60, Math.max(4, Math.trunc(Number(showcaseDraft.maxDisplay) || SHOWCASE_DEFAULT.maxDisplay))),
      excludedGuildIds: parseIdsText(showcaseExclusionsText),
    };
    if (showcaseLoadFailed) { toast.error('The saved settings could not be loaded, reload the page before saving'); return; }
    setShowcaseSaving(true);
    const r = await safeJson('/api/site/community-showcase', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    setShowcaseSaving(false);
    if (!r) {
      toast.error('Failed to save Community Showcase settings');
      return;
    }
    setShowcaseSaved(r);
    setShowcaseDraft(r);
    setShowcaseExclusionsText((r.excludedGuildIds || []).join('\n'));
    toast.success('Community Showcase settings updated');
  }

  // Appearance -> Footer Social Links. The same platforms and link rules as the profile; what is saved here is what the
  // buttons in the footer of every page show (a link per platform, in the order of the list).
  const [footerSaved, setFooterSaved] = useState({});
  const [footerDraft, setFooterDraft] = useState({});
  const [footerShown, setFooterShown] = useState(() => new Set());
  const [footerLoading, setFooterLoading] = useState(true);
  const [footerSaving, setFooterSaving] = useState(false);
  const [footerErrors, setFooterErrors] = useState({});
  const footerDirty = JSON.stringify(footerSaved) !== JSON.stringify(Object.fromEntries(Object.entries(footerDraft).filter(([k]) => footerShown.has(k) && String(footerDraft[k] || '').trim())));
  async function loadFooterSocials() {
    setFooterLoading(true);
    const r = await safeJson('/api/site/footer-socials');
    const links = r?.links && typeof r.links === 'object' ? r.links : {};
    setFooterSaved(links); setFooterDraft(links); setFooterShown(new Set(Object.keys(links))); setFooterErrors({});
    setFooterLoading(false);
  }
  async function saveFooterSocials() {
    setFooterSaving(true); setFooterErrors({});
    const links = Object.fromEntries(Object.entries(footerDraft).filter(([k]) => footerShown.has(k) && String(footerDraft[k] || '').trim()));
    try {
      const res = await fetch('/api/site/footer-socials', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ links }) });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.links) {
        setFooterSaved(data.links); setFooterDraft(data.links); setFooterShown(new Set(Object.keys(data.links)));
        toast.success('Footer links updated');
      } else if (Array.isArray(data.errors) && data.errors.length) {
        const msg = { invalid_link: 'This is not a valid link.', wrong_platform: 'This link does not belong to this platform.', blocked_link: 'This link is not allowed.', too_long: 'This link is too long.' };
        setFooterErrors(Object.fromEntries(data.errors.map((e) => [e.field, msg[e.code] || 'This is not valid.'])));
        toast.error('Check the highlighted links');
      } else {
        toast.error('Failed to save the footer links');
      }
    } catch { toast.error('Failed to save the footer links'); }
    setFooterSaving(false);
  }

  async function loadBanner() {
    setBannerLoading(true);
    const r = await safeJson('/api/site/promo-banner');
    const cfg = r || PROMO_BANNER_DEFAULT;
    setBannerSaved(cfg);
    setBannerDraft(cfg);
    setBannerLoading(false);
  }

  async function saveBanner() {
    setBannerSaving(true);
    const r = await safeJson('/api/site/promo-banner', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bannerDraft),
    });
    setBannerSaving(false);
    if (!r) {
      toast.error('Failed to save the promo banner');
      return;
    }
    setBannerSaved(r);
    setBannerDraft(r);
    toast.success('Promo banner updated');
  }

  async function loadCountdownBanner() {
    setCountdownLoading(true);
    const r = await safeJson('/api/site/countdown-banner');
    const cfg = r || COUNTDOWN_BANNER_DEFAULT;
    setCountdownSaved(cfg);
    setCountdownDraft(cfg);
    setCountdownLoading(false);
  }

  const [countdownUploading, setCountdownUploading] = useState(false);
  const [promoUploading, setPromoUploading] = useState(false);
  // One owner-only upload for the site pictures (countdown bar, promo banner). The file is checked on the server by its
  // real bytes; the answer is a same-site address, so visitors never load it from a third party and no cookie is set.
  async function uploadSiteImage(file, setBusy, onUrl) {
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) { toast.error('The image is too big. The limit is 3 MB.'); return; }
    setBusy(true);
    try {
      const form = new FormData(); form.set('file', file);
      const res = await fetch('/api/site-image', { method: 'POST', body: form });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.url) {
        onUrl(data.url);
        toast.success('Image uploaded. Press Save to publish it.');
      } else {
        const msg = { image_too_large: 'The image is too big. The limit is 3 MB.', image_invalid: 'This file is not a PNG, JPG, WebP or GIF image.', image_dimensions: 'The image size is not supported.' }[data.error];
        toast.error(msg || 'The upload failed. Please try again.');
      }
    } catch { toast.error('The upload failed. Please try again.'); }
    setBusy(false);
  }
  const uploadCountdownImage = (file) => uploadSiteImage(file, setCountdownUploading, (url) => setCountdownDraft((prev) => ({ ...prev, background_url: url })));
  const uploadPromoImage = (file) => uploadSiteImage(file, setPromoUploading, (url) => setBannerDraft((prev) => ({ ...prev, imageUrl: url })));

  async function saveCountdownBanner() {
    const patch = { ...countdownDraft };
    if (patch.background_url && !/^(https?:\/\/\S+|\/api\/site-image\/[a-f0-9]{24})$/i.test(patch.background_url.trim())) {
      toast.error('The background image must be a full link starting with https://');
      return;
    }
    // Exact date+time wins over the duration fields when both are
    // filled in, it's the more specific, more intentional input, typing
    // a date is not something you'd do by accident while also having
    // leftover numbers sitting in the duration boxes.
    if (countdownExactDate) {
      const target = new Date(countdownExactDate);
      if (Number.isNaN(target.getTime())) {
        toast.error('That date or time is not valid');
        return;
      }
      if (target.getTime() <= Date.now()) {
        toast.error('Pick a date and time in the future');
        return;
      }
      patch.target_at = target.toISOString();
    } else {
      const { days, hours, minutes, seconds } = countdownDuration;
      const totalSeconds = (Number(days) || 0) * 86400 + (Number(hours) || 0) * 3600 + (Number(minutes) || 0) * 60 + (Number(seconds) || 0);
      // Only touch target_at when a duration was actually entered, so
      // saving an unrelated change (the text, the toggle) never silently
      // restarts a countdown that's already running.
      if (totalSeconds > 0) {
        patch.target_at = new Date(Date.now() + totalSeconds * 1000).toISOString();
      }
    }
    setCountdownSaving(true);
    const r = await safeJson('/api/site/countdown-banner', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    setCountdownSaving(false);
    if (!r) {
      toast.error('Nu am putut salva bara de countdown');
      return;
    }
    setCountdownSaved(r);
    setCountdownDraft(r);
    setCountdownDuration({ days: 0, hours: 0, minutes: 0, seconds: 0 });
    setCountdownExactDate('');
    toast.success('Bara de countdown a fost actualizata');
  }

  async function loadOgEmbed() {
    setOgLoading(true);
    const r = await safeJson('/api/site/og-embed');
    // Merge over the default rather than trusting the response shape
    // outright: guards the buttons editor against ever rendering with
    // buttons undefined (old cached data, a partial response, etc.)
    // instead of the real saved/default button list.
    const cfg = { ...OG_EMBED_DEFAULT, ...(r || {}) };
    setOgSaved(cfg);
    setOgDraft(cfg);
    setOgModulesText((cfg.modules || []).join('\n'));
    // Date.now(), not n => n + 1: a small counter restarts from 0 on
    // every fresh page load (component state doesn't survive a refresh),
    // so it landed on the exact same value, "1", after every single
    // reload, meaning the <img> below requested the literal same URL
    // every time. Any cache sitting in front of that URL, the browser's
    // own HTTP cache, a CDN, anything, had every reason to just hand
    // back whatever it already had instead of asking the server again,
    // no matter how fresh the server itself was willing to be. A
    // millisecond timestamp is different on every load and every save,
    // so there's never a stale URL left around to be served from cache.
    setOgPreviewNonce(Date.now());
    setOgLoading(false);
  }

  async function saveOgEmbed() {
    const buttons = ogDraft.buttons
      .map((b) => ({ label: String(b.label || '').trim(), url: String(b.url || '').trim() }))
      .filter((b) => b.label && b.url);
    if (buttons.length === 0) {
      toast.error('Add at least one button with a label and an https:// URL');
      return;
    }
    const badButton = buttons.find((b) => {
      try { return new URL(b.url).protocol !== 'https:'; } catch { return true; }
    });
    if (badButton) {
      toast.error(`"${badButton.label}" needs a valid https:// URL`);
      return;
    }
    const patch = { ...ogDraft, buttons, modules: parseModulesText(ogModulesText) };
    setOgSaving(true);
    const r = await safeJson('/api/site/og-embed', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    setOgSaving(false);
    if (!r) {
      toast.error('Failed to save the link-preview embed');
      return;
    }
    setOgSaved(r);
    setOgDraft(r);
    setOgModulesText((r.modules || []).join('\n'));
    // Same Date.now() reasoning as loadOgEmbed above, see there.
    setOgPreviewNonce(Date.now());
    toast.success('Link-preview embed updated');
  }

  async function loadKeys() {
    setKeysLoading(true);
    const r = await safeJson('/api/premium/keys');
    setKeys(r?.keys || []);
    setKeysLoading(false);
  }

  async function loadServers() {
    setServersLoading(true);
    const r = await safeJson('/api/premium/servers');
    setServers(r?.servers || []);
    setServersLoading(false);
  }

  async function loadAllServers() {
    setAllServersLoading(true);
    const r = await safeJson('/api/premium/all-servers');
    setAllServers(r?.servers || []);
    setAllServersLoading(false);
  }

  async function loadBotWelcome() {
    setBotWelcomeLoading(true);
    const r = await safeJson('/api/owner/bot-welcome');
    setBotWelcome(r ? r.guild_join_welcome !== false : null);
    setBotWelcomeLoading(false);
  }

  async function toggleBotWelcome(next) {
    const previous = botWelcome;
    setBotWelcome(next);
    setBotWelcomeSaving(true);
    const r = await safeJson('/api/owner/bot-welcome', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guild_join_welcome: next }),
    });
    setBotWelcomeSaving(false);
    if (!r) {
      setBotWelcome(previous);
      toast.error('Could not save the welcome message setting');
      return;
    }
    setBotWelcome(r.guild_join_welcome !== false);
    toast.success(r.guild_join_welcome !== false ? 'Welcome message is ON for new servers' : 'Welcome message is OFF for new servers');
  }

  async function loadJoined() {
    setJoinedLoading(true);
    const r = await safeJson('/api/owner/guilds/joined-7d');
    setJoinedServers(r?.servers || []);
    setJoinedLoading(false);
  }

  async function loadInvites() {
    setInviteLoading(true);
    const r = await safeJson('/api/owner/invite-tracking');
    setInviteHealth(r || null);
    setInviteLoading(false);
  }

  async function loadLeft() {
    setLeftLoading(true);
    const r = await safeJson('/api/owner/guilds/left-7d');
    setLeftServers(r?.servers || []);
    setLeftLoading(false);
  }

  async function openOwnerComposer(guild) {
    setDmGuild(guild);
    setDmMessage('');
    setDmOwner(null);
    setDmLastSentAt(null);
    setDmInfoLoading(true);
    const r = await safeJson(`/api/owner/guilds/${guild.id}/owner-info`);
    setDmOwner(r?.owner || null);
    setDmLastSentAt(r?.last_sent_at || null);
    setDmInfoLoading(false);
  }

  function closeOwnerComposer() {
    setDmGuild(null);
    setDmOwner(null);
    setDmLastSentAt(null);
    setDmMessage('');
  }

  async function sendOwnerMessage() {
    if (!dmGuild || !dmMessage.trim()) return;
    setDmSending(true);
    try {
      const res = await fetch(`/api/owner/guilds/${dmGuild.id}/message-owner`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: dmMessage.trim() }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || 'failed');
      toast.success(`Message sent to ${dmOwner?.username || 'the owner'}`, {
        description: `Delivered as a DM from Wody, only to the current owner of ${dmGuild.name}.`,
      });
      closeOwnerComposer();
    } catch (e) {
      const reason = e?.message === 'dm_failed'
        ? "Discord wouldn't deliver it, the owner may have DMs closed."
        : e?.message === 'owner_not_found'
          ? "Couldn't determine who currently owns this server."
          : 'Failed to send the message.';
      toast.error(reason);
    } finally {
      setDmSending(false);
    }
  }

  async function loadGuildBans() {
    setGuildBansLoading(true);
    const r = await safeJson('/api/owner/guild-bans');
    setGuildBans(r?.bans || []);
    setGuildBansLoading(false);
  }

  function isGuildBanned(guildId) {
    return guildBans.some((b) => String(b.guild_id) === String(guildId) && b.active);
  }

  async function setGuildBan(guild, action) {
    const label = guild.name || guild.id;
    if (action === 'ban' && !confirm(`Ban ${label}? The owner will be notified and Wody will leave the server.`)) return;
    if (action === 'unban' && !confirm(`Unban ${label}? The server will be allowed to use Wody again.`)) return;
    setBanBusy(guild.id);
    try {
      const r = await fetch(`/api/owner/guild-bans/${guild.id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action === 'ban' ? { message: banMessage } : {}),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || 'failed');
      if (action === 'ban') {
        toast.success('Server banned', {
          description: j.dm_sent ? 'The server owner was notified before the bot left.' : 'The ban was saved. The owner could not be reached by DM.',
        });
      } else {
        toast.success('Server unbanned');
      }
      setBanMessage('');
      loadGuildBans();
      loadAllServers();
    } catch {
      toast.error(action === 'ban' ? 'Failed to ban server' : 'Failed to unban server');
    } finally {
      setBanBusy(null);
    }
  }


  async function loadUpdates() {
    setUpdatesLoading(true);
    const r = await safeJson('/api/updates');
    setUpdates(r?.items || []);
    setUpdatesLoading(false);
  }

  async function postUpdate() {
    if (!updTitle.trim() || !updBody.trim()) {
      toast.error('Title and body are required');
      return;
    }
    setUpdBusy(true);
    const r = await fetch('/api/updates', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: updTitle, tag: updTag, body: updBody }),
    });
    setUpdBusy(false);
    if (r.ok) {
      const saved = await r.json().catch(() => null);
      toast.success('Update posted', {
        description: saved?.discord_posted
          ? 'Live on the public Updates page and posted to the Discord updates channel.'
          : 'Live on the public Updates page. Posting to the Discord updates channel failed; check the bot has access to that channel.',
      });
      setUpdTitle('');
      setUpdBody('');
      loadUpdates();
    } else {
      toast.error('Failed to post update');
    }
  }

  async function deleteUpdate(id, title) {
    if (!confirm(`Delete "${title}"? This removes it from the public Updates page immediately.`)) return;
    setDeletingUpdate(id);
    try {
      const r = await fetch(`/api/updates/${id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error('failed');
      toast.success('Update deleted');
      loadUpdates();
    } catch {
      toast.error('Failed to delete update');
    } finally {
      setDeletingUpdate(null);
    }
  }

  // ---------------- Blog ----------------
  async function loadBlogPosts() {
    setBlogLoading(true);
    const r = await safeJson('/api/owner/blog');
    setBlogPosts(r?.items || []);
    setBlogLoading(false);
  }

  function startNewBlogPost() {
    setBlogEditingId(null);
    setBlogForm(BLOG_FORM_DEFAULT);
    setBlogSlugTouched(false);
  }

  function startEditBlogPost(post) {
    setBlogEditingId(post._id);
    setBlogForm({
      title: post.title || '',
      slug: post.slug || '',
      excerpt: post.excerpt || '',
      content: post.content || '',
      cover_image_url: post.cover_image_url || '',
      seo_title: post.seo_title || '',
      seo_description: post.seo_description || '',
      author_name: post.author_name || '',
      published: post.published !== false,
    });
    setBlogSlugTouched(true); // keep the existing slug as-is while editing, don't auto-regenerate it from title
  }

  async function saveBlogPost() {
    if (!blogForm.title.trim() || !blogForm.content.trim()) {
      toast.error('Title and content are required');
      return;
    }
    setBlogSaving(true);
    const url = blogEditingId ? `/api/blog/${blogEditingId}` : '/api/blog';
    const method = blogEditingId ? 'PUT' : 'POST';
    const r = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(blogForm),
    });
    setBlogSaving(false);
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      toast.error('Failed to save post', { description: j.error });
      return;
    }
    toast.success(blogEditingId ? 'Post updated' : 'Post published');
    startNewBlogPost();
    loadBlogPosts();
  }

  async function deleteBlogPost(id, title) {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    setBlogDeletingId(id);
    try {
      const r = await fetch(`/api/blog/${id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error('failed');
      toast.success('Post deleted');
      loadBlogPosts();
      if (blogEditingId === id) startNewBlogPost();
    } catch {
      toast.error('Failed to delete post');
    } finally {
      setBlogDeletingId(null);
    }
  }

  // ---------------- Staff ----------------
  async function loadStaff() {
    setStaffLoading(true);
    // The public 'staff' endpoint already resolves Discord names/avatars
    // live, exactly what the management list needs too, no separate
    // owner-only variant required for reading.
    const r = await safeJson('/api/staff');
    setStaffMembers(r?.items || []);
    setStaffLoading(false);
  }

  async function lookupStaffDiscordUser() {
    const id = staffForm.discord_user_id.trim();
    if (!/^\d{15,25}$/.test(id)) {
      toast.error('Enter a valid Discord user ID first');
      return;
    }
    setStaffLookingUp(true);
    setStaffLookupResult(null);
    const r = await safeJson(`/api/staff/lookup/${id}`);
    setStaffLookingUp(false);
    if (!r) {
      toast.error("Couldn't find a Discord user with that ID");
      return;
    }
    setStaffLookupResult(r);
  }

  function startNewStaffMember() {
    setStaffEditingId(null);
    setStaffForm(STAFF_FORM_DEFAULT);
    setStaffLookupResult(null);
  }

  function startEditStaffMember(member) {
    setStaffEditingId(member.id);
    setStaffForm({
      discord_user_id: member.discord_user_id,
      rank: member.rank || '',
      hierarchy: member.hierarchy || '',
      position: member.position ?? 0,
      hierarchy_position: member.hierarchy_position ?? 0,
      socials: { discord: '', youtube: '', instagram: '', facebook: '', tiktok: '', twitter: '', ...(member.socials || {}) },
    });
    setStaffLookupResult({ name: member.name, avatar_url: member.avatar_url });
  }

  async function saveStaffMember() {
    if (!/^\d{15,25}$/.test(staffForm.discord_user_id.trim())) {
      toast.error('A valid Discord user ID is required');
      return;
    }
    if (!staffForm.rank.trim() || !staffForm.hierarchy.trim()) {
      toast.error('Rank and hierarchy are required');
      return;
    }
    setStaffSaving(true);
    const url = staffEditingId ? `/api/staff/${staffEditingId}` : '/api/staff';
    const method = staffEditingId ? 'PUT' : 'POST';
    const r = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(staffForm),
    });
    setStaffSaving(false);
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      toast.error('Failed to save', { description: j.error === 'discord_user_not_found' ? "That Discord user ID couldn't be found." : j.error });
      return;
    }
    toast.success(staffEditingId ? 'Team member updated' : 'Team member added');
    startNewStaffMember();
    loadStaff();
  }

  async function deleteStaffMember(id, name) {
    if (!confirm(`Remove ${name} from the team page?`)) return;
    setStaffDeletingId(id);
    try {
      const r = await fetch(`/api/staff/${id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error('failed');
      toast.success('Removed');
      loadStaff();
      if (staffEditingId === id) startNewStaffMember();
    } catch {
      toast.error('Failed to remove');
    } finally {
      setStaffDeletingId(null);
    }
  }

  // Swaps `position` with the neighbour above/below in the same
  // hierarchy group, the simplest reliable way to reorder without a
  // drag-and-drop library: two single-field updates, both already
  // covered by the same PUT the edit form uses.
  async function moveStaffMember(member, direction) {
    const siblings = staffMembers
      .filter((m) => m.hierarchy === member.hierarchy)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    const idx = siblings.findIndex((m) => m.id === member.id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= siblings.length) return;
    const other = siblings[swapIdx];
    const [posA, posB] = [member.position ?? 0, other.position ?? 0];
    await Promise.all([
      fetch(`/api/staff/${member.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ position: posB }) }),
      fetch(`/api/staff/${other.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ position: posA }) }),
    ]);
    loadStaff();
  }

  async function generate() {
    setGenBusy(true);
    const r = await fetch('/api/premium/generate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ days: genDays, activations_limit: genLimit, note: genNote }),
    });
    setGenBusy(false);
    if (r.ok) {
      const k = await r.json();
      toast.success('Key generated', { description: k.key });
      setGenNote('');
      loadKeys();
    } else {
      toast.error('Failed to generate key');
    }
  }

  async function revoke(key) {
    if (!confirm(`Revoke key ${key}? Any server active on it loses premium immediately.`)) return;
    const r = await fetch(`/api/premium/keys/${key}/revoke`, { method: 'POST' });
    if (r.ok) {
      const j = await r.json().catch(() => ({}));
      toast.success('Key revoked', {
        description: j.servers_removed ? `${j.servers_removed} server${j.servers_removed === 1 ? '' : 's'} removed from premium` : undefined,
      });
      loadKeys();
      loadServers();
    } else {
      toast.error('Failed to revoke key');
    }
  }

  async function removeServer(guildId, label) {
    if (!confirm(`Remove premium from ${label || guildId}? Backups and Temporary Voice are disabled immediately. This can't be undone.`)) return;
    setRemovingGuild(guildId);
    try {
      const r = await fetch(`/api/premium/servers/${guildId}/remove`, { method: 'POST' });
      if (!r.ok) throw new Error('failed');
      const j = await r.json().catch(() => ({}));
      toast.success('Premium removed', {
        description: j.keys_revoked ? `${j.keys_revoked} key(s) revoked automatically` : (label || guildId),
      });
      loadServers();
      loadKeys();
      loadAllServers();
    } catch {
      toast.error('Failed to remove premium');
    } finally {
      setRemovingGuild(null);
    }
  }

  if (!checked) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const activeSection = visibleSections.find((s) => s.id === section) || visibleSections[0];

  const roleLabel = restricted ? 'Delegated access' : 'Owner';
  return (
    <div className="owner-shell min-h-screen flex bg-background">
      {sidebarOpen && (
        <div className="fixed inset-0 z-[35] bg-black/60 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} aria-hidden="true" />
      )}
      <aside className={`fixed lg:sticky top-0 left-0 h-[100dvh] w-72 lg:w-64 shrink-0 flex flex-col bg-sidebar border-r border-sidebar-border z-40 transform transition-transform duration-200 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="shrink-0 px-4 py-4 border-b border-sidebar-border/80 flex items-center gap-3 bg-gradient-to-b from-white/[0.03] to-transparent">
          <div className="w-10 h-10 rounded-xl bg-[#a04820]/15 border border-[#a04820]/40 flex items-center justify-center shrink-0">
            <Crown className="w-5 h-5 text-[#e08a4e]" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-semibold leading-tight truncate">Owner Panel</div>
            <Link href="/dashboard" className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 mt-0.5">
              <ArrowLeft className="w-3 h-3" /> Back to dashboard
            </Link>
          </div>
          <button type="button" aria-label="Close menu" className="lg:hidden shrink-0 w-10 h-10 flex items-center justify-center rounded-lg border border-sidebar-border bg-sidebar-accent/60 hover:bg-sidebar-accent active:scale-95 transition-all" onClick={() => setSidebarOpen(false)}>
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>
        <nav className="flex-1 min-h-0 overflow-y-auto px-3 py-3 scrollbar-thin" aria-label="Owner panel sections">
          {SECTION_GROUPS.map((g, gi) => (
            <div key={g.name} className={gi === 0 ? 'mb-3' : 'mb-3 pt-3 border-t border-sidebar-border/60'}>
              <div className="px-3 mb-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{g.name}</div>
              <div className="space-y-0.5">
                {g.items.map((it) => {
                  const Icon = it.icon;
                  const active = it.id === section;
                  return (
                    <button
                      key={it.id}
                      type="button"
                      aria-current={active ? 'page' : undefined}
                      onClick={() => { setSection(it.id); setSidebarOpen(false); if (typeof window !== 'undefined') window.scrollTo({ top: 0 }); }}
                      className={`group relative w-full h-10 flex items-center gap-3 pl-3 pr-2.5 rounded-lg border text-sm transition-all duration-150 ${active ? 'border-primary/20 bg-gradient-to-r from-primary/25 to-primary/5 text-primary font-medium' : 'border-transparent text-sidebar-foreground/80 hover:bg-white/[0.04] hover:text-foreground'}`}
                    >
                      {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-[#e08a4e]" />}
                      <Icon className={`w-[18px] h-[18px] shrink-0 ${active ? 'text-primary' : 'text-sidebar-foreground/50 group-hover:text-foreground'}`} />
                      <span className="truncate flex-1 text-left">{it.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        <div className="shrink-0 px-4 py-3 border-t border-sidebar-border/80 text-xs text-muted-foreground flex items-center gap-2">
          <ShieldCheck className="w-3.5 h-3.5 text-[#e08a4e] shrink-0" />
          <span className="truncate">{roleLabel}{user?.global_name || user?.username ? ` - ${user.global_name || user.username}` : ''}</span>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 bg-background/80 backdrop-blur border-b border-border/50 shadow-[0_10px_24px_-16px_rgba(0,0,0,0.6)]">
          <div className="px-4 sm:px-6 h-14 flex items-center gap-3">
            <button type="button" className="lg:hidden shrink-0 w-10 h-10 -ml-2 flex items-center justify-center rounded-lg hover:bg-white/[0.05]" aria-label="Open menu" onClick={() => setSidebarOpen(true)}>
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] text-muted-foreground leading-none mb-0.5">{activeSection.group}</div>
              <div className="font-semibold flex items-center gap-2 min-w-0">
                <activeSection.icon className="w-4 h-4 text-[#e08a4e] shrink-0" />
                <span className="truncate">{activeSection.label}</span>
              </div>
            </div>
            <Link href="/" className="shrink-0 text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 h-9 px-2.5 rounded-lg hover:bg-white/[0.05]">
              <Home className="w-4 h-4" /> <span className="hidden sm:inline">Home</span>
            </Link>
          </div>
        </header>

      <main id="main-content" className="flex-1 w-full">
        <div className="owner-content max-w-5xl mx-auto px-4 sm:px-6 py-5 sm:py-6 min-w-0">
          <div className="min-w-0 space-y-5">
            <p className="text-sm text-muted-foreground max-w-2xl">{activeSection.desc}</p>

            {section === 'overview' && (
              <div className="space-y-6">
                <div className="grid sm:grid-cols-3 gap-3">
                  <Card className="p-4 bg-card/60 border-border/50">
                    <div className="text-xs text-muted-foreground mb-1">Active keys</div>
                    <div className="text-2xl font-bold text-[#e08a4e]">
                      {keysLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : keys.filter((k) => k.status === 'active').length}
                    </div>
                  </Card>
                  <Card className="p-4 bg-card/60 border-border/50">
                    <div className="text-xs text-muted-foreground mb-1">Servers with premium</div>
                    <div className="text-2xl font-bold text-[#e08a4e]">
                      {serversLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : servers.length}
                    </div>
                  </Card>
                  <Card className="p-4 bg-card/60 border-border/50">
                    <div className="text-xs text-muted-foreground mb-1">Total servers with Wody</div>
                    <div className="text-2xl font-bold">
                      {allServersLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : allServers.length}
                    </div>
                  </Card>
                </div>

                <Card className="p-4 sm:p-5 bg-card/60 border-border/50">
                  <div className="flex items-center gap-2 font-semibold mb-1"><ShieldCheck className="w-4 h-4 text-[#e08a4e]" /> Server configuration</div>
                  <p className="text-xs text-muted-foreground mb-3">Whether each setting is present on this deployment. Values are never shown.</p>
                  {!configStatus ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                      {configStatus.map((c) => (
                        <div key={c.name} className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-border/50 bg-secondary/20 px-3 py-2">
                          <span className="min-w-0 truncate font-mono text-xs">{c.name}</span>
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${c.set ? 'bg-emerald-500/15 text-emerald-400' : c.required ? 'bg-red-500/15 text-red-400' : 'bg-secondary text-muted-foreground'}`}>{c.set ? 'Set' : c.required ? 'Missing' : 'Not set'}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>

                {/* Quick links into the other sections, same data already
                    loaded above, just a shortcut so Overview doesn't feel
                    like a dead end. */}
                <div className="space-y-5">
                  {SECTION_GROUPS.filter((g) => g.name !== 'General').map((g) => (
                    <div key={g.name}>
                      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{g.name}</div>
                      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
                        {g.items.map((s) => {
                          const Icon = s.icon;
                          return (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => setSection(s.id)}
                              className="group flex min-w-0 items-center gap-3 rounded-xl border border-border/50 bg-card/40 p-4 text-left hover:border-[#a04820]/40 hover:bg-card/60 transition-colors"
                            >
                              <div className="w-9 h-9 rounded-lg bg-[#a04820]/10 border border-[#a04820]/30 flex items-center justify-center shrink-0 text-[#e08a4e]">
                                <Icon className="w-4 h-4" />
                              </div>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-medium">{s.label}</span>
                                <span className="block truncate text-xs text-muted-foreground">{s.desc}</span>
                              </span>
                              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground shrink-0" />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {section === 'keys' && (
              <div className="space-y-6">
                {/* Generate key */}
                <Card className="p-6 bg-card/60 border-[#a04820]/40 relative overflow-hidden">
                  <div className="absolute -top-16 -left-16 w-48 h-48 rounded-full bg-[#a04820]/15 blur-3xl pointer-events-none" />
                  <div className="relative">
                  <div className="font-semibold mb-1 flex items-center gap-2 text-[#e08a4e]">
                    <Sparkles className="w-4 h-4" /> Generate premium key
                  </div>
                  <div className="grid sm:grid-cols-3 gap-3 mb-3 mt-3">
                    <div>
                      <Label>Days valid</Label>
                      <Input type="number" min={1} max={3650} value={genDays} onChange={(e) => setGenDays(Number(e.target.value))} />
                    </div>
                    <div>
                      <Label>Activation limit</Label>
                      <Input type="number" min={1} max={100} value={genLimit} onChange={(e) => setGenLimit(Number(e.target.value))} />
                    </div>
                    <div>
                      <Label>Note (optional)</Label>
                      <Input value={genNote} onChange={(e) => setGenNote(e.target.value)} placeholder="e.g. Youtuber ABC" />
                    </div>
                  </div>
                  <Button onClick={generate} disabled={genBusy} className="gradient-primary w-full sm:w-auto">
                    {genBusy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                    Generate key
                  </Button>
                  </div>
                </Card>

                {/* Keys list */}
                <Card className="p-6 bg-card/60">
                  <div className="flex items-center justify-between mb-3">
                    <div className="font-semibold flex items-center gap-2"><Key className="w-4 h-4" /> Generated keys</div>
                    <Button variant="outline" size="sm" onClick={loadKeys}><RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh</Button>
                  </div>
                  {keysLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : keys.length === 0 ? (
                    <div className="text-xs text-muted-foreground">No keys yet.</div>
                  ) : (
                    <div className="space-y-2 max-h-96 overflow-y-auto scrollbar-thin pr-1">
                      {keys.map((k) => (
                        <div key={k._id} className="rounded-lg border border-border/50 p-3 flex flex-wrap items-center gap-3 text-sm">
                          <code className="font-mono text-[#e08a4e]">{k.key}</code>
                          <button onClick={() => { navigator.clipboard.writeText(k.key); toast.success('Copied'); }} title="Copy" className="text-muted-foreground hover:text-foreground">
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <div className="text-xs text-muted-foreground flex-1 min-w-[160px] truncate">
                            {k.activations_used || 0}/{k.activations_limit || 1} used · exp {k.expires_at ? new Date(k.expires_at).toLocaleDateString('en-US') : 'N/A'}
                            {k.note ? ` · ${k.note}` : ''}
                          </div>
                          <StatusBadge status={k.status} />
                          {k.status === 'active' && (
                            <button onClick={() => revoke(k.key)} className="text-xs text-destructive hover:underline shrink-0">
                              revoke
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </div>
            )}

            {section === 'premium-servers' && (
              <Card className="p-6 bg-card/60">
                <div className="flex items-center justify-between mb-1">
                  <div className="font-semibold flex items-center gap-2"><Crown className="w-4 h-4 text-[#e08a4e]" /> Servers with premium active</div>
                  <Button variant="outline" size="sm" onClick={loadServers}><RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh</Button>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  When a key is revoked or expires, the server drops off this list automatically. No need to remove it by hand.
                </p>
                {serversLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : servers.length === 0 ? (
                  <div className="text-xs text-muted-foreground">No server has premium active right now.</div>
                ) : (
                  <div className="space-y-2 max-h-[32rem] overflow-y-auto scrollbar-thin pr-1">
                    {servers.map((s) => (
                      <div key={s._id} className="rounded-lg border border-border/50 p-3 flex items-center gap-3 text-sm">
                        {s.guild_icon_url ? (
                          <img src={discordCdnUrl(s.guild_icon_url)} alt="" className="w-9 h-9 rounded-lg shrink-0" />
                        ) : (
                          <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                            <Server className="w-4 h-4 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{s.guild_name || `Unknown server (${s.guild_id})`}</div>
                          <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-0.5">
                            <span>ID {s.guild_id}</span>
                            {s.member_count != null && (
                              <span className="inline-flex items-center gap-1"><Users className="w-3 h-3" /> {s.member_count.toLocaleString('en-US')}</span>
                            )}
                            <span>{s.expires_at ? `expires ${new Date(s.expires_at).toLocaleDateString('en-US')}` : 'no expiration'}</span>
                            <span className="font-mono">{s.key_value}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => removeServer(s.guild_id, s.guild_name)}
                          disabled={removingGuild === s.guild_id}
                          className="text-xs text-destructive hover:underline shrink-0"
                        >
                          {removingGuild === s.guild_id ? 'removing…' : 'remove premium'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )}

            {section === 'all-servers' && (
              <Card className="p-6 bg-card/60 mb-6">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="font-semibold flex items-center gap-2"><Server className="w-4 h-4" /> Welcome message on new servers</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      When on, Wody posts its welcome tour in the new server and sends it by DM to whoever invited it. When off, it joins silently. Applies to servers added from now on, within about 20 seconds, no restart.
                    </p>
                  </div>
                  {botWelcomeLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  ) : botWelcome === null ? (
                    <Button variant="outline" size="sm" onClick={loadBotWelcome}><RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Retry</Button>
                  ) : (
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground">{botWelcome ? 'On' : 'Off'}</span>
                      <Switch checked={botWelcome} disabled={botWelcomeSaving} onCheckedChange={toggleBotWelcome} />
                    </div>
                  )}
                </div>
              </Card>
            )}

            {section === 'all-servers' && (
              <Card className="p-6 bg-card/60 mb-6">
                <div className="flex items-center justify-between mb-1">
                  <div className="font-semibold flex items-center gap-2"><Server className="w-4 h-4" /> Invite Tracking</div>
                  <Button variant="outline" size="sm" onClick={loadInvites}><RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh</Button>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  Free module, off by default. Counts come straight from the database; errors are the ones the bot recorded for this module.
                </p>
                {inviteLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : !inviteHealth ? (
                  <div className="text-xs text-muted-foreground">Could not load Invite Tracking data.</div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                      {[['Servers with it on', inviteHealth.active_servers], ['Joins recorded', inviteHealth.joins_total], ['Joins in 24h', inviteHealth.joins_24h], ['Invite codes tracked', inviteHealth.codes_tracked], ['Errors in 7 days', inviteHealth.errors_7d]].map(([k, v]) => (
                        <div key={k} className="rounded-lg border border-border/50 bg-secondary/20 px-3 py-2">
                          <div className="text-[11px] text-muted-foreground">{k}</div>
                          <div className="text-lg font-semibold tabular-nums">{Number(v || 0).toLocaleString()}</div>
                        </div>
                      ))}
                    </div>
                    <div>
                      <div className="text-xs font-medium mb-1.5">Sync problems ({inviteHealth.sync_problems_total}): switched on, no baseline yet</div>
                      {(inviteHealth.sync_problems || []).length === 0 ? (
                        <div className="text-xs text-muted-foreground">None.</div>
                      ) : (
                        <div className="space-y-1.5 max-h-40 overflow-y-auto scrollbar-thin pr-1">
                          {(inviteHealth.sync_problems || []).map((g) => (
                            <div key={g.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-secondary/20 px-3 py-1.5">
                              <span className="text-sm truncate">{g.name || `Server ${g.id}`}</span>
                              <span className="text-[11px] text-muted-foreground font-mono">{g.id}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="text-xs font-medium mb-1.5">Latest errors</div>
                      {(inviteHealth.errors || []).length === 0 ? (
                        <div className="text-xs text-muted-foreground">No errors recorded.</div>
                      ) : (
                        <div className="space-y-1.5 max-h-56 overflow-y-auto scrollbar-thin pr-1">
                          {(inviteHealth.errors || []).map((e, i) => (
                            <div key={i} className="rounded-lg border border-border/50 bg-secondary/20 px-3 py-1.5">
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-sm font-medium truncate">{e.name || `Server ${e.id}`} <span className="text-[11px] font-mono text-muted-foreground">{e.code}</span></span>
                                <span className="text-[11px] text-muted-foreground shrink-0">{formatJoinLeaveTimestamp(e.created_at)}</span>
                              </div>
                              {e.detail ? <div className="text-[11px] text-muted-foreground mt-0.5 break-words">{e.detail}</div> : null}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            )}

            {section === 'all-servers' && (
              <Card className="p-6 bg-card/60 mb-6">
                <div className="flex items-center justify-between mb-1">
                  <div className="font-semibold flex items-center gap-2"><Server className="w-4 h-4" /> Joined in the last 7 days</div>
                  <Button variant="outline" size="sm" onClick={loadJoined}><RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh</Button>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  Servers Wody was added to in the last 7 days. Recorded by the bot itself on join, so this only covers servers added after this feature shipped, not the bot's full history.
                </p>
                {joinedLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : joinedServers.length === 0 ? (
                  <div className="text-xs text-muted-foreground">No new servers in the last 7 days.</div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto scrollbar-thin pr-1">
                    {joinedServers.map((s) => (
                      <div key={s.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-secondary/20 px-3 py-2">
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{s.name || `Server ${s.id}`}</div>
                          <div className="text-[11px] text-muted-foreground font-mono">{s.id}</div>
                        </div>
                        <div className="text-[11px] text-muted-foreground shrink-0 whitespace-nowrap">
                          {formatJoinLeaveTimestamp(s.joined_at)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )}

            {section === 'all-servers' && (
              <Card className="p-6 bg-card/60 mb-6">
                <div className="flex items-center justify-between mb-1">
                  <div className="font-semibold flex items-center gap-2"><Server className="w-4 h-4" /> Left in the last 7 days</div>
                  <Button variant="outline" size="sm" onClick={loadLeft}><RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh</Button>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  Servers Wody was removed from in the last 7 days, for any reason (kicked, server deleted, removed manually). Recorded by the bot itself on leave, so this only covers servers removed after this feature shipped, not the bot's full history.
                </p>
                {leftLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : leftServers.length === 0 ? (
                  <div className="text-xs text-muted-foreground">No servers left in the last 7 days.</div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto scrollbar-thin pr-1">
                    {leftServers.map((s) => (
                      <div key={s.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-secondary/20 px-3 py-2">
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{s.name || `Server ${s.id}`}</div>
                          <div className="text-[11px] text-muted-foreground font-mono">{s.id}</div>
                        </div>
                        <div className="text-[11px] text-muted-foreground shrink-0 whitespace-nowrap">
                          {formatJoinLeaveTimestamp(s.left_at)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )}

            {section === 'all-servers' && (
              <Card className="p-6 bg-card/60">
                <div className="flex items-center justify-between mb-1">
                  <div className="font-semibold flex items-center gap-2"><Server className="w-4 h-4" /> All servers with Wody</div>
                  <Button variant="outline" size="sm" onClick={loadAllServers}><RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh</Button>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  Every server, not just the premium ones, sorted by member count.
                  {!allServersLoading && allServers.length > 0 ? ` ${allServers.length.toLocaleString()} servers in total.` : ''}
                </p>
                <div className="relative mb-3">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  <Input
                    value={serverSearchQuery}
                    onChange={(e) => setServerSearchQuery(e.target.value)}
                    placeholder="Search by server name or ID…"
                    className="pl-9"
                  />
                </div>
                {(() => {
                  const q = serverSearchQuery.trim().toLowerCase();
                  const filteredServers = q
                    ? allServers.filter((g) => g.id?.toString().includes(q) || g.name?.toLowerCase().includes(q))
                    : allServers;
                  return allServersLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : allServers.length === 0 ? (
                  <div className="text-xs text-muted-foreground">Couldn't load the server list.</div>
                  ) : filteredServers.length === 0 ? (
                    <div className="text-xs text-muted-foreground">No servers match &ldquo;{serverSearchQuery}&rdquo;.</div>
                  ) : (
                  <div className="space-y-2 max-h-[32rem] overflow-y-auto scrollbar-thin pr-1">
                    {filteredServers.map((g) => (
                      <div key={g.id} className="rounded-lg border border-border/50 p-3 flex flex-wrap items-center gap-3 text-sm">
                        {g.icon_url ? (
                          <img src={discordCdnUrl(g.icon_url)} alt="" className="w-9 h-9 rounded-lg shrink-0" />
                        ) : (
                          <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                            <Server className="w-4 h-4 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium flex items-center gap-2 min-w-0">
                            <span className="truncate min-w-0">{g.name}</span>
                            {g.premium && <Badge className="text-[10px] bg-yellow-500/15 text-yellow-400 border-yellow-500/30 shrink-0">Premium</Badge>}
                          </div>
                          <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-0.5">
                            <span>ID {g.id}</span>
                            {g.member_count != null && (
                              <span className="inline-flex items-center gap-1"><Users className="w-3 h-3" /> {g.member_count.toLocaleString('en-US')} members</span>
                            )}
                            {g.online_count != null && <span>{g.online_count.toLocaleString('en-US')} online</span>}
                          </div>
                        </div>
                        {g.premium ? (
                          <ShieldCheck className="w-4 h-4 text-yellow-400 shrink-0" />
                        ) : (
                          <ShieldAlert className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="shrink-0 gap-1.5 w-full sm:w-auto justify-center"
                          onClick={() => openOwnerComposer(g)}
                        >
                          <MessageSquare className="w-3.5 h-3.5" /> Message owner
                        </Button>
                      </div>
                    ))}
                  </div>
                  );
                })()}
              </Card>
            )}

            {section === 'enforcement' && (
              <Card className="p-6 bg-card/60 border-red-500/30 relative overflow-hidden">
                <div className="absolute -top-20 -right-20 w-56 h-56 rounded-full bg-red-500/10 blur-3xl pointer-events-none" />
                <div className="relative space-y-4">
                  <div>
                    <div className="font-semibold flex items-center gap-2 text-red-400">
                      <ShieldAlert className="w-4 h-4" /> Server enforcement
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Owner-only server bans. A ban is stored server-side, the server owner is notified when possible, and Wody leaves the server.
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="guild-ban-message" className="flex items-center gap-2"><MessageSquare className="w-3.5 h-3.5" /> Message to server owner (optional)</Label>
                    <Textarea id="guild-ban-message" value={banMessage} onChange={(e) => setBanMessage(e.target.value)} maxLength={1800}
                      placeholder="Explain why the server is being blocked…" className="mt-2 min-h-20" />
                  </div>
                  {allServersLoading || guildBansLoading ? (
                    <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
                  ) : allServers.length === 0 ? (
                    <div className="text-sm text-muted-foreground py-4">No servers found.</div>
                  ) : (
                    <div className="max-h-[520px] overflow-y-auto space-y-2 pr-1">
                      {allServers.map((guild) => {
                        const banned = isGuildBanned(guild.id);
                        const busy = banBusy === guild.id;
                        return (
                          <div key={guild.id} className={`flex items-center gap-3 rounded-xl border p-3 ${banned ? 'border-red-500/30 bg-red-500/5' : 'border-border/50 bg-background/20'}`}>
                            {guild.icon_url ? <img src={discordCdnUrl(guild.icon_url)} alt="" className="w-10 h-10 rounded-xl" /> : <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center"><Server className="w-4 h-4" /></div>}
                            <div className="min-w-0 flex-1">
                              <div className="font-medium text-sm truncate">{guild.name}</div>
                              <div className="text-xs text-muted-foreground truncate">{guild.id}{banned ? ' · Banned' : ''}</div>
                            </div>
                            {banned ? (
                              <Button size="sm" variant="outline" onClick={() => setGuildBan(guild, 'unban')} disabled={busy} className="gap-1.5 border-green-500/30 text-green-400 hover:bg-green-500/10">
                                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Undo2 className="w-3.5 h-3.5" />} Unban
                              </Button>
                            ) : (
                              <Button size="sm" variant="outline" onClick={() => setGuildBan(guild, 'ban')} disabled={busy} className="gap-1.5 border-red-500/30 text-red-400 hover:bg-red-500/10">
                                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Ban className="w-3.5 h-3.5" />} Ban server
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Banned servers, listed on their own, independent of the list
                      above. As soon as a ban goes through, Wody leaves the server
                      (see the /owner/guild-bans/:id/ban route), which means that
                      server disappears from allServers (Wody's current guild
                      list) immediately. Without this separate section sourced
                      straight from the guild_bans collection, an enforced ban
                      became invisible in the UI the moment it actually took
                      effect, the only place left to prove it was even banned was
                      the database itself, with no way to review or undo it from
                      here. Shown for every ban with active:true regardless of
                      whether Wody is currently in that server. */}
                  <div className="pt-2 border-t border-border/40">
                    <div className="flex items-center gap-2 mt-4 mb-3">
                      <Ban className="w-3.5 h-3.5 text-red-400" />
                      <span className="text-sm font-semibold">Banned servers</span>
                      {!guildBansLoading && (
                        <Badge variant="outline" className="text-[10px] border-red-500/30 text-red-400">
                          {guildBans.filter((b) => b.active).length}
                        </Badge>
                      )}
                    </div>
                    {guildBansLoading ? (
                      <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
                    ) : guildBans.filter((b) => b.active).length === 0 ? (
                      <div className="text-sm text-muted-foreground py-2">No servers are currently banned.</div>
                    ) : (
                      <div className="space-y-2">
                        {guildBans.filter((b) => b.active).map((ban) => {
                          const busy = banBusy === ban.guild_id;
                          // A banned server that Wody already left has no live
                          // Discord data to show, fall back to what was captured
                          // at the moment it was banned (see the ban route), and
                          // only as a last resort (bans made before that capture
                          // existed) to the bare id.
                          const label = ban.name || `Server ${ban.guild_id}`;
                          return (
                            <div key={ban._id || ban.guild_id} className="flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/5 p-3">
                              {ban.icon_url ? <img src={discordCdnUrl(ban.icon_url)} alt="" className="w-10 h-10 rounded-xl" /> : <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center"><Server className="w-4 h-4" /></div>}
                              <div className="min-w-0 flex-1">
                                <div className="font-medium text-sm truncate">{label}</div>
                                <div className="text-xs text-muted-foreground truncate">
                                  {ban.guild_id}
                                  {ban.banned_at ? ` · Banned ${new Date(ban.banned_at).toLocaleDateString()}` : ''}
                                </div>
                              </div>
                              <Button size="sm" variant="outline" onClick={() => setGuildBan({ id: ban.guild_id, name: ban.name }, 'unban')} disabled={busy} className="gap-1.5 border-green-500/30 text-green-400 hover:bg-green-500/10">
                                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Undo2 className="w-3.5 h-3.5" />} Unban
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            )}

            {section === 'updates' && (
              <div className="space-y-6">
                {/* Post an update (public /updates page) */}
                <Card className="p-6 bg-card/60 border-[#a04820]/40 relative overflow-hidden">
                  <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-[#a04820]/15 blur-3xl pointer-events-none" />
                  <div className="relative">
                    <div className="font-semibold mb-1 flex items-center gap-2 text-[#e08a4e]">
                      <Megaphone className="w-4 h-4" /> Post an update
                    </div>
                    <p className="text-xs text-muted-foreground mb-4">
                      Published instantly to the public <a href="/updates" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">Updates page</a>.
                    </p>
                    <div className="grid sm:grid-cols-[1fr_180px] gap-3 mb-3">
                      <div>
                        <Label>Title</Label>
                        <Input value={updTitle} onChange={(e) => setUpdTitle(e.target.value)} placeholder="e.g. Reaction Roles v2 is live" maxLength={150} />
                      </div>
                      <div>
                        <Label>Tag</Label>
                        <Select value={updTag} onValueChange={setUpdTag}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {UPDATE_TAGS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="mb-3">
                      <Label>Body</Label>
                      <RichTextEditor
                        value={updBody}
                        onChange={setUpdBody}
                        placeholder="What changed, what it fixes, or what's new..."
                        maxLength={5000}
                        rows={5}
                      />
                    </div>
                    <Button onClick={postUpdate} disabled={updBusy} className="gradient-primary w-full sm:w-auto">
                      {updBusy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                      Post update
                    </Button>
                  </div>
                </Card>

                {/* Posted updates */}
                <Card className="p-6 bg-card/60">
                  <div className="flex items-center justify-between mb-3">
                    <div className="font-semibold flex items-center gap-2"><Megaphone className="w-4 h-4" /> Posted updates</div>
                    <Button variant="outline" size="sm" onClick={loadUpdates}><RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh</Button>
                  </div>
                  {updatesLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : updates.length === 0 ? (
                    <div className="text-xs text-muted-foreground">No updates posted yet.</div>
                  ) : (
                    <div className="space-y-2 max-h-96 overflow-y-auto scrollbar-thin pr-1">
                      {updates.map((u) => (
                        <div key={u._id} className="rounded-lg border border-border/50 p-3 flex items-start gap-3 text-sm">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <span className="font-medium truncate">{u.title}</span>
                              <Badge variant="outline" className="text-[10px]">{u.tag || 'Update'}</Badge>
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              {u.created_at ? new Date(u.created_at).toLocaleDateString('en-US') : ''} · {u.body}
                            </div>
                          </div>
                          <button
                            onClick={() => deleteUpdate(u._id, u.title)}
                            disabled={deletingUpdate === u._id}
                            title="Delete"
                            className="text-muted-foreground hover:text-destructive shrink-0"
                          >
                            {deletingUpdate === u._id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </div>
            )}

            {section === 'blog' && (
              <div className="space-y-6">
                <Card className="p-6 bg-card/60 border-[#a04820]/40 relative overflow-hidden">
                  <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-[#a04820]/15 blur-3xl pointer-events-none" />
                  <div className="relative">
                    <div className="font-semibold mb-1 flex items-center gap-2 text-[#e08a4e]">
                      <BookOpen className="w-4 h-4" /> {blogEditingId ? 'Edit post' : 'New post'}
                    </div>
                    <p className="text-xs text-muted-foreground mb-4">
                      Published posts appear instantly on the public <a href="/blog" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">Blog page</a> and in the sitemap.
                    </p>

                    <div className="grid sm:grid-cols-2 gap-3 mb-3">
                      <div>
                        <Label>Title</Label>
                        <Input
                          value={blogForm.title}
                          onChange={(e) => {
                            const title = e.target.value;
                            setBlogForm((prev) => ({
                              ...prev,
                              title,
                              slug: blogSlugTouched ? prev.slug : title.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
                            }));
                          }}
                          maxLength={140}
                        />
                      </div>
                      <div>
                        <Label>Slug</Label>
                        <Input
                          value={blogForm.slug}
                          onChange={(e) => { setBlogSlugTouched(true); setBlogForm((prev) => ({ ...prev, slug: e.target.value })); }}
                          placeholder="auto-generated-from-title"
                          maxLength={100}
                        />
                        <p className="text-[11px] text-muted-foreground mt-1">wody.online/blog/<span className="text-foreground/70">{blogForm.slug || '...'}</span></p>
                      </div>
                    </div>

                    <div className="mb-3">
                      <Label>Excerpt</Label>
                      <Input
                        value={blogForm.excerpt}
                        onChange={(e) => setBlogForm((prev) => ({ ...prev, excerpt: e.target.value }))}
                        placeholder="One or two sentences shown on the blog list and used as a fallback meta description."
                        maxLength={240}
                      />
                    </div>

                    <div className="mb-3">
                      <Label>Content</Label>
                      <RichTextEditor
                        value={blogForm.content}
                        onChange={(v) => setBlogForm((prev) => ({ ...prev, content: v }))}
                        placeholder="Write the post here..."
                        maxLength={20000}
                        rows={12}
                      />
                    </div>

                    <div className="grid sm:grid-cols-2 gap-3 mb-3">
                      <div>
                        <Label>Cover image URL</Label>
                        <Input
                          value={blogForm.cover_image_url}
                          onChange={(e) => setBlogForm((prev) => ({ ...prev, cover_image_url: e.target.value }))}
                          placeholder="https://example.com/cover.webp"
                        />
                      </div>
                      <div>
                        <Label>Author name</Label>
                        <Input
                          value={blogForm.author_name}
                          onChange={(e) => setBlogForm((prev) => ({ ...prev, author_name: e.target.value }))}
                          placeholder="Wody Team"
                          maxLength={60}
                        />
                      </div>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-3 mb-4">
                      <div>
                        <Label className="mb-1.5 block">SEO title (optional)</Label>
                        <Input
                          value={blogForm.seo_title}
                          onChange={(e) => setBlogForm((prev) => ({ ...prev, seo_title: e.target.value }))}
                          placeholder="Falls back to the title above"
                          maxLength={70}
                        />
                      </div>
                      <div>
                        <Label className="mb-1.5 block">SEO description (optional)</Label>
                        <Input
                          value={blogForm.seo_description}
                          onChange={(e) => setBlogForm((prev) => ({ ...prev, seo_description: e.target.value }))}
                          placeholder="Falls back to the excerpt above"
                          maxLength={160}
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-3 mb-4">
                      <Switch checked={blogForm.published} onCheckedChange={(v) => setBlogForm((prev) => ({ ...prev, published: v }))} />
                      <span className="text-sm">{blogForm.published ? 'Published' : 'Draft (not visible on the site yet)'}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 [&>button]:min-w-[8.5rem] [&>button]:justify-center max-sm:[&>button]:flex-1">
                      <Button onClick={saveBlogPost} disabled={blogSaving} className="gradient-primary">
                        {blogSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                        {blogEditingId ? 'Save changes' : 'Publish post'}
                      </Button>
                      {blogEditingId && (
                        <Button variant="ghost" onClick={startNewBlogPost}><X className="w-4 h-4 mr-1.5" /> Cancel edit</Button>
                      )}
                    </div>
                  </div>
                </Card>

                <Card className="p-6 bg-card/60">
                  <div className="flex items-center justify-between mb-3">
                    <div className="font-semibold flex items-center gap-2"><BookOpen className="w-4 h-4" /> All posts</div>
                    <Button variant="outline" size="sm" onClick={loadBlogPosts}><RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh</Button>
                  </div>
                  {blogLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : blogPosts.length === 0 ? (
                    <div className="text-xs text-muted-foreground">No posts yet.</div>
                  ) : (
                    <div className="space-y-2">
                      {blogPosts.map((p) => (
                        <div key={p._id} className="rounded-lg border border-border/50 p-3 flex flex-wrap items-center gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium flex items-center gap-2 min-w-0">
                              <span className="truncate min-w-0">{p.title}</span>
                              {!p.published && <Badge variant="secondary" className="text-[10px] shrink-0">Draft</Badge>}
                            </div>
                            <div className="text-xs text-muted-foreground truncate">/blog/{p.slug}</div>
                          </div>
                          <Button size="sm" variant="outline" onClick={() => startEditBlogPost(p)}><Pencil className="w-3.5 h-3.5 mr-1.5" /> Edit</Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => deleteBlogPost(p._id, p.title)}
                            disabled={blogDeletingId === p._id}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            {blogDeletingId === p._id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </div>
            )}

            {section === 'staff' && (
              <div className="space-y-6">
                <Card className="p-6 bg-card/60 border-[#a04820]/40 relative overflow-hidden">
                  <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-[#a04820]/15 blur-3xl pointer-events-none" />
                  <div className="relative">
                    <div className="font-semibold mb-1 flex items-center gap-2 text-[#e08a4e]">
                      <Users className="w-4 h-4" /> {staffEditingId ? 'Edit team member' : 'Add team member'}
                    </div>
                    <p className="text-xs text-muted-foreground mb-4">
                      Only a Discord user ID is stored here, their name and avatar are always pulled live from Discord, shown on the public <a href="/team" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">Team page</a>.
                    </p>

                    <div className="mb-4">
                      <Label className="mb-1.5 block">Discord user ID</Label>
                      <div className="flex gap-2">
                        <Input
                          value={staffForm.discord_user_id}
                          onChange={(e) => { setStaffForm((prev) => ({ ...prev, discord_user_id: e.target.value.trim() })); setStaffLookupResult(null); }}
                          placeholder="932582842351898644"
                          disabled={!!staffEditingId}
                        />
                        {!staffEditingId && (
                          <Button type="button" variant="outline" onClick={lookupStaffDiscordUser} disabled={staffLookingUp} className="shrink-0">
                            {staffLookingUp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                          </Button>
                        )}
                      </div>
                      {staffLookupResult && (
                        <div className="mt-2 flex items-center gap-2.5 rounded-lg border border-border/50 bg-background/40 p-2.5">
                          {staffLookupResult.avatar_url ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img src={discordCdnUrl(staffLookupResult.avatar_url)} alt="" className="w-8 h-8 rounded-full" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-secondary" />
                          )}
                          <span className="text-sm font-medium">{staffLookupResult.name}</span>
                        </div>
                      )}
                    </div>

                    <div className="grid sm:grid-cols-2 gap-3 mb-3">
                      <div>
                        <Label>Rank</Label>
                        <Input
                          value={staffForm.rank}
                          onChange={(e) => setStaffForm((prev) => ({ ...prev, rank: e.target.value }))}
                          placeholder="Head Admin"
                          maxLength={40}
                        />
                        <p className="text-[11px] text-muted-foreground mt-1">The title shown on their card. Multiple members can share the same rank.</p>
                      </div>
                      <div>
                        <Label>Hierarchy group</Label>
                        <Input
                          value={staffForm.hierarchy}
                          onChange={(e) => setStaffForm((prev) => ({ ...prev, hierarchy: e.target.value }))}
                          placeholder="Leadership"
                          maxLength={40}
                        />
                        <p className="text-[11px] text-muted-foreground mt-1">Which section of the Team page they're grouped under.</p>
                      </div>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-3 mb-4">
                      <div>
                        <Label>Position in group</Label>
                        <Input
                          type="number"
                          value={staffForm.position}
                          onChange={(e) => setStaffForm((prev) => ({ ...prev, position: Number(e.target.value) || 0 }))}
                        />
                        <p className="text-[11px] text-muted-foreground mt-1">Lower shows first. Easier to adjust with the arrows in the list below.</p>
                      </div>
                      <div>
                        <Label>Group order</Label>
                        <Input
                          type="number"
                          value={staffForm.hierarchy_position}
                          onChange={(e) => setStaffForm((prev) => ({ ...prev, hierarchy_position: Number(e.target.value) || 0 }))}
                        />
                        <p className="text-[11px] text-muted-foreground mt-1">Lower groups show first (e.g. Leadership before Support).</p>
                      </div>
                    </div>

                    <div className="mb-4">
                      <Label className="mb-1.5 block">Social links (optional)</Label>
                      <p className="text-[11px] text-muted-foreground mb-2">Shown as small icon-only buttons under their rank on the public Team page. Leave a field empty to hide that icon. "Discord" here is a direct link (profile or server invite), it doesn't have to match the Discord user ID above.</p>
                      <div className="grid sm:grid-cols-2 gap-2.5">
                        {[
                          ['discord', 'Discord', 'https://discord.com/users/…'],
                          ['youtube', 'YouTube', 'https://youtube.com/@…'],
                          ['instagram', 'Instagram', 'https://instagram.com/…'],
                          ['facebook', 'Facebook', 'https://facebook.com/…'],
                          ['tiktok', 'TikTok', 'https://tiktok.com/@…'],
                          ['twitter', 'Twitter / X', 'https://x.com/…'],
                        ].map(([key, label, placeholder]) => (
                          <div key={key}>
                            <Input
                              value={staffForm.socials?.[key] || ''}
                              onChange={(e) => setStaffForm((prev) => ({ ...prev, socials: { ...prev.socials, [key]: e.target.value } }))}
                              placeholder={`${label}: ${placeholder}`}
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 [&>button]:min-w-[8.5rem] [&>button]:justify-center max-sm:[&>button]:flex-1">
                      <Button onClick={saveStaffMember} disabled={staffSaving} className="gradient-primary">
                        {staffSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                        {staffEditingId ? 'Save changes' : 'Add to team'}
                      </Button>
                      {staffEditingId && (
                        <Button variant="ghost" onClick={startNewStaffMember}><X className="w-4 h-4 mr-1.5" /> Cancel edit</Button>
                      )}
                    </div>
                  </div>
                </Card>

                <Card className="p-6 bg-card/60">
                  <div className="flex items-center justify-between mb-3">
                    <div className="font-semibold flex items-center gap-2"><Users className="w-4 h-4" /> Team members</div>
                    <Button variant="outline" size="sm" onClick={loadStaff}><RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh</Button>
                  </div>
                  {staffLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : staffMembers.length === 0 ? (
                    <div className="text-xs text-muted-foreground">No team members yet.</div>
                  ) : (
                    (() => {
                      const groups = new Map();
                      for (const m of staffMembers) {
                        if (!groups.has(m.hierarchy)) groups.set(m.hierarchy, []);
                        groups.get(m.hierarchy).push(m);
                      }
                      return (
                        <div className="space-y-5">
                          {[...groups.entries()].map(([hierarchy, members]) => (
                            <div key={hierarchy}>
                              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{hierarchy}</div>
                              <div className="space-y-2">
                                {members.map((m, i) => (
                                  <div key={m.id} className="rounded-lg border border-border/50 p-3 flex flex-wrap items-center gap-3">
                                    {m.avatar_url ? (
                                      /* eslint-disable-next-line @next/next/no-img-element */
                                      <img src={discordCdnUrl(m.avatar_url)} alt="" className="w-8 h-8 rounded-full shrink-0" />
                                    ) : (
                                      <div className="w-8 h-8 rounded-full bg-secondary shrink-0" />
                                    )}
                                    <div className="min-w-0 flex-1">
                                      <div className="text-sm font-medium truncate">{m.name}</div>
                                      <div className="text-xs text-muted-foreground truncate">{m.rank}</div>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                      <Button size="icon" variant="ghost" onClick={() => moveStaffMember(m, 'up')} disabled={i === 0} className="h-7 w-7"><ArrowUp className="w-3.5 h-3.5" /></Button>
                                      <Button size="icon" variant="ghost" onClick={() => moveStaffMember(m, 'down')} disabled={i === members.length - 1} className="h-7 w-7"><ArrowDown className="w-3.5 h-3.5" /></Button>
                                      <Button size="sm" variant="outline" onClick={() => startEditStaffMember(m)}><Pencil className="w-3.5 h-3.5" /></Button>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        onClick={() => deleteStaffMember(m.id, m.name)}
                                        disabled={staffDeletingId === m.id}
                                        className="text-muted-foreground hover:text-destructive h-7 w-7"
                                      >
                                        {staffDeletingId === m.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()
                  )}
                </Card>
              </div>
            )}

            {section === 'community' && <CommunityAdminPanel />}
            {section === 'collab' && <CollabAdminPanel ownerOnly={!restricted} />}
            {section === 'access' && !restricted && <OwnerAccessAdmin />}
            {section === 'partners' && <PartnersAdmin />}

            {section === 'appearance' && (
              <div className="space-y-6">
                {/* Category chips: wrap onto multiple rows on a narrow
                    screen instead of needing horizontal scroll or a
                    dropdown, each is just a plain button so tapping one
                    is a single, obvious action on mobile too. */}
                <div className="flex flex-wrap gap-2">
                  {APPEARANCE_CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setAppearanceCategory(cat.id)}
                      className={`flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs sm:text-sm font-medium transition-colors ${
                        appearanceCategory === cat.id
                          ? 'border-[#e08a4e] bg-[#e08a4e]/15 text-[#e08a4e]'
                          : 'border-border/60 bg-card/40 text-muted-foreground hover:text-foreground hover:border-border'
                      }`}
                    >
                      <cat.icon className="w-3.5 h-3.5" />
                      {cat.label}
                    </button>
                  ))}
                </div>

                {appearanceCategory === 'seasonal' && (
                <Card className="p-6 bg-card/60 border-[#a04820]/40 relative overflow-hidden">
                  <div className="absolute -top-16 -left-16 w-48 h-48 rounded-full bg-[#a04820]/15 blur-3xl pointer-events-none" />
                  <div className="relative">
                    <div className="flex items-center justify-between gap-3 mb-1">
                      <div className="font-semibold flex items-center gap-2 text-[#e08a4e]">
                        <Leaf className="w-4 h-4" /> Seasonal Effects
                      </div>
                      {seasonLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                      ) : (
                        <Switch
                          checked={seasonDraft.enabled}
                          onCheckedChange={(v) => updateSeasonDraft({ enabled: v })}
                        />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground max-w-xl mb-5">
                      Subtle, premium seasonal details layered on top of the existing design. No
                      redesign, no layout changes. This affects the entire public site for every
                      visitor. When off, nothing is loaded: no images, no extra JS, no animations.
                      One season at a time, pick which one below.
                    </p>

                    <div className="mb-5">
                      <Label className="mb-1.5 block">Season</Label>
                      <Select
                        value={seasonDraft.season}
                        onValueChange={(v) => updateSeasonDraft({ season: v })}
                        disabled={!seasonDraft.enabled}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {SEASON_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid sm:grid-cols-3 gap-3 mb-5">
                      {[
                        { key: 'particles', label: 'Falling Pieces' },
                        { key: 'shadows', label: 'Natural Shadows' },
                        { key: 'animations', label: 'Micro Animations' },
                      ].map(({ key, label }) => (
                        <div
                          key={key}
                          className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-card/40 p-3"
                        >
                          <span className="text-sm">{label}</span>
                          <Switch
                            checked={!!seasonDraft.effects[key]}
                            onCheckedChange={(v) => updateSeasonDraft({ effects: { [key]: v } })}
                            disabled={!seasonDraft.enabled}
                          />
                        </div>
                      ))}
                    </div>

                    <div className="grid sm:grid-cols-2 gap-3 mb-5">
                      <div>
                        <Label className="mb-1.5 block">Density</Label>
                        <Select
                          value={seasonDraft.density}
                          onValueChange={(v) => updateSeasonDraft({ density: v })}
                          disabled={!seasonDraft.enabled}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="mb-1.5 block">Intensity</Label>
                        <Select
                          value={seasonDraft.intensity}
                          onValueChange={(v) => updateSeasonDraft({ intensity: v })}
                          disabled={!seasonDraft.enabled}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 [&>button]:min-w-[8.5rem] [&>button]:justify-center max-sm:[&>button]:flex-1">
                      <Button onClick={saveSeason} disabled={seasonSaving || !seasonDirty} className="gradient-primary">
                        {seasonSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                        Save changes
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setSeasonPreview((v) => !v)}
                        disabled={!seasonDraft.enabled}
                      >
                        {seasonPreview ? 'Hide preview' : 'Preview'}
                      </Button>
                      {seasonDirty && (
                        <span className="text-xs text-muted-foreground">Unsaved changes. Visitors still see the last saved version.</span>
                      )}
                    </div>
                  </div>
                </Card>
                )}

                {appearanceCategory === 'showcase' && (
                <Card className="p-6 bg-card/60 border-[#a04820]/40 relative overflow-hidden">
                  <div className="absolute -top-16 -left-16 w-48 h-48 rounded-full bg-[#a04820]/15 blur-3xl pointer-events-none" />
                  <div className="relative">
                    <div className="flex items-center justify-between gap-3 mb-1">
                      <div className="font-semibold flex items-center gap-2 text-[#e08a4e]">
                        <Users className="w-4 h-4" /> Community Showcase
                      </div>
                      {showcaseLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                    </div>
                    <p className="text-xs text-muted-foreground max-w-xl mb-5">
                      Controls the &ldquo;Servers already using Wody&rdquo; strip on the
                      homepage. A server is included automatically as soon as the bot is in it
                      and its member count clears the threshold below, there is nothing else to
                      add it to a list for. When more servers qualify than fit on screen, a
                      random subset is shown and rotates automatically every ~20 minutes, so it
                      isn&apos;t always the same handful of servers.
                    </p>

                    <div className="grid sm:grid-cols-2 gap-3 mb-5">
                      <div>
                        <Label className="mb-1.5 block">Minimum members</Label>
                        <Input
                          type="number"
                          min={0}
                          max={100000}
                          value={showcaseDraft.minMembers}
                          onChange={(e) => setShowcaseDraft((prev) => ({ ...prev, minMembers: e.target.value }))}
                        />
                        <p className="text-[11px] text-muted-foreground mt-1">Servers with more members than this qualify.</p>
                      </div>
                      <div>
                        <Label className="mb-1.5 block">Max servers shown at once</Label>
                        <Input
                          type="number"
                          min={4}
                          max={60}
                          value={showcaseDraft.maxDisplay}
                          onChange={(e) => setShowcaseDraft((prev) => ({ ...prev, maxDisplay: e.target.value }))}
                        />
                        <p className="text-[11px] text-muted-foreground mt-1">Shown as a random, rotating subset once more servers qualify than this.</p>
                      </div>
                    </div>

                    <div className="mb-5">
                      <Label className="mb-1.5 block">Excluded server IDs</Label>
                      <Textarea
                        rows={3}
                        placeholder="One server ID per line, or comma separated"
                        value={showcaseExclusionsText}
                        onChange={(e) => setShowcaseExclusionsText(e.target.value)}
                        className="font-mono text-xs"
                      />
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Servers whose owner asked (via privacy@wody.online) not to appear in the showcase. Never shown here, regardless of member count.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 [&>button]:min-w-[8.5rem] [&>button]:justify-center max-sm:[&>button]:flex-1">
                      <Button onClick={saveShowcase} disabled={showcaseSaving || !showcaseDirty || showcaseLoadFailed} className="gradient-primary">
                        {showcaseSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                        Save changes
                      </Button>
                      {showcaseLoadFailed ? (
                        <span className="text-xs text-red-300">The saved settings could not be loaded. Reload the page; saving is off so the excluded list is not overwritten.</span>
                      ) : showcaseDirty && (
                        <span className="text-xs text-muted-foreground">Unsaved changes. Visitors still see the last saved version.</span>
                      )}
                    </div>
                  </div>
                </Card>
                )}

                {appearanceCategory === 'promo' && (
                <Card className="p-6 bg-card/60 border-[#a04820]/40 relative overflow-hidden">
                  <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-[#a04820]/15 blur-3xl pointer-events-none" />
                  <div className="relative">
                    <div className="flex items-center justify-between gap-3 mb-1">
                      <div className="font-semibold flex items-center gap-2 text-[#e08a4e]">
                        <ImageIcon className="w-4 h-4" /> Promo Banner
                      </div>
                      {bannerLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                    </div>
                    <p className="text-xs text-muted-foreground max-w-xl mb-5">
                      Shown at the top of every server&apos;s dashboard Overview tab, above the module grid.
                      One banner for everyone, an image and a link, with an optional button on top.
                    </p>

                    <div className="flex items-center gap-3 mb-5">
                      <Switch checked={bannerDraft.enabled} onCheckedChange={(v) => setBannerDraft((prev) => ({ ...prev, enabled: v }))} />
                      <span className="text-sm">{bannerDraft.enabled ? 'Shown on dashboards' : 'Hidden'}</span>
                    </div>

                    <div className="mb-4">
                      <Label className="mb-1.5 block">Image</Label>
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <label className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border/60 bg-card/40 px-3 py-2 text-sm font-medium hover:bg-card/80 ${promoUploading ? 'pointer-events-none opacity-60' : ''}`}>
                          <ImageIcon className="h-4 w-4" aria-hidden="true" />{promoUploading ? 'Uploading...' : 'Upload image'}
                          <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" disabled={promoUploading} onChange={(e) => { uploadPromoImage(e.target.files?.[0]); e.target.value = ''; }} />
                        </label>
                        <span className="text-[11px] text-muted-foreground">PNG, JPG, WebP or GIF, up to 3 MB. Or paste a link below.</span>
                      </div>
                      <Input
                        value={bannerDraft.imageUrl}
                        onChange={(e) => setBannerDraft((prev) => ({ ...prev, imageUrl: e.target.value }))}
                        placeholder="https://example.com/banner.webp"
                      />
                      <p className="text-[11px] text-muted-foreground mt-1">A direct link to an image file. WebP loads fastest.</p>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Recommended size: <span className="text-foreground/80 font-medium">2400 × 400 px</span> (6:1), WebP, under 300 KB.
                        Keep text and logos inside the centre third of the image (narrow screens crop the sides) and away from the bottom edge, where the button sits at the right if you set one below.
                      </p>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-3 mb-5">
                      <div>
                        <Label className="mb-1.5 block">Button text (optional)</Label>
                        <Input
                          value={bannerDraft.buttonText}
                          onChange={(e) => setBannerDraft((prev) => ({ ...prev, buttonText: e.target.value.slice(0, 60) }))}
                          placeholder="Learn more"
                        />
                      </div>
                      <div>
                        <Label className="mb-1.5 block">Button link</Label>
                        <Input
                          value={bannerDraft.buttonUrl}
                          onChange={(e) => setBannerDraft((prev) => ({ ...prev, buttonUrl: e.target.value }))}
                          placeholder="https://example.com"
                        />
                      </div>
                    </div>

                    {bannerDraft.enabled && bannerDraft.imageUrl && bannerDraft.buttonUrl && (
                      <div className="mb-5">
                        <Label className="mb-1.5 block text-xs text-muted-foreground">Preview</Label>
                        <PromoBanner banner={bannerDraft} />
                        {!bannerDraft.buttonText && (
                          <p className="text-[11px] text-muted-foreground mt-1.5">No button text set, the whole image links out instead.</p>
                        )}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-3 [&>button]:min-w-[8.5rem] [&>button]:justify-center max-sm:[&>button]:flex-1">
                      <Button onClick={saveBanner} disabled={bannerSaving || !bannerDirty} className="gradient-primary">
                        {bannerSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                        Save changes
                      </Button>
                      {bannerDirty && (
                        <span className="text-xs text-muted-foreground">Unsaved changes.</span>
                      )}
                    </div>
                  </div>
                </Card>
                )}

                {appearanceCategory === 'countdown' && (
                <Card className="p-6 bg-card/60 border-[#a04820]/40 relative overflow-hidden">
                  <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-[#a04820]/15 blur-3xl pointer-events-none" />
                  <div className="relative">
                    <div className="flex items-center justify-between gap-3 mb-1">
                      <div className="font-semibold flex items-center gap-2 text-[#e08a4e]">
                        <Timer className="w-4 h-4" /> Countdown Banner
                      </div>
                      {countdownLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                    </div>
                    <p className="text-xs text-muted-foreground max-w-xl mb-5">
                      A minimal bar at the top, across the whole public site (not inside a
                      server&apos;s dashboard), with a text and a countdown to a fixed moment.
                      Stores nothing in visitors&apos; browsers.
                    </p>

                    <div className="flex items-center gap-3 mb-5">
                      <Switch checked={countdownDraft.enabled} onCheckedChange={(v) => setCountdownDraft((prev) => ({ ...prev, enabled: v }))} />
                      <span className="text-sm">{countdownDraft.enabled ? 'Shown on the site' : 'Hidden'}</span>
                    </div>

                    <div className="mb-5">
                      <div className="flex items-center justify-between mb-1.5">
                        <Label>Text</Label>
                        <span className="text-[11px] text-muted-foreground">{countdownDraft.text.length}/200</span>
                      </div>
                      <Input
                        value={countdownDraft.text}
                        onChange={(e) => setCountdownDraft((prev) => ({ ...prev, text: e.target.value.slice(0, 200) }))}
                        placeholder="Event"
                        maxLength={200}
                      />
                    </div>

                    <div className="mb-2">
                      <Label className="mb-1.5 block">Set an exact date and time</Label>
                      <Input
                        type="datetime-local"
                        value={countdownExactDate}
                        onChange={(e) => setCountdownExactDate(e.target.value)}
                        className="max-w-xs [color-scheme:dark]"
                      />
                      <p className="text-[11px] text-muted-foreground mt-2">
                        Pick exactly when the countdown ends (your local time, from your browser).
                        The remaining time is calculated automatically on the site, no need to
                        count the days yourself.
                        {countdownSaved.target_at && (
                          <> The current countdown ends on {new Date(countdownSaved.target_at).toLocaleString()}.</>
                        )}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 my-4">
                      <div className="h-px flex-1 bg-border/60" />
                      <span className="text-[11px] text-muted-foreground">OR</span>
                      <div className="h-px flex-1 bg-border/60" />
                    </div>

                    <div className="mb-2">
                      <Label className="mb-1.5 block">Start a new countdown from now</Label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {[
                          ['days', 'Days'],
                          ['hours', 'Hours'],
                          ['minutes', 'Minutes'],
                          ['seconds', 'Seconds'],
                        ].map(([key, label]) => (
                          <div key={key}>
                            <Input
                              type="number"
                              min={0}
                              value={countdownDuration[key]}
                              disabled={!!countdownExactDate}
                              onChange={(e) => setCountdownDuration((prev) => ({ ...prev, [key]: Math.max(0, Number(e.target.value) || 0) }))}
                            />
                            <span className="text-[10px] text-muted-foreground block text-center mt-1">{label}</span>
                          </div>
                        ))}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-2">
                        Leave all four at 0 to keep the running countdown unchanged, they aren&apos;t
                        saved as-is, they only compute a new end date the moment you hit Save. If an
                        exact date is filled in above, it takes priority and these fields are
                        ignored on save.
                      </p>
                    </div>

                    <div className="mb-5">
                      <Label className="mb-1.5 block">Text after it ends (optional)</Label>
                      <Input
                        value={countdownDraft.ended_text}
                        onChange={(e) => setCountdownDraft((prev) => ({ ...prev, ended_text: e.target.value.slice(0, 100) }))}
                        placeholder="It's started!"
                      />
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Empty means the bar disappears on its own once the countdown hits zero.
                      </p>
                    </div>

                    <div className="mb-5 rounded-xl border border-border/60 bg-secondary/10 p-4">
                      <Label className="mb-1.5 block">Background image (optional)</Label>
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <label className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border/60 bg-card/40 px-3 py-2 text-sm font-medium hover:bg-card/80 ${countdownUploading ? 'pointer-events-none opacity-60' : ''}`}>
                          <ImageIcon className="h-4 w-4" aria-hidden="true" />{countdownUploading ? 'Uploading...' : 'Upload image'}
                          <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" disabled={countdownUploading} onChange={(e) => { uploadCountdownImage(e.target.files?.[0]); e.target.value = ''; }} />
                        </label>
                        <span className="text-[11px] text-muted-foreground">PNG, JPG, WebP or GIF, up to 3 MB. Or paste a link below.</span>
                      </div>
                      <Input
                        type="text"
                        inputMode="url"
                        value={countdownDraft.background_url || ''}
                        onChange={(e) => setCountdownDraft((prev) => ({ ...prev, background_url: e.target.value.slice(0, 2048) }))}
                        placeholder="https://example.com/banner.jpg"
                      />
                      <p className="text-[11px] text-muted-foreground mt-2">
                        Fills the whole bar, edge to edge, across its full width and height (it is cropped to fit, never
                        stretched). A wide image works best, for example 2400×120 or 1920×100. Leave empty for the default
                        bronze bar.
                      </p>
                      {countdownDraft.background_url ? (
                        <div className="mt-3">
                          <div className="flex items-center justify-between mb-1.5">
                            <Label className="text-xs">Darken the image so the text stays readable</Label>
                            <span className="text-[11px] text-muted-foreground tabular-nums">{countdownDraft.background_dim ?? 45}%</span>
                          </div>
                          <input type="range" min="0" max="85" value={countdownDraft.background_dim ?? 45} onChange={(e) => setCountdownDraft((prev) => ({ ...prev, background_dim: Number(e.target.value) }))} className="w-full accent-[#c46a2d]" />
                          <button type="button" onClick={() => setCountdownDraft((prev) => ({ ...prev, background_url: '' }))} className="mt-2 text-[11px] text-red-300 hover:text-red-200">Remove image</button>
                        </div>
                      ) : null}
                    </div>

                    {countdownDraft.enabled && countdownDraft.text && (
                      <div className="mb-5">
                        <Label className="mb-1.5 block text-xs text-muted-foreground">Preview</Label>
                        <CountdownBannerPreview draft={countdownDraft} duration={countdownDuration} exactDate={countdownExactDate} />
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-3 [&>button]:min-w-[8.5rem] [&>button]:justify-center max-sm:[&>button]:flex-1">
                      <Button onClick={saveCountdownBanner} disabled={countdownSaving || !countdownDirty} className="gradient-primary">
                        {countdownSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                        Save
                      </Button>
                      {countdownDirty && (
                        <span className="text-xs text-muted-foreground">Unsaved changes.</span>
                      )}
                    </div>
                  </div>
                </Card>
                )}

                {appearanceCategory === 'footer' && (
                <Card className="p-6 bg-card/60 border-[#a04820]/40 relative overflow-hidden">
                  <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-[#a04820]/15 blur-3xl pointer-events-none" />
                  <div className="relative">
                    <div className="flex items-center justify-between gap-3 mb-1">
                      <div className="font-semibold flex items-center gap-2 text-[#e08a4e]">
                        <Share2 className="w-4 h-4" /> Footer Social Links
                      </div>
                      {footerLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                    </div>
                    <p className="text-xs text-muted-foreground max-w-xl mb-5">
                      The round buttons in the footer of every page, next to the e-mail button. Same platforms and same link rules as the
                      profile: paste a link or just the handle. The layout adapts to how many there are, on phone and on PC.
                    </p>

                    <div className="grid gap-3 sm:grid-cols-2">
                      {SOCIALS.filter((p) => footerShown.has(p.id)).map((p) => {
                        const Icon = SOCIAL_ICONS[p.id];
                        const bad = footerErrors[p.id];
                        return (
                          <div key={p.id}>
                            <Label className="mb-1.5 flex items-center gap-1.5"><Icon className="h-3.5 w-3.5" />{p.label}</Label>
                            <div className="flex items-center gap-2">
                              <Input
                                value={footerDraft[p.id] || ''}
                                maxLength={200}
                                inputMode="url"
                                autoCapitalize="none"
                                autoCorrect="off"
                                spellCheck={false}
                                placeholder={p.placeholder}
                                aria-invalid={bad ? 'true' : undefined}
                                className={`min-w-0 flex-1 ${bad ? 'border-destructive' : ''}`}
                                onChange={(e) => setFooterDraft((prev) => ({ ...prev, [p.id]: e.target.value }))}
                              />
                              <button type="button" aria-label={`Remove ${p.label}`} title="Remove"
                                onClick={() => { setFooterDraft((prev) => { const n = { ...prev }; delete n[p.id]; return n; }); setFooterShown((prev) => { const n = new Set(prev); n.delete(p.id); return n; }); }}
                                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-card/40 text-muted-foreground transition-colors hover:border-destructive/60 hover:text-destructive">
                                <X className="h-4 w-4" aria-hidden="true" />
                              </button>
                            </div>
                            {bad && <p className="mt-1 text-xs text-destructive">{bad}</p>}
                          </div>
                        );
                      })}
                    </div>

                    {SOCIALS.some((p) => !footerShown.has(p.id)) && (
                      <div className="mt-4">
                        <p className="text-xs font-medium text-muted-foreground">Add a platform</p>
                        <ul className="mt-1.5 flex flex-wrap gap-2">
                          {SOCIALS.filter((p) => !footerShown.has(p.id)).map((p) => {
                            const Icon = SOCIAL_ICONS[p.id];
                            return (
                              <li key={p.id}>
                                <button type="button" onClick={() => setFooterShown((prev) => new Set(prev).add(p.id))} aria-label={`Add ${p.label}`} title={p.label}
                                  className="inline-flex h-10 items-center gap-1.5 rounded-full border border-border/60 bg-secondary/40 px-3 text-xs font-medium text-muted-foreground transition-colors hover:border-[#e6cd8c] hover:text-foreground">
                                  <Icon className="h-4 w-4" /><span>{p.label}</span>
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}

                    <div className="mt-5 mb-5 rounded-xl border border-border/60 bg-secondary/10 p-4">
                      <Label className="mb-3 block text-xs text-muted-foreground">Preview</Label>
                      <SocialLinks
                        variant="footer"
                        label="Footer social links"
                        socials={Object.fromEntries(Object.entries(footerDraft).filter(([k, v]) => footerShown.has(k) && /^https:\/\//i.test(String(v || ''))))}
                      />
                      <p className="mt-3 text-[11px] text-muted-foreground">Only links that start with https:// show here. Handles are turned into full links when you save.</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 [&>button]:min-w-[8.5rem] [&>button]:justify-center max-sm:[&>button]:flex-1">
                      <Button onClick={saveFooterSocials} disabled={footerSaving || !footerDirty} className="gradient-primary">
                        {footerSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                        Save changes
                      </Button>
                      <Button variant="outline" onClick={loadFooterSocials} disabled={footerSaving || !footerDirty}>Discard</Button>
                    </div>
                  </div>
                </Card>
                )}

                {appearanceCategory === 'discord' && (
                <Card className="p-6 bg-card/60 border-[#a04820]/40 relative overflow-hidden">
                  <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-[#a04820]/15 blur-3xl pointer-events-none" />
                  <div className="relative">
                    <div className="flex items-center justify-between gap-3 mb-1">
                      <div className="font-semibold flex items-center gap-2 text-[#e08a4e]">
                        <Share2 className="w-4 h-4" /> Discord Link Preview
                      </div>
                      {ogLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                    </div>
                    <p className="text-xs text-muted-foreground max-w-xl mb-5">
                      The card Discord (and other sites) shows when someone pastes wody.online in
                      chat. Title, subtitle, tagline and the module list are all set here, the
                      image itself is generated automatically from them. Discord fetches this as a
                      plain, static picture, so it can&apos;t carry motion, that&apos;s a Discord
                      limit on every site&apos;s link preview, not something this can turn on. The
                      matching text live on wody.online itself (homepage, Team, Blog, Careers) does
                      animate.
                    </p>

                    <div className="mb-5">
                      <Label className="mb-2 block">Card look</Label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="radiogroup" aria-label="Card look">
                        {OG_LOOKS.map((look) => {
                          const active = ogDraft.variant === look.id;
                          return (
                            <button
                              key={look.id}
                              type="button"
                              role="radio"
                              aria-checked={active}
                              onClick={() => setOgDraft((prev) => ({ ...prev, variant: look.id }))}
                              className={`text-left rounded-xl border p-2 transition-colors ${active ? 'border-primary bg-primary/10 ring-1 ring-primary' : 'border-border/60 bg-background/40 hover:border-border'}`}
                            >
                              <img
                                src={`/api/og?variant=${look.id}&v=${ogPreviewNonce}`}
                                alt={`${look.name} card preview`}
                                width="1200"
                                height="630"
                                loading="lazy"
                                decoding="async"
                                className="w-full h-auto rounded-lg border border-border/40"
                              />
                              <div className="px-1 pt-2 pb-1">
                                <div className="text-sm font-semibold flex items-center gap-2">
                                  {look.name}
                                  {active && <span className="text-[10px] uppercase tracking-wider text-primary">Selected</span>}
                                </div>
                                <p className="text-[11px] text-muted-foreground leading-snug">{look.note}</p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-2">
                        Pick one and press Save changes. Every look shows the module list below, so edit it there once.
                      </p>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-3 mb-4">
                      <div>
                        <Label className="mb-1.5 block">Title</Label>
                        <Input
                          value={ogDraft.title}
                          onChange={(e) => setOgDraft((prev) => ({ ...prev, title: e.target.value }))}
                          maxLength={40}
                        />
                      </div>
                      <div>
                        <Label className="mb-1.5 block">Subtitle</Label>
                        <Input
                          value={ogDraft.subtitle}
                          onChange={(e) => setOgDraft((prev) => ({ ...prev, subtitle: e.target.value }))}
                          maxLength={80}
                        />
                      </div>
                    </div>
                    <div className="mb-4">
                      <Label className="mb-1.5 block">Tagline</Label>
                      <Input
                        value={ogDraft.tagline}
                        onChange={(e) => setOgDraft((prev) => ({ ...prev, tagline: e.target.value }))}
                        maxLength={120}
                      />
                    </div>
                    <div className="mb-5">
                      <Label className="mb-1.5 block">Modules (one per line)</Label>
                      <Textarea
                        rows={8}
                        value={ogModulesText}
                        onChange={(e) => setOgModulesText(e.target.value)}
                        className="font-mono text-xs"
                      />
                      <p className="text-[11px] text-muted-foreground mt-1">Shown as pills on the card, in this order. Up to 24.</p>
                    </div>

                    <div className="mb-5">
                      <Label className="mb-1.5 block">Custom image / GIF (optional)</Label>
                      <Input
                        value={ogDraft.media_url}
                        onChange={(e) => setOgDraft((prev) => ({ ...prev, media_url: e.target.value }))}
                        placeholder="https://example.com/wody.gif"
                      />
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Add a link here and it completely replaces the generated card below, the
                        title, text and modules stop being built from text, your picture or gif
                        shows up directly instead. Recommended 1200x630px (same format as any link
                        preview). Discord only ever shows one static frame of a gif, it won&apos;t
                        play it animated, that&apos;s a Discord limit on every site, not something
                        that can be turned on from here. Leave blank to go back to the
                        auto-generated card.
                      </p>
                    </div>

                    <div className="mb-5">
                      <div className="flex items-center justify-between mb-1.5">
                        <Label>Buttons</Label>
                        <span className="text-[11px] text-muted-foreground">{ogDraft.buttons.length}/{MAX_OG_BUTTONS}</span>
                      </div>
                      <div className="space-y-2">
                        {ogDraft.buttons.map((b, i) => (
                          <div
                            key={i}
                            className="rounded-lg border border-border/40 p-3 sm:border-0 sm:p-0 sm:flex sm:items-center sm:gap-2"
                          >
                            <div className="flex items-center gap-2">
                              <GripVertical className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                              <Input
                                value={b.label}
                                onChange={(e) => updateOgButton(i, 'label', e.target.value)}
                                placeholder="Button text"
                                maxLength={80}
                                className="flex-1 sm:w-40 sm:flex-none sm:shrink-0"
                              />
                            </div>
                            <Input
                              value={b.url}
                              onChange={(e) => updateOgButton(i, 'url', e.target.value)}
                              placeholder="https://..."
                              className="mt-2 w-full sm:mt-0 sm:flex-1 sm:min-w-0"
                            />
                            <div className="mt-2 flex items-center justify-end gap-1 sm:mt-0 sm:shrink-0">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                disabled={i === 0}
                                onClick={() => moveOgButton(i, -1)}
                              >
                                <ArrowUp className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                disabled={i === ogDraft.buttons.length - 1}
                                onClick={() => moveOgButton(i, 1)}
                              >
                                <ArrowDown className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-400 hover:text-red-400"
                                disabled={ogDraft.buttons.length <= 1}
                                onClick={() => removeOgButton(i)}
                              >
                                <X className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        disabled={ogDraft.buttons.length >= MAX_OG_BUTTONS}
                        onClick={addOgButton}
                      >
                        <Plus className="w-3.5 h-3.5 mr-1.5" /> Add button
                      </Button>
                      <p className="text-[11px] text-muted-foreground mt-2">
                        These are the actual clickable buttons Discord shows under the card. Up to
                        {' '}{MAX_OG_BUTTONS}, each needs an https:// link.
                      </p>
                    </div>

                    <div className="mb-5">
                      <Label className="mb-1.5 block">Text above buttons (optional)</Label>
                      <RichTextEditor
                        value={ogDraft.buttons_heading}
                        onChange={(v) => setOgDraft((prev) => ({ ...prev, buttons_heading: v }))}
                        placeholder="e.g. **Join 10,000+ servers** already using Wody"
                        maxLength={600}
                        rows={4}
                        hint={false}
                      />
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Shown as its own block right above the buttons, on Discord itself, poti
                        folosi mai multe randuri, liste cu &quot;-&quot;, `cod`, **bold**, *italic*.
                      </p>
                    </div>

                    <div className="mb-5">
                      <Label className="mb-1.5 block text-xs text-muted-foreground">Preview</Label>
                      <DiscordComponentPreview config={ogDraft} imageSrc={`/api/og?variant=${ogDraft.variant || 'passport'}&v=${ogPreviewNonce}`} />
                    </div>

                    <div className="flex flex-wrap items-center gap-3 [&>button]:min-w-[8.5rem] [&>button]:justify-center max-sm:[&>button]:flex-1">
                      <Button onClick={saveOgEmbed} disabled={ogSaving || !ogDirty} className="gradient-primary">
                        {ogSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                        Save changes
                      </Button>
                      {ogDirty && (
                        <span className="text-xs text-muted-foreground">Unsaved changes. Preview above updates after you save.</span>
                      )}
                    </div>
                  </div>
                </Card>
                )}

                {appearanceCategory === 'careers' && (
                <Card className="p-6 bg-card/60 border-[#a04820]/40 relative overflow-hidden">
                  <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-[#a04820]/15 blur-3xl pointer-events-none" />
                  <div className="relative">
                    <div className="flex items-center justify-between gap-3 mb-1">
                      <div className="font-semibold flex items-center gap-2 text-[#e08a4e]">
                        <BookOpen className="w-4 h-4" /> Careers page roles
                      </div>
                      {careersRolesLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                    </div>
                    <p className="text-xs text-muted-foreground max-w-xl mb-5">
                      The pills under &quot;Where we could use help&quot; on /careers. Add, remove
                      or rename whatever you need, without touching the code or the translations.
                    </p>

                    <div className="space-y-2 mb-3">
                      {careersRolesDraft.map((role, i) => (
                        <div
                          key={i}
                          className="rounded-lg border border-border/40 p-3 sm:border-0 sm:p-0 sm:flex sm:items-center sm:gap-2"
                        >
                          <div className="flex items-center gap-2">
                            <GripVertical className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                            <Input
                              value={role}
                              onChange={(e) => updateCareersRole(i, e.target.value)}
                              placeholder="ex: Bot development"
                              maxLength={40}
                              className="flex-1 sm:min-w-0"
                            />
                          </div>
                          <div className="mt-2 flex items-center justify-end gap-1 sm:mt-0 sm:shrink-0">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              disabled={i === 0}
                              onClick={() => moveCareersRole(i, -1)}
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              disabled={i === careersRolesDraft.length - 1}
                              onClick={() => moveCareersRole(i, 1)}
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-400 hover:text-red-400"
                              disabled={careersRolesDraft.length <= 1}
                              onClick={() => removeCareersRole(i)}
                            >
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={careersRolesDraft.length >= 20}
                      onClick={addCareersRole}
                    >
                      <Plus className="w-3.5 h-3.5 mr-1.5" /> Add
                    </Button>

                    <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5 rounded-2xl border border-border/60 bg-background/30 p-4">
                      {careersRolesDraft.filter((r) => r.trim()).map((role, i) => (
                        <span
                          key={`${role}-${i}`}
                          className="rounded-full border border-[#c46a2d]/40 bg-[#7c3010]/15 px-4 py-1.5 text-sm font-medium text-[#f2c091]"
                        >
                          {role}
                        </span>
                      ))}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 mt-5 [&>button]:min-w-[8.5rem] [&>button]:justify-center max-sm:[&>button]:flex-1">
                      <Button onClick={saveCareersRoles} disabled={careersRolesSaving || !careersRolesDirty} className="gradient-primary">
                        {careersRolesSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                        Save
                      </Button>
                      {careersRolesDirty && (
                        <span className="text-xs text-muted-foreground">Unsaved changes.</span>
                      )}
                    </div>
                  </div>
                </Card>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
      </div>

      {/* Live preview of the unsaved draft, rendered on top of this very
          page. It's the same component every visitor gets, so what the
          owner sees here is exactly what goes live on Save, nothing is
          persisted or shown to anyone else until that happens. */}
      {seasonPreview && <SeasonalEffectsLayer config={seasonDraft} />}

      {/* "Message owner" composer: DMs the CURRENT owner of exactly one
          server (dmGuild), resolved server-side right before sending, not
          the whole server or a broadcast list. Only reachable from the
          "Message owner" button on an All Servers row, and every send goes
          through owner-only, guild-scoped checks on the API side too. */}
      <Dialog open={!!dmGuild} onOpenChange={(open) => { if (!open) closeOwnerComposer(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-[#e08a4e]" /> Message the server owner
            </DialogTitle>
          </DialogHeader>

          {dmGuild && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-lg border border-border/50 p-3">
                {dmGuild.icon_url ? (
                  <img src={discordCdnUrl(dmGuild.icon_url)} alt="" className="w-10 h-10 rounded-lg shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center shrink-0"><Server className="w-4 h-4 text-muted-foreground" /></div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{dmGuild.name}</div>
                  <div className="text-xs text-muted-foreground">ID {dmGuild.id}</div>
                </div>
              </div>

              {/* Who this will actually go to, resolved fresh, never
                  assumed from the list row, so this always reflects
                  whoever currently owns the server, not whoever did when
                  the All Servers list last loaded. */}
              <div className="rounded-lg border border-border/50 p-3">
                <div className="text-xs text-muted-foreground mb-2">This will be sent as a DM to:</div>
                {dmInfoLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Looking up the current owner…</div>
                ) : !dmOwner ? (
                  <div className="text-sm text-red-400">Couldn't determine the owner of this server. Sending is disabled.</div>
                ) : (
                  <div>
                    <div className="text-sm font-medium truncate">{dmOwner.username || 'Unknown username'}</div>
                    <div className="text-[11px] text-muted-foreground">ID {dmOwner.id}</div>
                  </div>
                )}
                {dmLastSentAt && (
                  <div className="mt-2 pt-2 border-t border-border/40 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <History className="w-3 h-3" /> Last messaged {new Date(dmLastSentAt).toLocaleString('en-US')}
                  </div>
                )}
              </div>

              <div>
                <Label className="mb-1.5 block">Message</Label>
                <Textarea
                  rows={5}
                  maxLength={2000}
                  value={dmMessage}
                  onChange={(e) => setDmMessage(e.target.value)}
                  placeholder={`Hi! Reaching out about ${dmGuild.name}…`}
                />
                <div className="flex items-center justify-between mt-1">
                  <p className="text-[11px] text-muted-foreground">
                    Supports Discord formatting: **bold**, *italic*, and [link text](https://example.com).
                  </p>
                  <span className="text-[11px] text-muted-foreground shrink-0">{dmMessage.length}/2000</span>
                </div>
              </div>

              {dmMessage.trim() && (
                <div>
                  <Label className="mb-1.5 block text-xs text-muted-foreground">Preview</Label>
                  {/* Sent as a plain DM (content only), so the preview is a
                      normal Discord message from Wody. */}
                  <DiscordMessage>
                    <DiscordText>{dmMessage}</DiscordText>
                  </DiscordMessage>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:justify-end">
                <Button variant="ghost" onClick={closeOwnerComposer} disabled={dmSending}>Cancel</Button>
                <Button
                  onClick={sendOwnerMessage}
                  disabled={dmSending || dmInfoLoading || !dmOwner || !dmMessage.trim()}
                  className="gradient-primary gap-1.5"
                >
                  {dmSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Send
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}
