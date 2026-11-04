
'use client';
import { hasUserImage } from '@/lib/account-moderation';
import PolicyConsent from '@/components/profile/PolicyConsent';
import { SvgScene } from '@/components/scenes';
import { Component, createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState, useRef } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useAdvancedEmbed, AdvancedModeToggle, AdvancedFields, buildAdvancedPayload, previewFields, previewButtons } from '@/components/advanced-embed';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import MarqueeText from '@/components/marquee-text';
import HintLink from '@/components/hint-link';
import { PromoBanner } from '@/components/promo-banner';
import AnimatedNumber from '@/components/animated-number';
import { fireConfetti } from '@/lib/confetti';
import { MODULE_INFO, INVITE_URL, COMMUNITY_INVITE, CONTENT } from '@/lib/content';
import { discordCdnUrl, proxiedImageUrl } from '@/lib/utils';
import {
  ArrowLeft, IdCard, Save, Settings2, MessageSquare, LogOut as LeaveIcon,
  UserPlus, Shield, ShieldAlert, ScrollText, Ticket, Smile,
  MessageCircleReply, Gift, TrendingUp, TrendingDown, Lightbulb, Mic2, Archive,
  Crown, Loader2, Trash2, Plus, RefreshCw, Menu, X, Copy, Key,
  Clock, LayoutTemplate, Star, AlertTriangle, MessagesSquare, Users, LogOut,
  Youtube, ChevronDown, ChevronRight, Eye, Palette, Route, FileText, MessageSquareText, Image as ImageIcon, Power,
  LayoutGrid, ShieldCheck, ExternalLink, Sparkles, HelpCircle, Coins, Cake, Radio, Compass, Briefcase, Info, SlidersHorizontal, Gamepad2, Link2, Hash, Languages, UserCog, Search, Rss,
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Footer } from '@/components/nav';
import { DiscordMessagePreview } from '@/components/module-kit';
import GeneralQuickSettings from '@/components/general-quick-settings';
import { BotOfflineBanner, BotStatusProvider, useBotStatusPoll } from '@/components/bot-offline';
import { LOCALE_LABELS } from '@/i18n/routing';
import { LevelRewardsEditor, RoleXpBonusesEditor, levelRulesIssue } from '@/components/modules/LevelRewardsEditors';
import { FREE_LIMITS, isUnlimited } from '@/lib/limits';
import { hasModulePage } from '@/lib/module-slugs';
import { EMOJI_GROUPS, SKIN_TONES, NICK_EMOJI_MAX, NICK_ROLE_MAX, NICK_POSITIONS, extractEmojis, previewNickname, searchEmojis, toneSwatch, withTone } from '@/lib/nick-emojis';
import {
  InfoHint, safeJson, ChannelSelect, RoleSelect, RoleMultiSelect, ChannelMultiSelect,
  SectionHeader, renderDiscordMarkdown, isUsableImageUrl, resolvePreviewUrl,
  CardPreview, EmbedPreview,
  DiscordMessage, DiscordText, DiscordButtons, V2Container, V2Separator, YoutubeLinkUnfurl,
  UnresolvedLinkNote, PreviewImage, FieldRow,
  SaveBar, Skeleton, Empty, NumField,
  ProgressBar,
  CardFontPicker,
} from '@/components/dashboard-kit';
import { CARD_FONTS, CARD_FONT_IDS, cardFontStyle } from '@/lib/card-fonts';


import dynamic from 'next/dynamic';

const PanelLoading = () => <div className="h-64 animate-pulse rounded-2xl bg-card/40" />;
const BirthdaysPanel = dynamic(() => import('@/components/modules/BirthdaysPanel'), { loading: PanelLoading });
const InvitesPanel = dynamic(() => import('@/components/modules/InvitesPanel'), { loading: PanelLoading });
const LookupsPanel = dynamic(() => import('@/components/modules/LookupsPanel'), { loading: PanelLoading });
const FeedsPanel = dynamic(() => import('@/components/modules/FeedsPanel'), { loading: PanelLoading });
const StreamsPanel = dynamic(() => import('@/components/modules/StreamsPanel'), { loading: PanelLoading });
const EconomyPanel = dynamic(() => import('@/components/modules/EconomyPanel'), { loading: PanelLoading });
const BlackjackPanel = dynamic(() => import('@/components/modules/BlackjackPanel'), { loading: PanelLoading });
const CommunityOwnerPanel = dynamic(() => import('@/components/community/OwnerPanel'), { loading: PanelLoading });
const ServerCollabSettings = dynamic(() => import('@/components/collab/ServerCollabSettings'), { loading: PanelLoading });
const ServerCategoriesPanel = dynamic(() => import('@/components/collab/ServerCategoriesPanel'), { loading: PanelLoading });

const statsCache = new Map();

const HISTORY_RANGE_OPTIONS = [7, 14, 30, 60, 90];

function MemberGrowthChart({ history, days, onDaysChange }) {
  const t = useTranslations('guildSettings.general');
  if (!history || history.length === 0) return null;
  const data = history.map((d) => ({
    ...d,
    label: new Date(`${d.date}T00:00:00Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
  }));
  return (
    <Card className="p-6 bg-card/60">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">{t('memberGrowth', { days })}</p>
        <Select value={String(days)} onValueChange={(v) => onDaysChange(Number(v))}>
          <SelectTrigger className="h-7 w-[92px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {HISTORY_RANGE_OPTIONS.map((n) => (
              <SelectItem key={n} value={String(n)} className="text-xs">{n}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="joinsFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#34d399" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="leavesFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#fb7185" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#fb7185" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.1} vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'currentColor', opacity: 0.5 }} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'currentColor', opacity: 0.5 }} axisLine={false} tickLine={false} width={28} />
            <Tooltip
              contentStyle={{ background: '#18181b', border: '1px solid #2b2d31', borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: '#e5e7eb' }}
            />
            <Area type="monotone" dataKey="joins" name={t('joinedToday') || 'Joins'} stroke="#34d399" fill="url(#joinsFill)" strokeWidth={2} />
            <Area type="monotone" dataKey="leaves" name={t('leftToday') || 'Leaves'} stroke="#fb7185" fill="url(#leavesFill)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}


function ChannelMultiplierList({ value, onChange, channels, disabled, addLabel }) {
  const entries = Object.entries(value || {});
  const usedIds = new Set(entries.map(([id]) => id));
  const available = (channels || []).filter((c) => !usedIds.has(String(c.id)) && [0, 5].includes(c.type));

  const setMult = (channelId, mult) => onChange({ ...(value || {}), [channelId]: mult });
  const remove = (channelId) => {
    const next = { ...(value || {}) };
    delete next[channelId];
    onChange(next);
  };
  const add = (channelId) => {
    if (!channelId) return;
    onChange({ ...(value || {}), [channelId]: 2 });
  };

  return (
    <div className="space-y-2">
      {entries.map(([channelId, mult]) => {
        const c = (channels || []).find((ch) => String(ch.id) === String(channelId));
        return (
          <div key={channelId} className="flex items-center gap-2">
            <div className="flex-1 text-sm rounded-md border border-border px-3 py-2 bg-secondary/20 truncate">{c ? `#${c.name}` : channelId}</div>
            <Select value={String(mult)} onValueChange={(v) => setMult(channelId, Number(v))} disabled={disabled}>
              <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
              <SelectContent>{[1, 2, 3, 4, 5].map((n) => <SelectItem key={n} value={String(n)}>{`x${n}`}</SelectItem>)}</SelectContent>
            </Select>
            <Button type="button" variant="ghost" size="sm" onClick={() => remove(channelId)} disabled={disabled}><Trash2 className="w-4 h-4" /></Button>
          </div>
        );
      })}
      <ChannelSelect value={null} onChange={add} channels={available} types={[0, 5]} includeNone={false} disabled={disabled} placeholder={addLabel} />
    </div>
  );
}

function ChannelPickerList({ value, onChange, channels, disabled, addLabel }) {
  const ids = Array.isArray(value) ? value : [];
  const usedIds = new Set(ids.map(String));
  const available = (channels || []).filter((c) => !usedIds.has(String(c.id)) && [0, 5].includes(c.type));

  const remove = (channelId) => onChange(ids.filter((id) => String(id) !== String(channelId)));
  const add = (channelId) => {
    if (!channelId || usedIds.has(String(channelId))) return;
    onChange([...ids, channelId]);
  };

  return (
    <div className="space-y-2">
      {ids.map((channelId) => {
        const c = (channels || []).find((ch) => String(ch.id) === String(channelId));
        return (
          <div key={channelId} className="flex items-center gap-2">
            <div className="flex-1 text-sm rounded-md border border-border px-3 py-2 bg-secondary/20 truncate">{c ? `#${c.name}` : channelId}</div>
            <Button type="button" variant="ghost" size="sm" onClick={() => remove(channelId)} disabled={disabled}><Trash2 className="w-4 h-4" /></Button>
          </div>
        );
      })}
      <ChannelSelect value={null} onChange={add} channels={available} types={[0, 5]} includeNone={false} disabled={disabled} placeholder={addLabel} />
    </div>
  );
}

const MEMBER_CARD_DIMENSIONS = { narrow: '640×900', medium: '1200×630', large: '1200×480', aurora: '934×282' };
const MEMBER_CARD_SIZES = ['narrow', 'medium', 'large', 'aurora'];
const memberCardSize = (v) => (MEMBER_CARD_SIZES.includes(v) ? v : 'medium');

function MemberCardSizePicker({ value, onChange, t, savedValue, tc }) {
  const options = [
    ['narrow', t('cardSizeNarrow'), t('cardSizeNarrowHint')],
    ['medium', t('cardSizeMedium'), t('cardSizeMediumHint')],
    ['large', t('cardSizeLarge'), t('cardSizeLargeHint')],
    ['aurora', t('cardSizeAurora'), t('cardSizeAuroraHint')],
  ];
  const current = memberCardSize(value);
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1"><Label className="mb-0">{t('cardSizeLabel')}</Label><InfoHint>{t('cardSizeLabelHint')}</InfoHint></div>
      <div role="radiogroup" aria-label={t('cardSizeLabel')} className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {options.map(([key, title, hint]) => (
          <button key={key} type="button" role="radio" aria-checked={current === key} onClick={() => onChange(key)} className={`text-left rounded-xl border p-3 transition flex flex-col h-full ${current === key ? 'border-primary bg-primary/10 ring-1 ring-primary' : 'border-border hover:bg-secondary/40'}`}>
            <div className="flex items-center gap-1.5 flex-wrap">
              <div className="font-semibold text-sm">{title}</div>
              {savedValue != null && savedValue === key && <span className="rounded-full bg-primary/15 border border-primary/30 px-2 py-0.5 text-[10px] font-semibold text-primary whitespace-nowrap">{tc('active')}</span>}
              {savedValue != null && current === key && savedValue !== key && <span className="rounded-full bg-secondary border border-border px-2 py-0.5 text-[10px] font-semibold text-muted-foreground whitespace-nowrap">{tc('unsaved')}</span>}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">{hint}</div>
            <div className="text-[11px] text-muted-foreground/70 mt-auto pt-1.5 font-mono">{MEMBER_CARD_DIMENSIONS[key]}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function AuroraGradientPicker({ value, onChange, hasImage, onClearImage }) {
  const tl = useTranslations('guildSettings.levels');
  const tnav = useTranslations('nav');
  const current = AURORA_GRADIENTS[value] ? value : 'ember';
  const tile = (key) => (
    <button key={key} type="button" role="radio" aria-checked={current === key} onClick={() => onChange(key)}
      className={`group rounded-xl border p-1.5 text-left transition ${current === key ? 'border-primary ring-1 ring-primary bg-primary/10' : 'border-border hover:bg-secondary/40'}`}>
      <span className={`relative block w-full overflow-hidden rounded-lg ${SPECIAL_GRADIENTS.includes(key) ? 'h-16' : 'h-10'}`} style={{ background: auroraBackground(key) }}>{SPECIAL_GRADIENTS.includes(key) ? <AuroraScene kind={key} /> : null}</span>
      <span className="mt-1.5 flex items-center gap-1.5 px-1 text-xs font-medium"><span className="h-2.5 w-2.5 rounded-full" style={{ background: AURORA_GRADIENTS[key][2] }} />{tl(`auroraGradients.${key}`)}</span>
    </button>
  );
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1"><Label className="mb-0">{tl('auroraGradient')}</Label><InfoHint>{tl('auroraGradientHint')}</InfoHint></div>
      <div role="radiogroup" aria-label={tl('auroraGradient')} className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {Object.keys(AURORA_GRADIENTS).filter((k) => !SPECIAL_GRADIENTS.includes(k)).map(tile)}
      </div>
      <div className="mt-4 rounded-2xl border border-fuchsia-400/40 bg-gradient-to-br from-fuchsia-500/10 via-transparent to-amber-300/10 p-3 shadow-[0_0_24px_-10px_rgba(255,94,138,.6)]">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-foreground">{tl('auroraSpecial')}</p>
          <span className="rounded-full bg-gradient-to-r from-fuchsia-500 to-amber-400 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-black">{tnav('tags.new')}</span>
        </div>
        <p className="mb-2 mt-0.5 text-[11px] text-muted-foreground">{tl('auroraSpecialHint')}</p>
        <div role="radiogroup" aria-label={tl('auroraSpecial')} className="grid grid-cols-2 gap-2 sm:grid-cols-4">{SPECIAL_GRADIENTS.map(tile)}</div>
      </div>
      {hasImage ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-400/40 bg-amber-400/5 px-3 py-2">
          <p className="min-w-0 flex-1 text-xs text-muted-foreground">{tl('auroraImageNote')}</p>
          {onClearImage ? <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={onClearImage}>{tl('auroraUseGradient')}</Button> : null}
        </div>
      ) : null}
    </div>
  );
}

function MemberAuroraPreview({ gradient, backgroundUrl, previewBackgroundUrl, overlayColor, overlayOpacity, textColor, ringColor, ring, avatarUrl, badge, title, message, footer, fontId }) {
  const W = 934;
  const u = (v) => `${(v / W) * 100}cqw`;
  const useImage = Boolean(backgroundUrl);
  const accent = useImage ? ringColor : (AURORA_GRADIENTS[gradient] || AURORA_GRADIENTS.ember)[2];
  const pad = 30; const avatar = 282 - pad * 2 - 12; const ax = pad + 6; const ay = (282 - avatar) / 2;
  const px0 = avatarUrl ? ax + avatar + 30 : pad; const inner = 24;
  const plainTitle = String(title || '').replace(/[*_`~|]/g, '');
  const plainMessage = String(message || '').replace(/[*_`~|]/g, '').replace(/\s+/g, ' ').trim();
  const plainFooter = String(footer || '').replace(/[*_`~|]/g, '').replace(/\s+/g, ' ').trim();
  return (
    <div className="relative w-full overflow-hidden select-none" style={{ aspectRatio: '934/282', containerType: 'inline-size', background: useImage ? '#000' : auroraBackground(gradient), ...cardFontStyle(fontId) }}>
      {useImage && <PreviewImage url={previewBackgroundUrl} alt="" className="absolute inset-0 h-full w-full object-cover" draggable="false" />}
      {useImage && <div className="absolute inset-0" style={{ backgroundColor: overlayColor, opacity: overlayOpacity / 100 }} />}
      {!useImage && SPECIAL_GRADIENTS.includes(gradient) && <AuroraScene kind={gradient} />}
      {!useImage && <div className="absolute inset-0 opacity-[0.07] [background-image:radial-gradient(#fff_1px,transparent_1px)]" style={{ backgroundSize: u(13) + ' ' + u(13) }} />}
      {avatarUrl && <img src={avatarUrl} alt="" draggable="false" className="absolute rounded-full object-cover"
        style={{ left: u(ax), top: u(ay), width: u(avatar), height: u(avatar), boxShadow: ring ? `0 0 0 ${u(6)} ${accent}, 0 0 ${u(30)} ${accent}aa` : undefined }} />}
      <div className="absolute flex flex-col" style={{ left: u(px0), right: u(pad), top: u(pad), bottom: u(pad), padding: `${u(inner - 4)} ${u(inner)} ${u(inner)}`, borderRadius: u(22), background: 'rgba(8,6,12,.47)', border: `${u(1.5)} solid rgba(255,255,255,.13)` }}>
        <span className="self-start rounded-full font-bold leading-none uppercase" style={{ background: accent, color: '#120c0a', fontSize: u(17), padding: `${u(6)} ${u(13)}`, letterSpacing: '0.02em' }}>{badge}</span>
        <div className="flex-1 min-h-0 flex flex-col justify-center" style={{ paddingTop: u(10) }}>
          <div className="font-bold leading-[1.15] break-words line-clamp-2" style={{ color: textColor, fontSize: u(plainTitle.length > 34 ? 28 : 38), textShadow: '0 1px 3px rgba(0,0,0,.6)' }}>{plainTitle}</div>
          <span className="block" style={{ width: u(64), height: u(5), borderRadius: u(3), background: accent, marginTop: u(8) }} />
          {plainMessage && <div className="leading-[1.3] line-clamp-2" style={{ color: textColor, opacity: 0.9, fontSize: u(plainMessage.length > 90 ? 17 : 22), marginTop: u(12), textShadow: '0 1px 2px rgba(0,0,0,.5)' }}>{plainMessage}</div>}
        </div>
        {plainFooter && <div className="truncate leading-none" style={{ color: textColor, opacity: 0.75, fontSize: u(15), borderTop: '1px solid rgba(255,255,255,.16)', paddingTop: u(10), marginTop: u(10) }}>{plainFooter}</div>}
      </div>
    </div>
  );
}

function channelName(meta, id) {
  if (!id) return null;
  const c = meta?.channels?.find((c) => c.id === String(id));
  return c ? `#${c.name}` : String(id);
}

function roleName(meta, id) {
  if (!id) return null;
  const r = meta?.roles?.find((r) => r.id === String(id));
  return r ? `@${r.name}` : '@Unknown role';
}

const MODULES = [
  { key: 'general', label: 'General', icon: Settings2 },
  { key: 'welcome', label: 'Welcome', icon: MessageSquare },
  { key: 'goodbye', label: 'Goodbye', icon: LeaveIcon },
  { key: 'autorole', label: 'Auto Role', icon: UserPlus },
  { key: 'moderation', label: 'Moderation', icon: Shield },
  { key: 'automod', label: 'Automod', icon: ShieldAlert },
  { key: 'logging', label: 'Logging', icon: ScrollText },
  { key: 'tickets', label: 'Tickets', icon: Ticket, limited: true },
  { key: 'captcha', label: 'Captcha', icon: ShieldCheck },
  { key: 'reaction_roles', label: 'Reaction Roles', icon: Smile, limited: true },
  { key: 'auto_responses', label: 'Auto Replies', icon: MessageCircleReply, limited: true },
  { key: 'custom_commands', label: 'Commands', icon: MessageCircleReply, limited: true },
  { key: 'giveaways', label: 'Giveaways', icon: Gift, limited: true },
  { key: 'scheduled_messages', label: 'Scheduled', icon: Clock, limited: true },
  { key: 'forums', label: 'Forums', icon: MessagesSquare, limited: true },
  { key: 'embeds', label: 'Embed Builder', icon: LayoutTemplate },
  { key: 'levels', label: 'Levels', icon: TrendingUp },
  { key: 'suggestions', label: 'Suggestions', icon: Lightbulb },
  { key: 'birthdays', label: 'Birthdays', icon: Cake },
  { key: 'invite_tracking', label: 'Invite Tracking', icon: Link2, free: true, optIn: true },
  { key: 'lookups', label: 'Radar', icon: Search },
  { key: 'feeds', label: 'Pulse', icon: Rss },
  { key: 'community', label: 'Community Discovery', icon: Compass },
  { key: 'collab', label: 'Collab', icon: Briefcase },
  { key: 'economy', label: 'Economy', icon: Coins, premium: true },
  { key: 'blackjack', label: 'Games', icon: Gamepad2, premium: true },
  { key: 'backups', label: 'Backups', icon: Archive, premium: true },
  { key: 'temporary_voice', label: 'Temp Voice', icon: Mic2, premium: true },
  { key: 'youtube_notify', label: 'YouTube Notifications', icon: Youtube, premium: true },
  { key: 'stream_notifications', label: 'Stream Notifications', icon: Radio, premium: true },
  { key: 'premium', label: 'Premium', icon: Crown, status: true },
];

const MODULE_GROUPS = [
  { key: 'server', keys: ['general', 'welcome', 'goodbye', 'autorole'] },
  { key: 'moderation', keys: ['moderation', 'automod', 'logging', 'captcha'] },
  { key: 'community', keys: ['community', 'collab', 'embeds', 'levels', 'suggestions', 'birthdays', 'invite_tracking', 'lookups', 'feeds', 'tickets', 'reaction_roles', 'auto_responses', 'custom_commands', 'giveaways', 'scheduled_messages', 'forums'] },
  { key: 'premium', keys: ['premium', 'economy', 'blackjack', 'backups', 'temporary_voice', 'youtube_notify', 'stream_notifications'] },
];

const PREMIUM_MOVING_KEYS = MODULES.filter((m) => (m.limited || m.premium) && !m.status).map((m) => m.key);

const MODULE_ORDER = MODULE_GROUPS.flatMap((g) => g.keys);
function buildGroups(premiumActive, labelOf) {
  const moving = new Set(PREMIUM_MOVING_KEYS);
  return MODULE_GROUPS.map((g) => {
    let keys = g.keys.filter((k) => !(premiumActive && moving.has(k) && g.key !== 'premium'));
    if (g.key === 'premium' && premiumActive) keys = [...new Set([...keys, ...PREMIUM_MOVING_KEYS])];
    const natural = (k) => { const i = MODULE_ORDER.indexOf(k); return i === -1 ? 999 : i; };
    keys = [...keys].sort((a, b) => (b === 'premium') - (a === 'premium') || labelOf(a).length - labelOf(b).length || natural(a) - natural(b));
    return { ...g, keys };
  });
}

const NON_TOGGLEABLE_KEYS = new Set(['general', 'premium', 'embeds', 'community', 'collab']);

const OPT_IN_KEYS = new Set(MODULES.filter((m) => m.optIn).map((m) => m.key));

const PREMIUM_ONLY_KEYS = new Set(MODULES.filter((m) => m.premium).map((m) => m.key));
const PREMIUM_LOCK_PANELS = new Set(['economy', 'blackjack', 'stream_notifications']);

const PREMIUM_ACCENT = '#e6cd8c';
const THEME = {
  accent: PREMIUM_ACCENT,
  dot: 'bg-[#e6cd8c]',
  glow: 'shadow-[0_0_10px_-1px_rgba(230,205,140,0.5)]',
  chip: 'border-[#e6cd8c]/40 bg-[#e6cd8c]/10 text-[#e6cd8c]',
  track: 'data-[state=checked]:bg-[#e6cd8c]',
};
const CATEGORY_THEME = { server: THEME, moderation: THEME, community: THEME, premium: THEME };

function categoryOf(moduleKey) {
  return MODULE_GROUPS.find((g) => g.keys.includes(moduleKey))?.key || 'community';
}

const PREMIUM_LIMIT_BOOST = 1;

function premiumBoostLine(t, standard, isPremium, noun) {
  return isPremium
    ? t('premiumActiveLimit', { standard, noun })
    : t('premiumStandardLimit', { standard, noun });
}

function premiumBoostClause(t, standard, noun) {
  return t('premiumBoostClause', { noun, standard });
}

function PremiumModuleBadge() {
  return (
    <span className="shrink-0 inline-flex h-6 w-6 items-center justify-center rounded-full border border-[#e6cd8c]/50 bg-[#e6cd8c]/15 text-[#e6cd8c] shadow-[0_0_12px_rgba(230,205,140,0.22)]" title="Premium" aria-label="Premium">
      <Crown className="h-3.5 w-3.5" strokeWidth={2.4} />
    </span>
  );
}

function FreeModuleBadge() {
  const t = useTranslations('guildSettings.common');
  return (
    <span className="shrink-0 inline-flex h-5 items-center rounded-full border border-emerald-400/40 bg-emerald-500/10 px-1.5 text-[9px] font-bold uppercase tracking-[0.08em] text-emerald-300">
      {t('freeBadge')}
    </span>
  );
}

function PlanBadge({ plan }) {
  if (plan !== 'premium') return null;
  return <PremiumModuleBadge />;
}
const DashboardNavContext = createContext(null);

function LimitPlanNotice({ isPremium, t }) {
  const openModule = useContext(DashboardNavContext);
  return (
    <div className={`mb-5 flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between ${isPremium
      ? 'border-amber-400/30 bg-amber-400/[0.06]'
      : 'border-emerald-400/25 bg-emerald-500/[0.05]'}`}>
      <div className="flex min-w-0 items-start gap-3">
        <PlanBadge plan={isPremium ? 'premium' : 'free'} t={t} />
        <div className="min-w-0">
          <div className="text-sm font-semibold">{isPremium ? t('premiumPlan') : t('freePlan')}</div>
          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
            {isPremium ? t('premiumLimitsActive') : t('upgradeForHigherLimits')}
          </p>
        </div>
      </div>
      {!isPremium && (
        <Button
          size="sm"
          type="button"
          onClick={() => openModule?.('premium')}
          className="shrink-0 gap-1.5 gradient-primary"
        >
          <Crown className="w-3.5 h-3.5" />{t('upgrade')}
        </Button>
      )}
    </div>
  );
}

export default function GuildDashboardClient() {
  const t = useTranslations('guildSettings');
  const tc = useTranslations('guildSettings.common');
  const tm = useTranslations('modules');
  const { guildId } = useParams();
  const router = useRouter();
  const [meta, setMeta] = useState(null);
  const [metaError, setMetaError] = useState(false);
  const [active, setActive] = useState('overview');
  const activeRef = useRef('overview');
  const openModule = (key) => {
    if (activeRef.current === key) return;
    window.history.pushState(
      { ...(window.history.state || {}), wodyDashboardView: key },
      '',
      window.location.href
    );
    activeRef.current = key;
    setActive(key);
  };
  const [sidebarOpen, setSidebarOpen] = useState(false);
  useEffect(() => {
    if (!sidebarOpen) return;
    if (!window.matchMedia('(max-width: 1023px)').matches) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prevOverflow; };
  }, [sidebarOpen]);
  const [loading, setLoading] = useState(true);
  const [premiumActive, setPremiumActive] = useState(false);
  const [moduleStates, setModuleStates] = useState({});
  const [statesReady, setStatesReady] = useState(false);
  const [toggling, setToggling] = useState(null);
  const [stats, setStats] = useState(null);
  const botStatus = useBotStatusPoll();

  const isModuleOn = (key) => NON_TOGGLEABLE_KEYS.has(key) || (OPT_IN_KEYS.has(key) ? moduleStates[key] === true : moduleStates[key] !== false);

  useEffect(() => {
    let startView = 'overview';
    try {
      const wanted = new URLSearchParams(window.location.search).get('module');
      if (wanted && MODULES.some((m) => m.key === wanted)) startView = wanted;
    } catch { }
    let cleanUrl = window.location.href;
    try { const u = new URL(window.location.href); u.searchParams.delete('module'); cleanUrl = u.toString(); } catch { }
    window.history.replaceState(
      { ...(window.history.state || {}), wodyDashboardView: startView },
      '',
      cleanUrl
    );
    if (startView !== 'overview') { activeRef.current = startView; setActive(startView); }

    const onPopState = (event) => {
      const view = event.state?.wodyDashboardView || 'overview';
      activeRef.current = view;
      setActive(view);
      setSidebarOpen(false);
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    const onOpenModule = (event) => {
      const key = event?.detail;
      if (!key || !MODULES.some((m) => m.key === key)) return;
      openModule(key);
      setSidebarOpen(false);
    };
    window.addEventListener('wody:open-module', onOpenModule);
    return () => window.removeEventListener('wody:open-module', onOpenModule);
  });

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [active]);

  const reloadStates = async () => {
    try {
      const rr = await fetch(`/api/guilds/${guildId}/settings`);
      if (!rr.ok) throw new Error(String(rr.status));
      const sd = await rr.json();
      setModuleStates(sd?.module_states || {});
      setStatesReady(true);
    } catch {
      toast.error(t('common.couldNotLoad'));
    }
  };

  const toggleModule = async (key, nextEnabled) => {
    if (NON_TOGGLEABLE_KEYS.has(key) || toggling) return;
    if (!statesReady) return;
    if (nextEnabled && PREMIUM_ONLY_KEYS.has(key) && !premiumActive) {
      toast.error(t('common.premiumNotActiveTitle'));
      return;
    }
    const prev = moduleStates[key];
    setToggling(key);
    setModuleStates((s) => ({ ...s, [key]: nextEnabled }));
    try {
      const r = await fetch(`/api/guilds/${guildId}/modules/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, enabled: nextEnabled }),
      });
      if (r.status === 403) {
        setModuleStates((s) => ({ ...s, [key]: prev }));
        toast.error(t('common.premiumNotActiveTitle'));
        return;
      }
      if (!r.ok) throw new Error('toggle failed');
      toast.success(
        nextEnabled ? t('common.moduleEnabled', { module: tm(`${key}.title`) }) : t('common.moduleDisabled', { module: tm(`${key}.title`) }),
        botStatus.state === 'offline' ? { description: t('common.botOfflineSavedDesc') } : undefined,
      );
    } catch {
      setModuleStates((s) => ({ ...s, [key]: prev }));
      toast.error(t('common.couldNotSave'));
    } finally {
      setToggling(null);
    }
  };

  const toggleCategory = async (groupKey, nextEnabled) => {
    let targets = (buildGroups(premiumActive, (k) => k).find((g) => g.key === groupKey)?.keys || []).filter((k) => !NON_TOGGLEABLE_KEYS.has(k));
    if (nextEnabled && !premiumActive) {
      const skipped = targets.some((k) => PREMIUM_ONLY_KEYS.has(k));
      targets = targets.filter((k) => !PREMIUM_ONLY_KEYS.has(k));
      if (skipped) toast.error(t('common.premiumNotActiveTitle'));
      if (targets.length === 0) return;
    }
    const before = {};
    targets.forEach((k) => { before[k] = moduleStates[k]; });
    setModuleStates((s) => {
      const next = { ...s };
      targets.forEach((k) => { next[k] = nextEnabled; });
      return next;
    });
    try {
      const results = await Promise.all(targets.map((k) => fetch(`/api/guilds/${guildId}/modules/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: k, enabled: nextEnabled }),
      })));
      const failed = targets.filter((k, i) => !results[i].ok);
      if (failed.length) {
        setModuleStates((s) => { const next = { ...s }; failed.forEach((k) => { if (before[k] === undefined) delete next[k]; else next[k] = before[k]; }); return next; });
        throw new Error('toggle failed');
      }
      toast.success(nextEnabled ? t('common.categoryEnabled', { category: t(`groups.${groupKey}`) }) : t('common.categoryDisabled', { category: t(`groups.${groupKey}`) }));
    } catch (e) {
      if (e?.message !== 'toggle failed') {
        setModuleStates((s) => { const next = { ...s }; targets.forEach((k) => { if (before[k] === undefined) delete next[k]; else next[k] = before[k]; }); return next; });
      }
      toast.error(t('common.couldNotSave'));
    }
  };

  useEffect(() => {
    let cancelled = false;

    const loadMeta = async () => {
      setMetaError(false);
      try {
        let r = null;
        for (let attempt = 0; attempt < 4 && !cancelled; attempt += 1) {
          if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 600 * attempt));
          try { r = await fetch(`/api/guilds/${guildId}/meta`, { cache: 'no-store' }); } catch { r = null; continue; }
          if (r.status === 401 || r.status === 403 || r.ok) break;
        }
        if (cancelled) return;
        if (!r) throw new Error('meta fetch failed: network');
        if (r.status === 401) { router.push('/'); return; }
        if (r.status === 403) { router.push('/dashboard'); return; }
        if (!r.ok) throw new Error(`meta fetch failed: ${r.status}`);
        const d = await r.json();
        if (cancelled) return;
        setMeta(d);
        if (d?.incomplete) {
          (async () => {
            for (let i = 1; i <= 5 && !cancelled; i += 1) {
              await new Promise((resolve) => setTimeout(resolve, 1500 * i));
              if (cancelled) return;
              try {
                const rr = await fetch(`/api/guilds/${guildId}/meta`);
                if (!rr.ok) continue;
                const dd = await rr.json();
                if (cancelled) return;
                setMeta(dd);
                if (!dd?.incomplete) return;
              } catch { }
            }
          })();
        }

        const statsReq = fetch(`/api/guilds/${guildId}/stats`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
        const [pr, sr] = await Promise.allSettled([
          fetch(`/api/guilds/${guildId}/premium`),
          fetch(`/api/guilds/${guildId}/settings`),
        ]);
        if (cancelled) return;

        const readPremium = async (res) => {
          if (!res?.ok) return null;
          try {
            const ps = (await res.json())?.premium;
            return Boolean(ps?.active && !ps?.suspended && (!ps?.expires_at || new Date(ps.expires_at) > new Date()));
          } catch { return null; }
        };
        let premiumNow = await readPremium(pr.status === 'fulfilled' ? pr.value : null);
        for (let attempt = 1; premiumNow === null && attempt <= 3 && !cancelled; attempt += 1) {
          await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
          premiumNow = await readPremium(await fetch(`/api/guilds/${guildId}/premium`).catch(() => null));
        }
        if (cancelled) return;
        if (premiumNow !== null) {
          setPremiumActive(premiumNow);
          try { window.sessionStorage.setItem(`wody:premium:${guildId}`, premiumNow ? '1' : '0'); } catch { }
        } else {
          try { const last = window.sessionStorage.getItem(`wody:premium:${guildId}`); if (last !== null) setPremiumActive(last === '1'); } catch { }
        }
        let statesOk = false;
        if (sr.status === 'fulfilled' && sr.value.ok) {
          try {
            const sd = await sr.value.json();
            setModuleStates(sd?.module_states || {});
            statesOk = true;
          } catch {
          }
        }
        if (statesOk) setStatesReady(true);
        else {
          (async () => {
            for (let i = 1; i <= 6 && !cancelled; i += 1) {
              await new Promise((resolve) => setTimeout(resolve, 1200 * i));
              if (cancelled) return;
              try {
                const rr = await fetch(`/api/guilds/${guildId}/settings`);
                if (!rr.ok) continue;
                const sd = await rr.json();
                if (cancelled) return;
                setModuleStates(sd?.module_states || {});
                setStatesReady(true);
                return;
              } catch { }
            }
          })();
        }
        statsReq.then((d) => {
          if (!d) return;
          statsCache.set(guildId, d);
          if (!cancelled) setStats(d);
        });
        setLoading(false);
      } catch (e) {
        if (cancelled) return;
        toast.error(t('common.couldNotLoad'));
        setMetaError(true);
        setLoading(false);
      }
    };

    loadMeta();

    const onRefreshRequest = () => loadMeta();
    window.addEventListener('wody:refresh', onRefreshRequest);

    return () => { cancelled = true; window.removeEventListener('wody:refresh', onRefreshRequest); };
  }, [guildId, router]);

  const mobileFixStyles = (
    <style jsx global>{`
      html, body {
        max-width: 100%;
        overflow-x: clip;
      }

      @media (max-width: 640px) {
        button, [role="button"] {
          touch-action: manipulation;
        }

        input, textarea, select {
          max-width: 100%;
        }

        textarea {
          min-height: 92px;
        }

        /* Keep long IDs, error messages and Discord names from stretching the page. */
        code, pre, .break-anywhere {
          overflow-wrap: anywhere;
          word-break: break-word;
        }

        /* Comfortable mobile spacing without changing desktop density. */
        .mobile-card {
          padding: 1rem;
        }

        main {
          min-width: 0;
        }

        [data-radix-popper-content-wrapper] {
          max-width: calc(100vw - 16px);
        }
      }
    `}</style>
  );

  if (metaError) {
    return (
      <>
        {mobileFixStyles}
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center">
          <p className="text-muted-foreground text-sm">{t('common.couldNotLoadRetry')}</p>
          <Button onClick={() => window.location.reload()} className="gradient-primary">
            <RefreshCw className="w-4 h-4 mr-2" /> {t('common.retry')}
          </Button>
        </div>
      </>
    );
  }

  if (loading || !meta) {
    return (
      <>
        {mobileFixStyles}
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </>
    );
  }

  const gicon = meta.guild.icon
    ? discordCdnUrl(`https://cdn.discordapp.com/icons/${meta.guild.id}/${meta.guild.icon}.png?size=128`)
    : null;

  const isOverview = active === 'overview';
  const Active = MODULES.find((m) => m.key === active) || MODULES[0];

  return (
    <DashboardNavContext.Provider value={openModule}>
    <>
      {mobileFixStyles}
      <div className="min-h-screen flex flex-col">
      <div className="flex-1 min-h-0 flex min-w-0">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-[35] bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}
      <aside className={`fixed lg:relative top-0 left-0 h-[100dvh] lg:h-auto lg:min-h-screen lg:self-stretch w-72 lg:w-80 flex flex-col bg-sidebar border-r border-sidebar-border z-40 transform transition-transform duration-200 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="shrink-0 px-4 pt-5 pb-4 border-b border-sidebar-border/80 flex items-center gap-3 bg-gradient-to-b from-white/[0.03] to-transparent">
          {gicon ? (
            <img src={gicon} className="w-11 h-11 rounded-xl ring-1 ring-white/10 shadow-md" alt="" />
          ) : (
            <div className="w-11 h-11 rounded-xl bg-secondary flex items-center justify-center font-bold ring-1 ring-white/10 shadow-md">
              {(meta.guild.name || '??').slice(0,2).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="font-semibold truncate leading-tight">{meta.guild.name}</div>
            <button type="button" onClick={() => { setSidebarOpen(false); router.push('/dashboard'); }} className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 mt-0.5">
               <ArrowLeft className="w-3 h-3" /> {t('common.backToServerList')}
             </button>
          </div>
          <button
            type="button"
            aria-label={t('common.closeMenu')}
            className="ml-auto lg:hidden shrink-0 w-10 h-10 flex items-center justify-center rounded-lg border border-sidebar-border bg-sidebar-accent/60 text-sidebar-foreground hover:bg-sidebar-accent active:scale-95 transition-all"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>
        <div className="relative flex-1 min-h-0">
          <nav className="h-full lg:h-auto lg:flex-1 px-3 pt-3 pb-4 overflow-y-auto lg:overflow-visible scrollbar-thin lg:[scrollbar-width:none] lg:[&::-webkit-scrollbar]:hidden">
            <div className="mb-4">
              <button
                type="button"
                onClick={() => { activeRef.current = 'overview'; setActive('overview'); setSidebarOpen(false); }}
                className={`group relative w-full h-10 flex items-center gap-3 pl-3 pr-2.5 rounded-lg border text-[15px] transition-all duration-150 ${active === 'overview' ? 'border-[#e6cd8c]/25 bg-gradient-to-r from-[#e6cd8c]/[0.16] to-[#e6cd8c]/[0.03] text-[#e6cd8c] font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]' : 'border-transparent text-sidebar-foreground/80 hover:bg-white/[0.04] hover:text-foreground'}`}
              >
                {active === 'overview' && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full" style={{ backgroundColor: PREMIUM_ACCENT }} />}
                <LayoutGrid className={`w-[18px] h-[18px] shrink-0 transition-colors ${active === 'overview' ? 'text-[#e6cd8c]' : 'text-sidebar-foreground/50 group-hover:text-foreground'}`} />
                <span className="truncate flex-1 text-left">{t('common.overviewNav')}</span>
              </button>
            </div>
            {buildGroups(premiumActive, (k) => tm(`${k}.title`)).map((group, groupIdx) => {
              const theme = CATEGORY_THEME[group.key] || CATEGORY_THEME.community;
              const toggleableKeys = group.keys.filter((k) => MODULES.some((m) => m.key === k) && !NON_TOGGLEABLE_KEYS.has(k));
              const onCount = toggleableKeys.filter((k) => isModuleOn(k)).length;
              const allOn = toggleableKeys.length > 0 && onCount === toggleableKeys.length;
              return (
              <div key={group.key} className={groupIdx === 0 ? 'mb-4' : 'mb-4 pt-4 border-t border-sidebar-border/60'}>
                <div className="px-3 mb-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${theme.dot}`} />
                    <span className="text-sm font-bold uppercase tracking-[0.12em] text-white truncate">{t(`groups.${group.key}`)}</span>
                  </div>
                  {toggleableKeys.length > 0 && (
                    <button
                      type="button"
                      onClick={() => toggleCategory(group.key, !allOn)}
                      title={allOn ? t('common.disableAllInCategory') : t('common.enableAllInCategory')}
                      className="shrink-0 text-[13px] font-bold tabular-nums text-foreground hover:text-primary transition-colors px-1.5 py-0.5 rounded-md hover:bg-white/[0.05]"
                    >
                      {onCount}/{toggleableKeys.length}
                    </button>
                  )}
                </div>
                <div className="space-y-0.5">
                  {group.keys.map((key) => {
                    const m = MODULES.find((item) => item.key === key);
                    if (!m) return null;
                    const Icon = m.icon;
                    const isActive = active === m.key;
                    const mLabel = tm(`${m.key}.title`);
                    const toggleable = !NON_TOGGLEABLE_KEYS.has(m.key);
                    const showHealthDot = toggleable || !m.status;
                    const on = isModuleOn(m.key);
                    const disabled = toggleable && !on;
                    const premiumTone = m.status ? (premiumActive ? 'green' : 'red') : null;
                    return <button key={m.key} onClick={() => { openModule(m.key); setSidebarOpen(false); }} title={disabled ? t('common.moduleDisabled', { module: mLabel }) : (m.status ? (premiumActive ? t('common.premiumActiveTitle') : t('common.activatePremiumTitle')) : (m.premium ? t('common.availableWithPremium', { module: mLabel }) : mLabel))} className={`group relative w-full h-10 flex items-center gap-3 pl-3 pr-2.5 rounded-lg border text-[15px] transition-all duration-150 ${premiumTone === 'red' ? 'border-red-500/40 bg-gradient-to-r from-red-500/[0.18] via-red-500/[0.07] to-transparent text-red-100 font-medium hover:border-red-400/70 hover:from-red-500/30' : premiumTone === 'green' ? 'border-emerald-500/40 bg-gradient-to-r from-emerald-500/[0.18] via-emerald-500/[0.07] to-transparent text-emerald-100 font-medium hover:border-emerald-400/70 hover:from-emerald-500/30' : disabled ? 'border-transparent text-sidebar-foreground/55 hover:bg-white/[0.04] hover:text-foreground' : isActive ? 'border-[#e6cd8c]/25 bg-gradient-to-r from-[#e6cd8c]/[0.16] to-[#e6cd8c]/[0.03] text-[#e6cd8c] font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]' : 'border-transparent text-sidebar-foreground/80 hover:bg-white/[0.04] hover:text-foreground'}`}>
                      {isActive && !disabled && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full" style={{ backgroundColor: theme.accent }} />}
                      <span className="relative shrink-0 w-[18px] h-[18px] flex items-center justify-center">
                        <Icon className={`w-[18px] h-[18px] transition-colors ${premiumTone === 'red' ? 'text-red-400 drop-shadow-[0_0_6px_rgba(248,113,113,0.5)]' : premiumTone === 'green' ? 'text-emerald-400 drop-shadow-[0_0_6px_rgba(52,211,153,0.5)]' : disabled ? 'text-sidebar-foreground/40' : isActive ? 'text-[#e6cd8c]' : 'text-sidebar-foreground/50 group-hover:text-foreground'}`} />
                        {showHealthDot && (
                          <span className={`absolute -right-0.5 -bottom-0.5 w-[7px] h-[7px] rounded-full ring-2 ring-sidebar transition-all ${on ? `${theme.dot} ${theme.glow}` : 'bg-sidebar-foreground/25'}`} />
                        )}
                      </span>
                      {(m.limited && premiumActive) || (m.premium && !m.status) ? <PremiumModuleBadge /> : null}
                      <span className={`truncate flex-1 text-left ${disabled ? 'font-medium' : ''}`}>{mLabel}</span>
                      {disabled && (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-[#e6cd8c]/45 bg-[#e6cd8c]/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-[#e6cd8c] whitespace-nowrap">
                          <Power className="h-2.5 w-2.5" />
                          {t('common.moduleDisabledShort')}
                        </span>
                      )}
                      {m.status && (
                        <span className={`ml-auto inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold leading-4 shadow-sm whitespace-nowrap ${
                          premiumActive
                            ? 'border-emerald-400/45 bg-emerald-500/10 text-emerald-300'
                            : 'border-red-400/45 bg-red-500/10 text-red-300'
                        }`}>
                          {premiumActive ? t('common.active') : t('common.activate')}
                        </span>
                      )}
                    </button>;
                  })}
                </div>
              </div>
              );
            })}
          </nav>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-sidebar to-transparent" />
        </div>
      </aside>

      <div className="flex-1 min-w-0">
        <header className="sticky top-0 z-30 bg-background/80 backdrop-blur border-b border-border/50 shadow-[0_10px_24px_-16px_rgba(0,0,0,0.6)]">
          <div className="px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <button className="lg:hidden shrink-0" onClick={() => setSidebarOpen(true)}>
                <Menu className="w-5 h-5" />
              </button>
              <div className="min-w-0 flex-1">
                {isOverview ? (
                  <div className="font-semibold flex items-center gap-2 min-w-0">
                    <LayoutGrid className="w-4 h-4 text-[#e08a4e] shrink-0" />
                    <MarqueeText className="min-w-0 flex-1">{t('common.overviewTitle')}</MarqueeText>
                  </div>
                ) : (
                  <>
                    <div className="text-xs text-muted-foreground">{t('common.module')}</div>
                    <div className="font-semibold flex items-center gap-2 min-w-0">
                      <Active.icon className="w-4 h-4 text-[#e08a4e] shrink-0" />
                      <MarqueeText className="min-w-0">
                        <span className="inline-flex items-center gap-2">
                          <span>{tm(`${Active.key}.title`)}</span>
                          {!Active.status && (
                            <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${isModuleOn(Active.key) ? (CATEGORY_THEME[categoryOf(Active.key)] || CATEGORY_THEME.community).chip : 'border-border/60 bg-secondary/30 text-muted-foreground'}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${isModuleOn(Active.key) ? (CATEGORY_THEME[categoryOf(Active.key)] || CATEGORY_THEME.community).dot : 'bg-muted-foreground/50'}`} />
                              {isModuleOn(Active.key) ? t('common.active') : t('common.off')}
                            </span>
                          )}
                        </span>
                      </MarqueeText>
                    </div>
                  </>
                )}
              </div>
            </div>
            <div id="dashboard-guild-actions" className="flex items-center gap-2 shrink-0" />
          </div>
          <div id="dashboard-guild-premium-row" className="px-4 sm:hidden empty:hidden" />
        </header>

        <main id="main-content" className="p-4 sm:p-6 pt-5 sm:pt-7 w-full max-w-none min-w-0">
          <BotStatusProvider value={botStatus}>
          <BotOfflineBanner />
          {isOverview ? (
            <>
              <DashboardPromoBanner />
              <ModuleOverviewGrid
                moduleStates={moduleStates}
                premiumActive={premiumActive}
                toggling={toggling}
                toggleModule={toggleModule}
                isModuleOn={isModuleOn}
                statesReady={statesReady}
                onOpenModule={(key) => openModule(key)}
                guildId={guildId}
              />
            </>
          ) : (
            <ModulePanel moduleKey={active} guildId={guildId} meta={meta} isOn={isModuleOn(active)} onEnable={() => toggleModule(active, true)} premiumActive={premiumActive} onOpenModule={(key) => openModule(key)} moduleSwitch={{ isOn: isModuleOn, ready: statesReady, reload: reloadStates, toggle: toggleModule, toggling, markOn: (key) => setModuleStates((s) => ({ ...s, [key]: true })) }} />
          )}
          </BotStatusProvider>
        </main>
      </div>
      </div>
      <Footer />
      </div>
    </>
    </DashboardNavContext.Provider>
  );
}

const MODULE_ERROR_LABELS = {
  missing_bot_permissions: 'Missing permission',
  channel_missing: 'Channel not found',
  delivery_failed: 'Delivery failed',
  discord_create_failed: 'Could not create in Discord',
  ticket_record_create_failed: 'Could not save ticket record',
  initial_ticket_message_failed: 'Could not send ticket welcome message',
  support_role_warning_failed: 'Could not notify support role',
  ticket_details_message_failed: 'Could not send ticket details',
  claim_update_failed: 'Could not update ticket claim',
  transcript_build_failed: 'Could not build transcript',
  transcript_destination_unavailable: 'Transcript destination unavailable',
  transcript_send_forbidden: 'Missing permission to send transcript',
  transcript_send_failed: 'Could not send transcript',
  transcript_dm_fallback_failed: 'Could not DM transcript',
  transcript_fallback_failed: 'Transcript fallback failed',
  close_update_failed: 'Could not update ticket on close',
  channel_delete_forbidden: 'Missing permission to delete channel',
  channel_delete_failed: 'Could not delete channel',
};
const MODULE_NAME_LABELS = {
  welcome: 'Welcome', goodbye: 'Goodbye', levels: 'Levels', autorole: 'Auto Role',
  logging: 'Logging', tickets: 'Tickets', scheduled_messages: 'Scheduled Messages',
  temporary_voice: 'Temporary Voice', youtube_notify: 'YouTube Notifications',
  custom_commands: 'Custom Commands', auto_responses: 'Auto Responses', giveaways: 'Giveaways',
};

function GeneralErrorLog({ guildId }) {
  const t = useTranslations('guildSettings.common.errorLog');
  const tm = useTranslations('modules');
  const [errors, setErrors] = useState(null);
  const moduleName = (key) => (key && tm.has(`${key}.title`) ? tm(`${key}.title`) : (MODULE_NAME_LABELS[key] || key || 'Wody'));
  const errorName = (code) => (code && t.has(`codes.${code}`) ? t(`codes.${code}`) : (MODULE_ERROR_LABELS[code] || code || t('fallback')));
  useEffect(() => { safeJson(`/api/guilds/${guildId}/errors`, null).then((d) => setErrors(d?.errors || [])); }, [guildId]);
  if (errors === null) return null;
  return (
    <Card className="p-6 bg-card/60 mb-10">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <div className="font-semibold flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-500" />{t('title')}</div>
          <p className="text-xs text-muted-foreground mt-1">{t('intro')}</p>
        </div>
        <Badge variant="secondary">{errors.length}</Badge>
      </div>
      {!errors.length ? (
        <div className="rounded-xl border border-dashed border-border/70 bg-secondary/10 p-5">
          <div className="font-medium text-sm">{t('emptyTitle')}</div>
          <p className="text-xs text-muted-foreground mt-1">{t('emptyText')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {errors.map((e) => (
            <div key={e._id} className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
              <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                <div className="flex items-center gap-2 min-w-0">
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                  <span className="font-medium text-sm break-words">{moduleName(e.module)}: {errorName(e.code)}</span>
                </div>
                <span className="text-[11px] text-muted-foreground shrink-0">{e.created_at ? new Date(e.created_at).toLocaleString() : ''}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2 whitespace-pre-wrap">{e.detail || t('noDetails')}</p>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function DashboardPromoBanner() {
  const [banner, setBanner] = useState(null);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/site/promo-banner')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d) return;
        const ready = d.enabled && d.imageUrl && d.buttonUrl;
        setBanner(ready ? d : null);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);
  return <PromoBanner banner={banner} className="mb-6" />;
}

function StatTile({ icon: Icon, label, value, tone = '', className = '' }) {
  return (
    <div className={`min-w-0 ${className}`}>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {Icon ? <Icon className="w-3.5 h-3.5 shrink-0" /> : null}
        <span className="truncate">{label}</span>
      </div>
      {value === null ? (
        <div className="mt-1.5 h-8 w-16 sm:h-9 rounded-md bg-secondary/30 animate-pulse" />
      ) : (
        <AnimatedNumber
          value={value}
          duration={1600}
          className={`mt-1 block text-2xl sm:text-3xl font-bold leading-tight tabular-nums truncate ${tone}`}
        />
      )}
    </div>
  );
}

function ServerGlanceCard({ guildId, guildName, premiumActive, onOpenModule, stats }) {
  const t = useTranslations('guildSettings.overviewGlance');
  const [extra, setExtra] = useState(undefined);
  useEffect(() => {
    setExtra(undefined);
    if (!premiumActive) return;
    let cancelled = false;
    fetch(`/api/guilds/${guildId}/overview-stats`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled) setExtra(d?.premium ? d : null); })
      .catch(() => { if (!cancelled) setExtra(null); });
    return () => { cancelled = true; };
  }, [guildId, premiumActive]);

  const showExtras = premiumActive && extra !== null;
  const issues = Number(extra?.recent_errors ?? 0);

  const tiles = [
    { key: 'members', label: t('members'), value: stats ? Number(stats.members ?? 0) : null, icon: Users, tone: '', className: 'col-span-2 sm:col-span-1' },
    { key: 'joined', label: t('joinedToday'), value: stats ? Number(stats.joins_today ?? 0) : null, icon: TrendingUp, tone: 'text-emerald-400' },
    { key: 'left', label: t('leftToday'), value: stats ? Number(stats.leaves_today ?? 0) : null, icon: TrendingDown, tone: 'text-rose-400' },
  ];
  if (showExtras) {
    tiles.push(
      { key: 'tickets', label: t('openTickets'), value: extra ? Number(extra.open_tickets ?? 0) : null, icon: Ticket, tone: '' },
      { key: 'issues', label: t('issuesThisWeek'), value: extra ? issues : null, icon: AlertTriangle, tone: issues > 0 ? 'text-amber-400' : '' },
    );
  }

  const mod = extra?.moderation_30d || {};
  const modRows = [
    { key: 'warn', label: t('warns'), value: extra ? Number(mod.warn ?? 0) : null },
    { key: 'mute', label: t('mutes'), value: extra ? Number(mod.mute ?? 0) : null },
    { key: 'kick', label: t('kicks'), value: extra ? Number(mod.kick ?? 0) : null },
    { key: 'ban', label: t('bans'), value: extra ? Number(mod.ban ?? 0) : null },
  ];

  return (
    <Card className="p-4 sm:p-6 bg-card/60">
      <div className="flex items-center gap-2 mb-4 sm:mb-5 min-w-0">
        <Crown className="w-4 h-4 shrink-0 text-[#e08a4e]" />
        <span className="font-semibold text-[15px] shrink-0">{t('title')}</span>
        {guildName ? <span className="ml-auto pl-3 min-w-0 truncate text-xs text-muted-foreground">{guildName}</span> : null}
      </div>

      <div className={`grid gap-x-4 gap-y-5 grid-cols-2 sm:grid-cols-3 ${showExtras ? 'md:grid-cols-5' : ''}`}>
        {tiles.map(({ key, ...tile }) => <StatTile key={key} {...tile} />)}
      </div>

      {showExtras ? (
        <div className="mt-5 pt-4 border-t border-border/50">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
            <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
            <span>{t('moderationTitle')}</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-5">
            {modRows.map(({ key, ...row }) => <StatTile key={key} {...row} />)}
          </div>
        </div>
      ) : null}

      {!premiumActive ? (
        <div className="mt-5 pt-4 border-t border-border/50 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#e6cd8c]/15">
              <Crown className="w-4 h-4 text-[#e08a4e]" />
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-sm">{t('upgradeTitle')}</div>
              <p className="text-xs text-muted-foreground mt-0.5">{t('upgradeSubtitle')}</p>
            </div>
          </div>
          <Button onClick={() => onOpenModule?.('premium')} className="gradient-primary shrink-0 w-full sm:w-auto gap-1.5">
            <Sparkles className="w-4 h-4" /> {t('upgradeButton')}
          </Button>
        </div>
      ) : null}
    </Card>
  );
}

function ModuleOverviewGrid({ moduleStates, premiumActive, toggling, toggleModule, isModuleOn, statesReady = true, onOpenModule, guildId }) {
  const t = useTranslations('guildSettings');
  const tc = useTranslations('guildSettings.common');
  const tm = useTranslations('modules');
  return (
    <div className="max-w-6xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">{tc('overviewTitle')}</h1>
        <p className="mt-1 text-sm text-muted-foreground max-w-2xl leading-relaxed">{tc('overviewSubtitle')}</p>
      </div>
      {buildGroups(premiumActive, (k) => tm(`${k}.title`)).map((group) => (
        <div key={group.key} className="mb-10 pt-1">
          <div className="mb-4 flex items-center gap-2 border-b border-border/70 pb-2.5">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${CATEGORY_THEME[group.key]?.dot || 'bg-primary'}`} />
            <h2 className="text-base sm:text-lg font-bold uppercase tracking-[0.1em] text-white">{t(`groups.${group.key}`)}</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {group.keys.map((key) => {
              const m = MODULES.find((item) => item.key === key);
              if (!m) return null;
              return (
                <ModuleOverviewCard
                  key={m.key}
                  m={m}
                  on={isModuleOn(m.key)}
                  toggling={statesReady ? toggling : m.key}
                  toggleModule={toggleModule}
                  premiumActive={premiumActive}
                  onOpen={onOpenModule}
                  tm={tm}
                  tc={tc}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function ModuleOverviewCard({ m, on, toggling, toggleModule, premiumActive, onOpen, tm, tc }) {
  const Icon = m.icon;
  const locale = useLocale();
  const tLearn = useTranslations('moduleCard');
  const learnHref = `${locale === 'en' ? '' : `/${locale}`}/modules/${m.key}`;
  const toggleable = !NON_TOGGLEABLE_KEYS.has(m.key);
  const label = tm(`${m.key}.title`);
  const desc = tm(`${m.key}.description`);
  const premiumLocked = m.premium && !premiumActive && !on;
  const statusOn = m.status ? premiumActive : (!toggleable || on);

  return (
    <div className={`group relative flex h-full min-h-[220px] flex-col sm:min-h-[240px] rounded-xl border bg-card/40 transition-all duration-200 hover:border-[#e6cd8c]/45 hover:shadow-[0_16px_40px_-30px_rgba(230,205,140,0.6)] border-border/70`}>
      {toggleable && (
        <div className="absolute right-4 top-4 z-10" onClick={(e) => e.stopPropagation()}>
          <Switch checked={on} disabled={toggling === m.key} onCheckedChange={(v) => toggleModule(m.key, v)} className={premiumLocked ? 'opacity-50' : ''} aria-label={on ? tc('disableModule', { module: label }) : tc('enableModule', { module: label })} />
        </div>
      )}
      <button type="button" onClick={() => onOpen(m.key)} className="w-full text-left p-5 pr-16 flex flex-1 items-start gap-3 rounded-t-xl cursor-pointer">
        <div className="module-icon-wrap w-10 h-10 rounded-xl flex items-center justify-center shrink-0"><Icon className="w-[18px] h-[18px]" /></div>
        <div className="min-w-0 flex-1 pt-0.5">
          <div className="flex items-center gap-1.5 flex-wrap"><span className="font-semibold text-[15px] leading-tight">{label}</span>{((m.limited && premiumActive) || (m.premium && !m.status)) && <PremiumModuleBadge />}</div>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{desc}</p>
        </div>
      </button>
      <div className="mx-5 flex h-12 items-center justify-between gap-3 border-t border-border/60">
        <span className={`inline-flex items-center gap-2 text-[11px] font-semibold leading-none ${statusOn ? 'text-emerald-400' : 'text-muted-foreground'}`}><span className={`w-1.5 h-1.5 shrink-0 rounded-full ${statusOn ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]' : 'bg-muted-foreground/50'}`} /><span className="whitespace-nowrap">{m.status ? (premiumActive ? tc('active') : tc('activate')) : (toggleable ? (on ? tc('active') : tc('off')) : tc('active'))}</span></span>
        <span className="flex items-center gap-4">
          {hasModulePage(m.key) && (
            <a href={learnHref} target="_blank" rel="noopener" className="text-[11px] font-medium text-muted-foreground underline-offset-4 hover:text-[#e6cd8c] hover:underline">
              {tLearn('learnMore')}<span className="sr-only">: {label}</span>
            </a>
          )}
          <button type="button" onClick={() => onOpen(m.key)} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-[#e6cd8c]">{tc('configure')} <ChevronRight className="w-3.5 h-3.5" /></button>
        </span>
      </div>
    </div>
  );
}

class ModuleErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error, info) { console.error(`[Dashboard module render error: ${this.props.moduleKey}]`, error, info); }
  componentDidUpdate(prevProps) { if (prevProps.moduleKey !== this.props.moduleKey && this.state.hasError) this.setState({ hasError: false }); }
  render() {
    const title = this.props.errorTitle || 'This module could not be displayed.';
    const desc = this.props.errorDesc || 'The rest of the dashboard is still available.';
    const retry = this.props.retryLabel || 'Try again';
    if (this.state.hasError) return <Card className="p-8 text-center space-y-4 bg-card/60"><AlertTriangle className="w-7 h-7 mx-auto text-amber-400" /><div><h2 className="font-semibold">{title}</h2><p className="text-sm text-muted-foreground mt-1">{desc}</p></div><Button variant="outline" onClick={() => this.setState({ hasError: false })}><RefreshCw className="w-4 h-4 mr-2" />{retry}</Button></Card>;
    return this.props.children;
  }
}

function ModulePanel({ moduleKey, guildId, meta, isOn = true, onEnable, premiumActive = false, onOpenModule, moduleSwitch }) {
  const tc = useTranslations('guildSettings.common');
  const safeMeta = {
    guild: { id: String(guildId || ''), name: '', icon: null, ...(meta?.guild && typeof meta.guild === 'object' ? meta.guild : {}) },
    channels: Array.isArray(meta?.channels) ? meta.channels : [],
    roles: Array.isArray(meta?.roles) ? meta.roles : [],
  };
  const content = (() => {
  const ownsLock = PREMIUM_LOCK_PANELS.has(moduleKey) && !premiumActive;
  if (!isOn && !NON_TOGGLEABLE_KEYS.has(moduleKey) && !ownsLock) return <ModuleDisabledNotice moduleKey={moduleKey} onEnable={onEnable} />;
  switch (moduleKey) {
    case 'general': return <GeneralPanel key={guildId} guildId={guildId} meta={safeMeta} premiumActive={premiumActive} onOpenModule={onOpenModule} moduleSwitch={moduleSwitch} />;
    case 'welcome': return <WelcomePanel guildId={guildId} meta={safeMeta} />;
    case 'goodbye': return <GoodbyePanel guildId={guildId} meta={safeMeta} />;
    case 'autorole': return <AutoRolePanel guildId={guildId} meta={safeMeta} />;
    case 'moderation': return <ModerationPanel guildId={guildId} meta={safeMeta} />;
    case 'automod': return <AutomodPanel guildId={guildId} meta={safeMeta} />;
    case 'logging': return <LoggingPanel guildId={guildId} meta={safeMeta} />;
    case 'tickets': return <TicketsPanel guildId={guildId} meta={safeMeta} />;
    case 'captcha': return <CaptchaPanel guildId={guildId} meta={safeMeta} />;
    case 'reaction_roles': return <ReactionRolesPanel guildId={guildId} meta={safeMeta} />;
    case 'auto_responses': return <AutoResponsesPanel guildId={guildId} meta={safeMeta} />;
    case 'custom_commands': return <CustomCommandsPanel guildId={guildId} meta={safeMeta} />;
    case 'giveaways': return <GiveawaysPanel guildId={guildId} meta={safeMeta} />;
    case 'scheduled_messages': return <ScheduledMessagesPanel guildId={guildId} meta={safeMeta} />;
    case 'embeds': return <EmbedBuilderPanel guildId={guildId} meta={safeMeta} />;
    case 'levels': return <LevelsPanel guildId={guildId} meta={safeMeta} />;
    case 'suggestions': return <SuggestionsPanel guildId={guildId} meta={safeMeta} />;
    case 'backups': return <BackupsPanel guildId={guildId} meta={meta} />;
    case 'youtube_notify': return <YoutubeNotifyPanel guildId={guildId} meta={safeMeta} />;
    case 'temporary_voice': return <TempVoicePanel guildId={guildId} meta={safeMeta} />;
    case 'forums': return <ForumsPanel guildId={guildId} meta={safeMeta} />;
    case 'birthdays': return <BirthdaysPanel guildId={guildId} meta={safeMeta} />;
    case 'invite_tracking': return <InvitesPanel guildId={guildId} meta={safeMeta} onOpenModule={onOpenModule} />;
    case 'lookups': return <LookupsPanel onOpenModule={onOpenModule} />;
    case 'feeds': return <FeedsPanel guildId={guildId} meta={safeMeta} />;
    case 'community': return <CommunityOwnerPanel guildId={guildId} />;
    case 'collab': return <ServerCategoriesPanel guildId={guildId} />;
    case 'economy': return <EconomyPanel guildId={guildId} meta={safeMeta} onGetPremium={() => onOpenModule?.('premium')} />;
    case 'blackjack': return <BlackjackPanel guildId={guildId} onGetPremium={() => onOpenModule?.('premium')} />;
    case 'stream_notifications': return <StreamsPanel guildId={guildId} meta={safeMeta} onGetPremium={() => onOpenModule?.('premium')} />;
    case 'premium': return <PremiumPanel guildId={guildId} meta={safeMeta} />;
    default: return null;
  }
  })();
  return (
    <ModuleErrorBoundary moduleKey={moduleKey} errorTitle={tc('moduleErrorTitle')} errorDesc={tc('moduleErrorDesc')} retryLabel={tc('moduleErrorRetry')}>
      <ModuleGuide moduleKey={moduleKey} />
      {content}
    </ModuleErrorBoundary>
  );
}

const GUIDE_STORAGE_KEY = 'wody:module-guide-open';
function ModuleGuide({ moduleKey }) {
  const t = useTranslations('moduleGuide');
  const [open, setOpen] = useState(false);
  useEffect(() => {
    try { setOpen(window.localStorage.getItem(GUIDE_STORAGE_KEY) === '1'); } catch { }
  }, []);
  if (!t.has(`items.${moduleKey}.what`)) return null;
  const toggle = () => {
    const next = !open;
    setOpen(next);
    try { window.localStorage.setItem(GUIDE_STORAGE_KEY, next ? '1' : '0'); } catch { }
  };
  const customize = t.raw(`items.${moduleKey}.customize`) || [];
  const fresh = t.has(`items.${moduleKey}.new`) ? (t.raw(`items.${moduleKey}.new`) || []) : [];
  return (
    <div className="mb-5 rounded-2xl border border-[#e6cd8c]/25 bg-gradient-to-r from-[#e6cd8c]/[0.08] via-card/60 to-card/40">
      <button type="button" onClick={toggle} aria-expanded={open} className="flex w-full items-center gap-3 px-4 py-3 text-left">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#e6cd8c]/15 text-[#e6cd8c]"><Info className="h-4 w-4" /></span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2 text-sm font-semibold">
            {t('button')}
            {fresh.length > 0 && <span className="inline-flex items-center gap-1 rounded-full border border-[#e6cd8c]/40 bg-[#e6cd8c]/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#e6cd8c]"><Sparkles className="h-3 w-3" />{t('new')}</span>}
          </span>
          <span className="block truncate text-xs text-muted-foreground">{t('subtitle')}</span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="grid gap-4 border-t border-border/60 px-4 pb-4 pt-3 md:grid-cols-2">
          <div className="space-y-3">
            <div>
              <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground"><Info className="h-3.5 w-3.5" />{t('what')}</div>
              <p className="text-sm leading-relaxed">{t(`items.${moduleKey}.what`)}</p>
            </div>
            {fresh.length > 0 && (
              <div>
                <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[#e6cd8c]"><Sparkles className="h-3.5 w-3.5" />{t('new')}</div>
                <ul className="space-y-1.5">
                  {fresh.map((line) => <li key={line} className="flex gap-2 text-sm leading-relaxed"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#e6cd8c]" />{line}</li>)}
                </ul>
              </div>
            )}
          </div>
          <div>
            <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground"><SlidersHorizontal className="h-3.5 w-3.5" />{t('customize')}</div>
            <ul className="space-y-1.5">
              {customize.map((line) => <li key={line} className="flex gap-2 text-sm leading-relaxed"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/60" />{line}</li>)}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function ModuleDisabledNotice({ moduleKey, onEnable }) {
  const t = useTranslations('guildSettings.common');
  const tm = useTranslations('modules');
  return (
    <Card className="p-8 text-center space-y-4 bg-card/60">
      <div className="mx-auto h-12 w-12 rounded-full bg-[#e6cd8c]/15 text-[#e6cd8c] flex items-center justify-center"><Power className="w-6 h-6" /></div>
      <div><h2 className="text-xl font-bold">{t('moduleDisabledTitle', { module: tm(`${moduleKey}.title`) })}</h2><p className="text-sm text-muted-foreground mt-2">{t('moduleDisabledDesc')}</p></div>
      <div><Button onClick={onEnable} className="bg-[#e6cd8c] text-[#1a1208] hover:bg-[#f3e1b0]">{t('enableModuleButton')}</Button></div>
    </Card>
  );
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().filter((k) => value[k] !== undefined).map((k) => `${JSON.stringify(k)}:${stableJson(value[k])}`).join(',')}}`;
  return JSON.stringify(value ?? null);
}

function useModule(guildId, key) {
  const t = useTranslations('guildSettings.common');
  const [data, setDataState] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [baseline, setBaseline] = useState(null);
  const [rights, setRights] = useState(false);
  const setData = setDataState;
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadError(false);
      try {
        const r = await fetch(`/api/guilds/${guildId}/${key}`);
        if (!r.ok) throw new Error(`load failed: ${r.status}`);
        const d = await r.json();
        if (cancelled) return;
        setDataState(d);
        setBaseline(d);
      } catch (e) {
        if (cancelled) return;
        setLoadError(true);
        toast.error(t('loadModuleFailed'), { description: t('tryRefreshing') });
      }
    })();
    return () => { cancelled = true; };
  }, [guildId, key]);

  async function save(patch, path) {
    const needsRights = hasUserImage(patch, window.location.host);
    if (needsRights && !rights) {
      toast.error(t('consent.required'));
      return false;
    }
    setSaving(true);
    try {
      const r = await fetch(`/api/guilds/${guildId}/${path || key}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(needsRights ? { ...patch, rights_confirmed: true } : patch),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body?.error ? `${body.error} (${r.status})` : `save failed (${r.status})`);
      }
      const d = await r.json();
      setDataState((prev) => {
        const next = { ...prev, ...d };
        setBaseline(next);
        return next;
      });
      toast.success(t('saved'), { description: t('savedDesc') });
      return true;
    } catch (e) {
      toast.error(t('saveFailed'), { description: e.message });
      return false;
    } finally {
      setSaving(false);
    }
  }

  const dirty = useMemo(() => data != null && baseline != null && stableJson(data) !== stableJson(baseline), [data, baseline]);
  const discard = useCallback(() => { if (baseline) setDataState(baseline); }, [baseline]);
  return { data, setData, save, saving, loadError, dirty, discard, rights, setRights };
}

function panelDefaultTranscriptId(p) {
  if (!p) return null;
  if (p.transcript_default_channel_id !== undefined) return p.transcript_default_channel_id ? String(p.transcript_default_channel_id) : null;
  const own = p.transcript_channel_id ? String(p.transcript_channel_id) : null;
  const first = p.options?.[0]?.transcript_channel_id ? String(p.options[0].transcript_channel_id) : null;
  return own && own !== first ? own : null;
}

function RoleWeightList({ value, onChange, roles, disabled, addLabel }) {
  const entries = Object.entries(value || {});
  const usedIds = new Set(entries.map(([id]) => id));
  const available = (Array.isArray(roles) ? roles : []).filter((r) => !r.managed && !usedIds.has(String(r.id)));

  const setWeight = (roleId, w) => onChange({ ...(value || {}), [roleId]: w });
  const remove = (roleId) => {
    const next = { ...(value || {}) };
    delete next[roleId];
    onChange(next);
  };
  const add = (roleId) => {
    if (!roleId) return;
    onChange({ ...(value || {}), [roleId]: 3 });
  };

  return (
    <div className="space-y-2">
      {entries.map(([roleId, weight]) => {
        const r = (roles || []).find((role) => String(role.id) === String(roleId));
        return (
          <div key={roleId} className="flex items-center gap-2">
            <div className="flex-1 text-sm rounded-md border border-border px-3 py-2 bg-secondary/20 truncate">{r ? `@${r.name}` : roleId}</div>
            <Select value={String(weight)} onValueChange={(v) => setWeight(roleId, Number(v))} disabled={disabled}>
              <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
              <SelectContent>{Array.from({ length: 10 }, (_, i) => i + 1).map((n) => <SelectItem key={n} value={String(n)}>{`x${n}`}</SelectItem>)}</SelectContent>
            </Select>
            <Button type="button" variant="ghost" size="sm" onClick={() => remove(roleId)} disabled={disabled}><Trash2 className="w-4 h-4" /></Button>
          </div>
        );
      })}
      <RoleSelect value={null} onChange={add} roles={available} includeNone={false} placeholder={addLabel} />
    </div>
  );
}


function GeneralPanel({ guildId, meta, premiumActive = false, onOpenModule, moduleSwitch }) {
  const [stats, setStats] = useState(() => statsCache.get(guildId) || null);
  const [historyDays, setHistoryDays] = useState(14);
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/guilds/${guildId}/stats?days=${historyDays}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d) return;
        if (historyDays === 14) statsCache.set(guildId, d);
        setStats(d);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [guildId, historyDays]);
  const t = useTranslations('guildSettings.general');
  const tx = (key, fallback) => (t.has(key) ? t(key) : fallback);
  const channelsMissing = !meta?.channels?.length;
  return (
    <div className="space-y-6">
      <SectionHeader title={t('title')} description={t('description')} />
      <ServerGlanceCard guildId={guildId} guildName={meta?.guild?.name} premiumActive={premiumActive} onOpenModule={onOpenModule} stats={stats} />
      <MemberGrowthChart history={stats?.history} days={historyDays} onDaysChange={setHistoryDays} />
      {channelsMissing ? (
        <Card className="p-4 border-amber-500/40 bg-amber-500/5 flex flex-col sm:flex-row sm:items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
          <p className="text-sm flex-1">{tx('channelsNotLoaded', 'The channel list could not be loaded from Discord right now. Your saved channels are safe. It is retried automatically, or you can retry now.')}</p>
          <Button size="sm" variant="outline" onClick={() => window.dispatchEvent(new Event('wody:refresh'))}><RefreshCw className="w-4 h-4 mr-2" />{tx('channelsRetry', 'Retry')}</Button>
        </Card>
      ) : null}
      <GeneralQuickSettings guildId={guildId} meta={meta} premiumActive={premiumActive} moduleSwitch={moduleSwitch} />
      <ServerCollabSettings guildId={guildId} />
      <GeneralErrorLog guildId={guildId} />
    </div>
  );
}

function ImageHostingTip() {
  const t = useTranslations('guildSettings.common');
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <HelpCircle className="w-3.5 h-3.5 shrink-0" />
        <span>{t('imageHostingTipTitle')}</span>
        <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="mt-2 rounded-lg border border-border/60 bg-background/40 p-3 text-xs text-muted-foreground space-y-2">
          <p className="text-foreground/90">{t('imageHostingTipIntro')}</p>
          <ol className="space-y-1.5 list-decimal list-inside">
            <li>{t('imageHostingStep1')}</li>
            <li>{t('imageHostingStep2')}</li>
            <li>{t('imageHostingStep3')}</li>
            <li>{t('imageHostingStep4')}</li>
          </ol>
          <p className="pt-1 border-t border-border/40">{t('imageHostingAvoid')}</p>
          <p>{t('imageHostingFormat')}</p>
        </div>
      )}
    </div>
  );
}

function PresetPicker({ category, onSelect, label }) {
  const tc = useTranslations('guildSettings.common');
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    if (!open || items !== null) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/presets/manifest.json', { cache: 'no-store' });
        if (!r.ok) throw new Error(String(r.status));
        const d = await r.json();
        if (!cancelled) setItems(Array.isArray(d?.[category]) ? d[category] : []);
      } catch {
        if (!cancelled) setLoadFailed(true);
      }
    })();
    return () => { cancelled = true; };
  }, [open, items, category]);

  const savedPath = (item) => item.bot_url || item.url;

  const pick = (item) => {
    const canonicalOrigin = (process.env.NEXT_PUBLIC_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : 'https://wody.online')).replace(/\/$/, '');
    onSelect(`${canonicalOrigin}${savedPath(item)}`);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="gap-1.5 w-full sm:w-auto justify-center shrink-0">
          <ImageIcon className="w-3.5 h-3.5" />
          {label || tc('galleryPickerLabel')}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{tc('galleryPickerTitle')}</DialogTitle>
        </DialogHeader>
        {loadFailed ? (
          <p className="text-sm text-muted-foreground py-6 text-center">{tc('galleryLoadFailed')}</p>
        ) : items === null ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 py-2">
            {[0, 1, 2].map((i) => <div key={i} className="aspect-[1.9/1] rounded-lg bg-secondary/40 animate-pulse" />)}
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">{tc('galleryEmpty')}</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 py-2 max-h-[60vh] overflow-y-auto">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => pick(item)}
                className="group relative aspect-[1.9/1] rounded-lg overflow-hidden border border-border hover:border-primary transition"
              >
                <img src={savedPath(item)} alt="" loading="lazy" decoding="async" width={300} height={158} className="w-full h-full object-cover" onError={(e) => { if (e.currentTarget.src.endsWith(savedPath(item))) e.currentTarget.src = item.url; }} />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition" />
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function MessageFormatSwitches({ mode, savedMode, onChange, options }) {
  const tc = useTranslations('guildSettings.common');
  return (
    <div className="space-y-3">
      {options.map(({ value, label, desc }) => {
        const selected = mode === value;
        const isSaved = savedMode === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(value)}
            className={`w-full text-left flex items-center justify-between gap-4 rounded-xl border p-4 transition ${selected ? 'border-primary bg-primary/10 ring-1 ring-primary' : 'border-border hover:bg-secondary/40'}`}
          >
            <div className="min-w-0">
              <div className="flex items-center flex-wrap gap-x-2.5 gap-y-1 mb-0.5">
                <span className="font-medium text-sm break-words">{label}</span>
                <span className="shrink-0 flex items-center gap-1.5">
                  {isSaved && (
                    <span className="rounded-full bg-primary/15 border border-primary/30 px-2 py-0.5 text-[10px] font-semibold text-primary whitespace-nowrap">
                      {tc('active')}
                    </span>
                  )}
                  {selected && !isSaved && (
                    <span className="rounded-full bg-secondary border border-border px-2 py-0.5 text-[10px] font-semibold text-muted-foreground whitespace-nowrap">
                      {tc('unsaved')}
                    </span>
                  )}
                </span>
              </div>
              <div className="text-xs text-muted-foreground leading-relaxed">{desc}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function WelcomePanel({ guildId, meta }) {
  const t = useTranslations('guildSettings.welcome');
  const tc = useTranslations('guildSettings.common');
  const { data, setData, save, saving, dirty, discard, rights, setRights } = useModule(guildId, 'welcome');
  const [savedFormat, setSavedFormat] = useState(null);
  const [savedCardSize, setSavedCardSize] = useState(null);
  useEffect(() => {
    if (data && savedFormat === null) {
      const initial = ['plain', 'avatar', 'card'].includes(data.message_format)
        ? data.message_format
        : (data.embed === false ? 'plain' : (data.card_enabled ? 'card' : 'avatar'));
      setSavedFormat(initial);
    }
    if (data && savedCardSize === null) {
      setSavedCardSize(memberCardSize(data.card_size));
    }
  }, [data, savedFormat, savedCardSize]);
  if (!data) return <Skeleton />;

  const imageMode = data.image_mode || (data.image_url ? 'custom' : 'member_avatar');
  const cardEnabled = !!data.card_enabled;
  const storedMessageFormat = ['plain', 'avatar', 'card'].includes(data.message_format)
    ? data.message_format
    : (!data.embed ? 'plain' : (cardEnabled ? 'card' : 'avatar'));
  const backgroundUrl = data.card_background_url || '';
  const previewBackgroundUrl = resolvePreviewUrl(backgroundUrl);
  const textColor = data.card_text_color || '#ffffff';
  const overlayColor = data.card_overlay_color || '#0f172a';
  const overlayOpacity = Number.isFinite(Number(data.card_overlay_opacity)) ? Math.min(100, Math.max(0, Number(data.card_overlay_opacity))) : 58;

  const previewImage = imageMode === 'server_avatar'
    ? (meta.guild.icon ? discordCdnUrl(`https://cdn.discordapp.com/icons/${meta.guild.id}/${meta.guild.icon}.png?size=256`) : null)
    : imageMode === 'member_avatar'
      ? discordCdnUrl('https://cdn.discordapp.com/embed/avatars/0.png')
      : imageMode === 'custom' && data.image_url ? resolvePreviewUrl(data.image_url) : null;

  const dmImageMode = data.dm_image_mode || (data.dm_image_url ? 'custom' : 'none');
  const dmPreviewImage = dmImageMode === 'server_avatar'
    ? (meta.guild.icon ? discordCdnUrl(`https://cdn.discordapp.com/icons/${meta.guild.id}/${meta.guild.icon}.png?size=256`) : null)
    : dmImageMode === 'member_avatar'
      ? discordCdnUrl('https://cdn.discordapp.com/embed/avatars/0.png')
      : dmImageMode === 'custom' && data.dm_image_url ? resolvePreviewUrl(data.dm_image_url) : null;

  const replacePreview = (text) => String(text || '')
    .replaceAll('{user}', '@Member')
    .replaceAll('{user.mention}', '@Member')
    .replaceAll('{user.name}', 'Member')
    .replaceAll('{user.id}', '123456789')
    .replaceAll('{user.tag}', 'Member#0000')
    .replaceAll('{guild.name}', meta.guild.name || 'Your Server')
    .replaceAll('{guild.id}', meta.guild.id || '123456789')
    .replaceAll('{inviter.mention}', '@Inviter')
    .replaceAll('{inviter.name}', 'Inviter')
    .replaceAll('{inviter.id}', '987654321')
    .replaceAll('{inviter.invites}', '12')
    .replaceAll('{inviter}', '@Inviter')
    .replaceAll('{invite.code}', 'abc123')
    .replaceAll('{member_count}', '1,285');

  const saveWelcome = async () => {
    if (messageFormat === 'avatar' && imageMode === 'custom' && !String(data.image_url || '').trim()) {
      toast.error(tc('invalidImageUrl'), { description: tc('invalidImageUrlHint') });
      return;
    }
    for (const [value, message] of [[data.image_url, tc('invalidImageUrl')], [data.dm_image_url, t('invalidDmImageUrl')], [backgroundUrl, t('invalidBackgroundUrl')]]) {
      if (!isUsableImageUrl(value)) {
        toast.error(message, { description: tc('invalidImageUrlHint') });
        return;
      }
    }
    for (const color of [data.color || '#57F287', textColor, overlayColor]) {
      if (!/^#[0-9a-fA-F]{6}$/.test(String(color).trim())) {
        toast.error(tc('invalidColor'), { description: tc('invalidColorHint') });
        return;
      }
    }
    const ok = await save({
      channel_id: data.channel_id,
      embed: !!data.embed,
      title: data.title || 'Welcome, {user.name}!',
      message: data.message || 'Welcome {user.mention} to **{guild.name}**!',
      footer: data.footer || '',
      color: data.color || '#57F287',
      image_mode: imageMode,
      image_url: data.image_url || null,
      timestamp: data.timestamp !== false,
      dm_message: data.dm_message || null,
      auto_role_id: data.auto_role_id || null,
      dm_image_mode: dmImageMode,
      dm_image_url: data.dm_image_url || null,
      card_enabled: storedMessageFormat === 'card',
      message_format: storedMessageFormat,
      card_background_url: backgroundUrl || null,
      card_overlay_color: overlayColor,
      card_overlay_opacity: overlayOpacity,
      card_text_color: textColor,
      card_avatar_mode: ['member', 'server', 'none'].includes(data.card_avatar_mode) ? data.card_avatar_mode : 'member',
      card_avatar_ring: data.card_avatar_ring !== false,
      card_size: memberCardSize(data.card_size),
      card_gradient: AURORA_GRADIENTS[data.card_gradient] ? data.card_gradient : 'ember',
      card_font: CARD_FONT_IDS.includes(data.card_font) ? data.card_font : 'default',
    });
    if (ok) { setSavedFormat(storedMessageFormat); setSavedCardSize(memberCardSize(data.card_size)); }
  };

  const messageFormat = storedMessageFormat;
  const setMessageFormat = (mode) => {
    if (!['plain', 'avatar', 'card'].includes(mode)) return;
    setData({
      ...data,
      message_format: mode,
      embed: mode !== 'plain',
      card_enabled: mode === 'card',
    });
  };

  const avatarPreview = data.card_avatar_mode === 'none' ? null :
    data.card_avatar_mode === 'server'
      ? (meta.guild.icon ? discordCdnUrl(`https://cdn.discordapp.com/icons/${meta.guild.id}/${meta.guild.icon}.png?size=256`) : discordCdnUrl('https://cdn.discordapp.com/embed/avatars/0.png'))
      : discordCdnUrl('https://cdn.discordapp.com/embed/avatars/0.png');

  return (
    <div className="space-y-6">
      <SectionHeader title={t('title')} description={`${t('description')} ${tc('placeholdersPrefix')} {user.mention}, {user.name}, {user}, {guild.name}, {member_count}.`} />
      {data && hasUserImage(data, window.location.host) ? <PolicyConsent ns="guildSettings.common" checked={rights} onChange={setRights} /> : null}

      <div className="grid xl:grid-cols-[1.05fr_.95fr] gap-6 items-start">
        <div className="space-y-6">
          <Card className="p-4 sm:p-6 space-y-5 bg-card/60">
            <div className="flex items-center justify-between gap-4">
              <div><div className="font-semibold">{t('messageCardTitle')}</div><div className="text-xs text-muted-foreground mt-1">{t('messageCardDesc')}</div></div>
            </div>
            <FieldRow label={tc('channel')}><ChannelSelect value={data.channel_id} onChange={(v) => setData({ ...data, channel_id: v })} channels={meta.channels} /></FieldRow>
          </Card>

          <Card className="p-6 space-y-4 bg-card/60">
            <div><div className="font-semibold">{t('formatCardTitle')}</div><div className="text-xs text-muted-foreground mt-1">{t('formatCardDesc')}</div></div>
            <MessageFormatSwitches
              mode={messageFormat}
              savedMode={savedFormat}
              onChange={setMessageFormat}
              options={[
                { value: 'plain', label: t('formatPlainLabel'), desc: t('formatPlainDesc') },
                { value: 'avatar', label: t('formatAvatarLabel'), desc: t('formatAvatarDesc') },
                { value: 'card', label: t('formatCustomCardLabel'), desc: t('formatCustomCardDesc') },
              ]}
            />
          </Card>

          <Card className="p-4 sm:p-6 space-y-5 bg-card/60">
            <div><div className="font-semibold">{t('contentCardTitle')}</div><div className="text-xs text-muted-foreground mt-1">{t('contentCardDesc')}</div></div>
            <div>
              <div className="flex items-center gap-1.5 mb-1"><Label className="mb-0">{tc('titleLabel')}</Label><InfoHint>{messageFormat === 'plain' ? t('titleUnusedHint') : messageFormat === 'card' ? t('titleOnCardHint') : t('titleOnEmbedHint')}</InfoHint></div>
              <Input disabled={messageFormat === 'plain'} value={data.title ?? 'Welcome, {user.name}!'} onChange={(e) => setData({ ...data, title: e.target.value })} placeholder={t.raw('titlePlaceholder')} maxLength={256} />
            </div>
            <div><Label>{t('messageLabel')}</Label><Textarea rows={5} value={data.message || ''} onChange={(e) => setData({ ...data, message: e.target.value })} placeholder={t.raw('messagePlaceholder')} maxLength={4096} /></div>
            <div>
              <div className="flex items-center gap-1.5 mb-1"><Label className="mb-0">{tc('footerLabel')}</Label><InfoHint>{messageFormat === 'plain' ? t('footerUnusedHint') : messageFormat === 'card' ? t('footerOnCardHint') : t('footerOnEmbedHint')}</InfoHint></div>
              <Input disabled={messageFormat === 'plain'} value={data.footer ?? ''} onChange={(e) => setData({ ...data, footer: e.target.value })} placeholder={t.raw('footerPlaceholder')} maxLength={2048} />
            </div>
            <div><Label>{tc('variablesLabel')}</Label><div className="flex flex-wrap gap-2 mt-2">
              {['{user.name}', '{user.mention}', '{user}', '{guild.name}', '{member_count}', '{inviter}', '{inviter.mention}', '{inviter.name}', '{inviter.id}', '{inviter.invites}', '{invite.code}'].map((v) => (
                <button key={v} type="button" onClick={() => setData({ ...data, message: `${data.message || ''}${data.message ? ' ' : ''}${v}` })} className="rounded-full border border-border bg-secondary/50 px-2.5 py-1 text-xs hover:bg-secondary transition">{v}</button>
              ))}
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{tc('inviterVarsHint')}</p></div>
          </Card>

          {messageFormat !== 'plain' && (
            <Card className="p-4 sm:p-6 space-y-5 bg-card/60">
              <div><div className="font-semibold">{t('imageCardTitle')}</div><div className="text-xs text-muted-foreground mt-1">{messageFormat === 'card' ? t('imageCardDescCard') : t('imageCardDescAvatar')}</div></div>

              {messageFormat === 'avatar' && <>
                <div><Label>{tc('imageLabel')}</Label><Select value={imageMode} onValueChange={(v) => setData({ ...data, image_mode: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="member_avatar">{tc('memberAvatar')}</SelectItem><SelectItem value="server_avatar">{tc('serverAvatar')}</SelectItem><SelectItem value="custom">{tc('customImage')}</SelectItem><SelectItem value="none">{tc('noImage')}</SelectItem></SelectContent></Select></div>
                {imageMode === 'custom' && <div><div className="flex items-center gap-1.5 mb-1"><Label className="mb-0">{tc('imageUrlLabel')}</Label><InfoHint>{tc('imageUrlHint')}</InfoHint></div><div className="flex flex-col sm:flex-row gap-2"><Input className="sm:flex-1" value={data.image_url || ''} onChange={(e) => setData({ ...data, image_mode: e.target.value ? 'custom' : 'none', image_url: e.target.value || null })} placeholder="https://example.com/welcome.gif" /><PresetPicker category="welcome" onSelect={(url) => setData({ ...data, image_mode: 'custom', image_url: url })} /></div></div>}
              </>}

              {messageFormat === 'card' && <>
                <div><div className="flex items-center gap-1.5 mb-1"><Label className="mb-0">{t('backgroundImageLabel')}</Label><InfoHint>{t('backgroundImageHint')}</InfoHint></div><div className="flex flex-col sm:flex-row gap-2"><Input className="sm:flex-1" value={backgroundUrl} onChange={(e) => setData({ ...data, card_background_url: e.target.value || null })} placeholder="https://example.com/welcome-background.jpg" /><PresetPicker category="welcome-background" onSelect={(url) => setData({ ...data, card_background_url: url })} /></div><ImageHostingTip /></div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div><Label>{t('avatarLabel')}</Label><Select value={data.card_avatar_mode || 'member'} onValueChange={(v) => setData({ ...data, card_avatar_mode: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="member">{t('avatarMemberOption')}</SelectItem><SelectItem value="server">{t('avatarServerOption')}</SelectItem><SelectItem value="none">{t('avatarNoneOption')}</SelectItem></SelectContent></Select></div>
                  <div className="flex items-end"><FieldRow label={t('avatarRingLabel')}><Switch checked={data.card_avatar_ring !== false} onCheckedChange={(v) => setData({ ...data, card_avatar_ring: v })} /></FieldRow></div>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div><Label>{t('textColorLabel')}</Label><div className="flex gap-2"><Input type="color" className="w-14 p-1 h-10" value={textColor} onChange={(e) => setData({ ...data, card_text_color: e.target.value })} /><Input value={textColor} onChange={(e) => setData({ ...data, card_text_color: e.target.value })} /></div></div>
                  <div><Label>{t('overlayColorLabel')}</Label><div className="flex gap-2"><Input type="color" className="w-14 p-1 h-10" value={overlayColor} onChange={(e) => setData({ ...data, card_overlay_color: e.target.value })} /><Input value={overlayColor} onChange={(e) => setData({ ...data, card_overlay_color: e.target.value })} /></div></div>
                </div>
                <div><div className="flex justify-between mb-2"><Label>{t('overlayOpacityLabel')}</Label><span className="text-xs text-muted-foreground">{overlayOpacity}%</span></div><input className="w-full accent-primary" type="range" min="0" max="100" value={overlayOpacity} onChange={(e) => setData({ ...data, card_overlay_opacity: Number(e.target.value) })} /></div>
                <MemberCardSizePicker value={data.card_size} onChange={(v) => setData({ ...data, card_size: v })} t={t} savedValue={savedCardSize} tc={tc} />
                <CardFontPicker value={data.card_font} onChange={(v) => setData({ ...data, card_font: v })} />
                {data.card_size === 'aurora' && <AuroraGradientPicker value={data.card_gradient} onChange={(v) => setData({ ...data, card_gradient: v })} hasImage={Boolean(backgroundUrl)} onClearImage={() => setData({ ...data, card_background_url: null })} />}
              </>}
            </Card>
          )}

          {messageFormat !== 'plain' && (
            <Card className="p-4 sm:p-6 space-y-5 bg-card/60">
              <div><div className="font-semibold">{tc('appearanceCardTitle')}</div><div className="text-xs text-muted-foreground mt-1">{t('appearanceCardDesc')}</div></div>
              <div>
                <div className="flex items-center gap-1.5 mb-1"><Label className="mb-0">{tc('accentColor')}</Label><InfoHint>{messageFormat === 'card' ? t('accentColorWithCardHint') : t('accentColorOnEmbedHint')}</InfoHint></div>
                <div className="flex gap-2"><Input type="color" className="w-14 p-1 h-10" value={data.color || '#57F287'} onChange={(e) => setData({ ...data, color: e.target.value })} /><Input value={data.color || '#57F287'} onChange={(e) => setData({ ...data, color: e.target.value })} placeholder="#57F287" /></div>
              </div>
              <FieldRow label={tc('timestampLabel')} hint={messageFormat === 'card' ? t('timestampWithCardHint') : t('timestampOnEmbedHint')}><Switch checked={data.timestamp !== false} onCheckedChange={(v) => setData({ ...data, timestamp: v })} /></FieldRow>
            </Card>
          )}

          <Card className="p-4 sm:p-6 space-y-5 bg-card/60">
            <div className="font-semibold">{t('memberExperienceCardTitle')}</div>
            <div><Label>{t('dmMessageLabel')}</Label><Textarea rows={3} value={data.dm_message || ''} onChange={(e) => setData({ ...data, dm_message: e.target.value || null })} placeholder={t('dmMessagePlaceholder')} /></div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div><div className="flex items-center gap-1.5 mb-1"><Label className="mb-0">{t('dmImageLabel')}</Label><InfoHint>{t('dmImageHint')}</InfoHint></div><Select value={dmImageMode} onValueChange={(v) => setData({ ...data, dm_image_mode: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">{tc('noImage')}</SelectItem><SelectItem value="member_avatar">{tc('memberAvatar')}</SelectItem><SelectItem value="server_avatar">{tc('serverAvatar')}</SelectItem><SelectItem value="custom">{tc('customImage')}</SelectItem></SelectContent></Select></div>
              {dmImageMode === 'custom' && <div><div className="flex items-center gap-1.5 mb-1"><Label className="mb-0">{t('dmImageUrlLabel')}</Label><InfoHint>{t('dmImageUrlHint')}</InfoHint></div><Input value={data.dm_image_url || ''} onChange={(e) => setData({ ...data, dm_image_url: e.target.value || null })} placeholder="https://example.com/welcome-dm.gif" /></div>}
            </div>
            <FieldRow label={t('autoRoleOnJoin')} hint={t('autoRoleOnJoinHint')}><RoleSelect value={data.auto_role_id} onChange={(v) => setData({ ...data, auto_role_id: v })} roles={meta.roles} /></FieldRow>
          </Card>
          <SaveBar saving={saving} dirty={dirty} onDiscard={discard} onSave={saveWelcome} />
        </div>

        <div className="space-y-6 xl:sticky xl:top-6">
          <Card className="p-5 bg-card/60">
            <div className="flex items-center justify-between mb-4"><div><div className="font-semibold">{tc('livePreview')}</div><div className="text-xs text-muted-foreground">{messageFormat === 'card' ? t('cardPreviewHint') : tc('updatesInstantly')}</div></div><Badge variant="outline">{t('welcomeBadge')}</Badge></div>
            <DiscordMessage>
              {messageFormat === 'plain' ? (
                <DiscordText>{replacePreview(data.message || 'Welcome {user.mention} to **{guild.name}**!')}</DiscordText>
              ) : (
                <>
                  <DiscordText>@Member</DiscordText>
                  {messageFormat === 'card' ? (
                    <EmbedPreview accentColor={data.color || '#57F287'} authorName={meta.guild.name || 'Your Server'} timestamp={data.timestamp !== false}>
                      <div className="overflow-hidden rounded-[8px]">
                        {data.card_size === 'aurora' ? (
                          <MemberAuroraPreview fontId={data.card_font} gradient={data.card_gradient} backgroundUrl={backgroundUrl} previewBackgroundUrl={previewBackgroundUrl} overlayColor={overlayColor} overlayOpacity={overlayOpacity} textColor={textColor} ringColor={data.color || '#57F287'} ring={data.card_avatar_ring !== false} avatarUrl={avatarPreview} badge="Welcome"
                            title={replacePreview(data.title || 'Welcome, {user.name}!')} message={replacePreview(data.message || 'Welcome {user.mention} to {guild.name}!')} footer={replacePreview(data.footer || '')} />
                        ) : (
                          <CardPreview
                            fontId={data.card_font}
                            backgroundUrl={previewBackgroundUrl}
                            overlayColor={overlayColor}
                            overlayOpacity={overlayOpacity}
                            textColor={textColor}
                            avatarUrl={avatarPreview}
                            avatarRing={data.card_avatar_ring !== false}
                            ringColor={data.color || '#57F287'}
                            title={replacePreview(data.title || 'Welcome, {user.name}!')}
                            message={replacePreview(data.message || 'Welcome {user.mention} to {guild.name}!')}
                            footer={replacePreview(data.footer || '')}
                          />
                        )}
                      </div>
                    </EmbedPreview>
                  ) : (
                    <EmbedPreview
                      accentColor={data.color || '#57F287'}
                      authorName={meta.guild.name || 'Your Server'}
                      title={replacePreview(data.title || 'Welcome!')}
                      description={replacePreview(data.message || '')}
                      footer={replacePreview(data.footer || '')}
                      timestamp={data.timestamp !== false}
                      imageUrl={previewImage}
                      imageAsThumbnail={imageMode !== 'custom'}
                    />
                  )}
                </>
              )}
            </DiscordMessage>
            {messageFormat === 'card' ? <UnresolvedLinkNote url={backgroundUrl} /> : null}
            {messageFormat === 'avatar' && imageMode === 'custom' ? <UnresolvedLinkNote url={data.image_url} /> : null}
          </Card>

          <Card className="p-5 bg-card/60">
            <div className="flex items-center justify-between mb-4"><div><div className="font-semibold">{tc('livePreview')}</div><div className="text-xs text-muted-foreground">{t('dmPreviewSubtitle')}</div></div><Badge variant="outline">{t('dmPreviewBadge')}</Badge></div>
            {!data.dm_message ? <div className="rounded-2xl border border-dashed border-[#2b2d31] p-6 text-center text-xs text-muted-foreground">{t('addDmMessageHint')}</div> : (
              <>
                <DiscordMessage>
                  <EmbedPreview
                    accentColor="#57F287"
                    authorName={meta.guild.name || 'Your Server'}
                    title={`Welcome to ${meta.guild.name || 'Your Server'}`}
                    description={replacePreview(data.dm_message)}
                    imageUrl={dmPreviewImage}
                    imageAsThumbnail={dmImageMode !== 'custom'}
                  />
                </DiscordMessage>
                {dmImageMode === 'custom' && <UnresolvedLinkNote url={data.dm_image_url} />}
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
function GoodbyePanel({ guildId, meta }) {
  const t = useTranslations('guildSettings.goodbye');
  const tc = useTranslations('guildSettings.common');
  const { data, setData, save, saving, dirty, discard, rights, setRights } = useModule(guildId, 'goodbye');
  const [savedFormat, setSavedFormat] = useState(null);
  const [savedCardSize, setSavedCardSize] = useState(null);
  useEffect(() => {
    if (data && savedFormat === null) {
      const initial = ['plain', 'avatar', 'card'].includes(data.message_format)
        ? data.message_format
        : (data.embed === false ? 'plain' : (data.card_enabled ? 'card' : 'avatar'));
      setSavedFormat(initial);
    }
    if (data && savedCardSize === null) {
      setSavedCardSize(memberCardSize(data.card_size));
    }
  }, [data, savedFormat, savedCardSize]);
  if (!data) return <Skeleton />;

  const imageMode = data.image_mode || 'member_avatar';
  const cardEnabled = !!data.card_enabled;
  const storedMessageFormat = ['plain', 'avatar', 'card'].includes(data.message_format)
    ? data.message_format
    : (data.embed === false ? 'plain' : (cardEnabled ? 'card' : 'avatar'));
  const messageFormat = storedMessageFormat;
  const setMessageFormat = (mode) => {
    if (!['plain', 'avatar', 'card'].includes(mode)) return;
    setData({
      ...data,
      message_format: mode,
      embed: mode !== 'plain',
      card_enabled: mode === 'card',
    });
  };

  const backgroundUrl = data.card_background_url || '';
  const previewBackgroundUrl = resolvePreviewUrl(backgroundUrl);
  const textColor = data.card_text_color || '#ffffff';
  const overlayColor = data.card_overlay_color || '#0f172a';
  const overlayOpacity = Number.isFinite(Number(data.card_overlay_opacity)) ? Math.min(100, Math.max(0, Number(data.card_overlay_opacity))) : 58;

  const previewImage = imageMode === 'server_avatar'
    ? (meta.guild.icon ? discordCdnUrl(`https://cdn.discordapp.com/icons/${meta.guild.id}/${meta.guild.icon}.png?size=256`) : null)
    : imageMode === 'member_avatar'
      ? discordCdnUrl('https://cdn.discordapp.com/embed/avatars/0.png')
      : imageMode === 'custom' && data.image_url
        ? resolvePreviewUrl(data.image_url)
        : null;

  const avatarPreview = data.card_avatar_mode === 'none' ? null :
    data.card_avatar_mode === 'server'
      ? (meta.guild.icon ? discordCdnUrl(`https://cdn.discordapp.com/icons/${meta.guild.id}/${meta.guild.icon}.png?size=256`) : discordCdnUrl('https://cdn.discordapp.com/embed/avatars/0.png'))
      : discordCdnUrl('https://cdn.discordapp.com/embed/avatars/0.png');

  const replacePreview = (text) => String(text || '')
    .replaceAll('{user}', '@Member')
    .replaceAll('{user.mention}', '@Member')
    .replaceAll('{user.name}', 'Member')
    .replaceAll('{user.id}', '123456789')
    .replaceAll('{user.tag}', 'Member#0000')
    .replaceAll('{guild.name}', meta.guild.name || 'Your Server')
    .replaceAll('{guild.id}', meta.guild.id || '123456789')
    .replaceAll('{member_count}', '1,284');

  const saveGoodbye = async () => {
    for (const [value, message] of [[data.image_url, tc('invalidImageUrl')], [backgroundUrl, t('invalidBackgroundUrl')]]) {
      if (!isUsableImageUrl(value)) {
        toast.error(message, { description: tc('invalidImageUrlHint') });
        return;
      }
    }
    for (const color of [data.color || '#e08a4e', textColor, overlayColor]) {
      if (!/^#[0-9a-fA-F]{6}$/.test(String(color).trim())) {
        toast.error(tc('invalidColor'), { description: tc('invalidColorHint') });
        return;
      }
    }
    const ok = await save({
      channel_id: data.channel_id,
      embed: !!data.embed,
      title: data.title || 'Goodbye, {user.name}!',
      message: data.message || '{user.name} has left **{guild.name}**. We now have {member_count} members.',
      footer: data.footer || '',
      color: data.color || '#e08a4e',
      image_mode: imageMode,
      image_url: data.image_url || null,
      timestamp: data.timestamp !== false,
      card_enabled: storedMessageFormat === 'card',
      message_format: storedMessageFormat,
      card_background_url: backgroundUrl || null,
      card_overlay_color: overlayColor,
      card_overlay_opacity: overlayOpacity,
      card_text_color: textColor,
      card_avatar_mode: ['member', 'server', 'none'].includes(data.card_avatar_mode) ? data.card_avatar_mode : 'member',
      card_avatar_ring: data.card_avatar_ring !== false,
      card_size: memberCardSize(data.card_size),
      card_gradient: AURORA_GRADIENTS[data.card_gradient] ? data.card_gradient : 'ember',
      card_font: CARD_FONT_IDS.includes(data.card_font) ? data.card_font : 'default',
    });
    if (ok) { setSavedFormat(storedMessageFormat); setSavedCardSize(memberCardSize(data.card_size)); }
  };

  return (
    <div className="space-y-6">
      <SectionHeader title={t('title')} description={`${t('description')} ${tc('placeholdersPrefix')} {user.mention}, {user.name}, {user}, {guild.name}, {member_count}.`} />
      {data && hasUserImage(data, window.location.host) ? <PolicyConsent ns="guildSettings.common" checked={rights} onChange={setRights} /> : null}
      <div className="grid xl:grid-cols-[1.05fr_.95fr] gap-6 items-start">
        <div className="space-y-6">
          <Card className="p-4 sm:p-6 space-y-5 bg-card/60">
            <div className="flex items-center justify-between gap-4">
              <div><div className="font-semibold">{t('messageCardTitle')}</div><div className="text-xs text-muted-foreground mt-1">{t('messageCardDesc')}</div></div>
            </div>
            <FieldRow label={tc('channel')}><ChannelSelect value={data.channel_id} onChange={(v) => setData({ ...data, channel_id: v })} channels={meta.channels} /></FieldRow>
          </Card>

          <Card className="p-6 space-y-4 bg-card/60">
            <div><div className="font-semibold">{t('formatCardTitle')}</div><div className="text-xs text-muted-foreground mt-1">{t('formatCardDesc')}</div></div>
            <MessageFormatSwitches
              mode={messageFormat}
              savedMode={savedFormat}
              onChange={setMessageFormat}
              options={[
                { value: 'plain', label: t('formatPlainLabel'), desc: t('formatPlainDesc') },
                { value: 'avatar', label: t('formatAvatarLabel'), desc: t('formatAvatarDesc') },
                { value: 'card', label: t('formatCustomCardLabel'), desc: t('formatCustomCardDesc') },
              ]}
            />
          </Card>

          <Card className="p-4 sm:p-6 space-y-5 bg-card/60">
            <div><div className="font-semibold">{t('contentCardTitle')}</div><div className="text-xs text-muted-foreground mt-1">{t('contentCardDesc')}</div></div>
            <div>
              <div className="flex items-center gap-1.5 mb-1"><Label className="mb-0">{tc('titleLabel')}</Label><InfoHint>{messageFormat === 'plain' ? t('titleUnusedHint') : messageFormat === 'card' ? t('titleOnCardHint') : t('titleOnEmbedHint')}</InfoHint></div>
              <Input disabled={messageFormat === 'plain'} value={data.title ?? 'Goodbye, {user.name}!'} onChange={(e) => setData({ ...data, title: e.target.value })} placeholder={t.raw('titlePlaceholder')} maxLength={256} />
            </div>
            <div><Label>{t('descriptionLabel')}</Label><Textarea rows={5} value={data.message || ''} onChange={(e) => setData({ ...data, message: e.target.value })} placeholder={t.raw('messagePlaceholder')} maxLength={4096} /></div>
            <div>
              <div className="flex items-center gap-1.5 mb-1"><Label className="mb-0">{tc('footerLabel')}</Label><InfoHint>{messageFormat === 'plain' ? t('footerUnusedHint') : messageFormat === 'card' ? t('footerOnCardHint') : t('footerOnEmbedHint')}</InfoHint></div>
              <Input disabled={messageFormat === 'plain'} value={data.footer ?? ''} onChange={(e) => setData({ ...data, footer: e.target.value })} placeholder={t.raw('footerPlaceholder')} maxLength={2048} />
            </div>
            <div><Label>{tc('variablesLabel')}</Label><div className="flex flex-wrap gap-2 mt-2">{['{user.name}', '{user.mention}', '{user}', '{guild.name}', '{member_count}'].map((v) => (<button key={v} type="button" onClick={() => setData({ ...data, message: `${data.message || ''}${data.message ? ' ' : ''}${v}` })} className="rounded-full border border-border bg-secondary/50 px-2.5 py-1 text-xs hover:bg-secondary transition">{v}</button>))}</div></div>
          </Card>

          {messageFormat !== 'plain' && (
            <Card className="p-4 sm:p-6 space-y-5 bg-card/60">
              <div><div className="font-semibold">{t('imageCardTitle')}</div><div className="text-xs text-muted-foreground mt-1">{messageFormat === 'card' ? t('imageCardDescCard') : t('imageCardDescAvatar')}</div></div>

              {messageFormat === 'avatar' && <>
                <div><Label>{tc('imageLabel')}</Label><Select value={imageMode} onValueChange={(v) => setData({ ...data, image_mode: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="member_avatar">{tc('memberAvatar')}</SelectItem><SelectItem value="server_avatar">{tc('serverAvatar')}</SelectItem><SelectItem value="custom">{tc('customImage')}</SelectItem><SelectItem value="none">{tc('noImage')}</SelectItem></SelectContent></Select></div>
                {imageMode === 'custom' && <div><div className="flex items-center gap-1.5 mb-1"><Label className="mb-0">{tc('imageUrlLabel')}</Label><InfoHint>{tc('imageUrlHint')}</InfoHint></div><div className="flex flex-col sm:flex-row gap-2"><Input className="sm:flex-1" value={data.image_url || ''} onChange={(e) => setData({ ...data, image_mode: e.target.value ? 'custom' : 'none', image_url: e.target.value || null })} placeholder="https://example.com/goodbye.gif" /><PresetPicker category="goodbye" onSelect={(url) => setData({ ...data, image_mode: 'custom', image_url: url })} /></div></div>}
              </>}

              {messageFormat === 'card' && <>
                <div><div className="flex items-center gap-1.5 mb-1"><Label className="mb-0">{t('backgroundImageLabel')}</Label><InfoHint>{t('backgroundImageHint')}</InfoHint></div><div className="flex flex-col sm:flex-row gap-2"><Input className="sm:flex-1" value={backgroundUrl} onChange={(e) => setData({ ...data, card_background_url: e.target.value || null })} placeholder="https://example.com/goodbye-background.jpg" /><PresetPicker category="welcome-background" onSelect={(url) => setData({ ...data, card_background_url: url })} /></div><ImageHostingTip /></div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div><Label>{t('avatarLabel')}</Label><Select value={data.card_avatar_mode || 'member'} onValueChange={(v) => setData({ ...data, card_avatar_mode: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="member">{t('avatarMemberOption')}</SelectItem><SelectItem value="server">{t('avatarServerOption')}</SelectItem><SelectItem value="none">{t('avatarNoneOption')}</SelectItem></SelectContent></Select></div>
                  <div className="flex items-end"><FieldRow label={t('avatarRingLabel')}><Switch checked={data.card_avatar_ring !== false} onCheckedChange={(v) => setData({ ...data, card_avatar_ring: v })} /></FieldRow></div>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div><Label>{t('textColorLabel')}</Label><div className="flex gap-2"><Input type="color" className="w-14 p-1 h-10" value={textColor} onChange={(e) => setData({ ...data, card_text_color: e.target.value })} /><Input value={textColor} onChange={(e) => setData({ ...data, card_text_color: e.target.value })} /></div></div>
                  <div><Label>{t('overlayColorLabel')}</Label><div className="flex gap-2"><Input type="color" className="w-14 p-1 h-10" value={overlayColor} onChange={(e) => setData({ ...data, card_overlay_color: e.target.value })} /><Input value={overlayColor} onChange={(e) => setData({ ...data, card_overlay_color: e.target.value })} /></div></div>
                </div>
                <div><div className="flex justify-between mb-2"><Label>{t('overlayOpacityLabel')}</Label><span className="text-xs text-muted-foreground">{overlayOpacity}%</span></div><input className="w-full accent-primary" type="range" min="0" max="100" value={overlayOpacity} onChange={(e) => setData({ ...data, card_overlay_opacity: Number(e.target.value) })} /></div>
                <MemberCardSizePicker value={data.card_size} onChange={(v) => setData({ ...data, card_size: v })} t={t} savedValue={savedCardSize} tc={tc} />
                <CardFontPicker value={data.card_font} onChange={(v) => setData({ ...data, card_font: v })} />
                {data.card_size === 'aurora' && <AuroraGradientPicker value={data.card_gradient} onChange={(v) => setData({ ...data, card_gradient: v })} hasImage={Boolean(backgroundUrl)} onClearImage={() => setData({ ...data, card_background_url: null })} />}
              </>}
            </Card>
          )}

          {messageFormat !== 'plain' && (
            <Card className="p-4 sm:p-6 space-y-5 bg-card/60">
              <div><div className="font-semibold">{tc('appearanceCardTitle')}</div><div className="text-xs text-muted-foreground mt-1">{tc('appearanceCardDesc')}</div></div>
              <div>
                <div className="flex items-center gap-1.5 mb-1"><Label className="mb-0">{tc('accentColor')}</Label><InfoHint>{messageFormat === 'card' ? t('accentColorWithCardHint') : t('accentColorOnEmbedHint')}</InfoHint></div>
                <div className="flex gap-2"><Input type="color" className="w-14 p-1 h-10" value={data.color || '#e08a4e'} onChange={(e) => setData({ ...data, color: e.target.value })} /><Input value={data.color || '#e08a4e'} onChange={(e) => setData({ ...data, color: e.target.value })} placeholder="#e08a4e" /></div>
              </div>
              <FieldRow label={tc('timestampLabel')} hint={messageFormat === 'card' ? t('timestampWithCardHint') : t('timestampOnEmbedHint')}><Switch checked={data.timestamp !== false} onCheckedChange={(v) => setData({ ...data, timestamp: v })} /></FieldRow>
            </Card>
          )}

          <SaveBar saving={saving} dirty={dirty} onDiscard={discard} onSave={saveGoodbye} />
        </div>

        <Card className="p-5 bg-card/60 xl:sticky xl:top-6">
          <div className="flex items-center justify-between gap-3 mb-4"><div className="min-w-0"><div className="font-semibold">{tc('livePreview')}</div><div className="text-xs text-muted-foreground">{messageFormat === 'card' ? t('cardPreviewHint') : tc('updatesInstantly')}</div></div><Badge variant="outline" className="shrink-0">{t('goodbyeBadge')}</Badge></div>
          <DiscordMessage>
            {messageFormat === 'plain' ? (
              <DiscordText>{replacePreview(data.message || '{user.name} has left **{guild.name}**. We now have {member_count} members.')}</DiscordText>
            ) : messageFormat === 'card' ? (
              <EmbedPreview accentColor={data.color || '#e08a4e'} authorName={meta.guild.name || 'Your Server'} timestamp={data.timestamp !== false}>
                <div className="overflow-hidden rounded-[8px]">
                  {data.card_size === 'aurora' ? (
                    <MemberAuroraPreview fontId={data.card_font} gradient={data.card_gradient} backgroundUrl={backgroundUrl} previewBackgroundUrl={previewBackgroundUrl} overlayColor={overlayColor} overlayOpacity={overlayOpacity} textColor={textColor} ringColor={data.color || '#e08a4e'} ring={data.card_avatar_ring !== false} avatarUrl={avatarPreview} badge="Goodbye"
                      title={replacePreview(data.title || 'Goodbye, {user.name}!')} message={replacePreview(data.message || '{user.name} has left **{guild.name}**. We now have {member_count} members.')} footer={replacePreview(data.footer || '')} />
                  ) : (
                    <CardPreview
                      fontId={data.card_font}
                      backgroundUrl={previewBackgroundUrl}
                      overlayColor={overlayColor}
                      overlayOpacity={overlayOpacity}
                      textColor={textColor}
                      avatarUrl={avatarPreview}
                      avatarRing={data.card_avatar_ring !== false}
                      ringColor={data.color || '#e08a4e'}
                      title={replacePreview(data.title || 'Goodbye, {user.name}!')}
                      message={replacePreview(data.message || '{user.name} has left **{guild.name}**. We now have {member_count} members.')}
                      footer={replacePreview(data.footer || '')}
                    />
                  )}
                </div>
              </EmbedPreview>
            ) : (
              <EmbedPreview
                accentColor={data.color || '#e08a4e'}
                authorName={meta.guild.name || 'Your Server'}
                title={replacePreview(data.title || 'Goodbye!')}
                description={replacePreview(data.message || '')}
                footer={replacePreview(data.footer || '')}
                timestamp={data.timestamp !== false}
                imageUrl={previewImage}
                imageAsThumbnail={imageMode !== 'custom'}
              />
            )}
          </DiscordMessage>
          {messageFormat === 'card' ? <UnresolvedLinkNote url={backgroundUrl} /> : null}
          {messageFormat === 'avatar' && imageMode === 'custom' ? <UnresolvedLinkNote url={data.image_url} /> : null}
        </Card>
      </div>
    </div>
  );
}
function CaptchaPanel({ guildId, meta }) {
  const t = useTranslations('guildSettings.captcha');
  const tc = useTranslations('guildSettings.common');
  const { data, setData, save, saving, dirty, discard } = useModule(guildId, 'captcha');
  const [posting, setPosting] = useState(false);
  if (!data) return <Skeleton />;

  const verifyUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/verify/${guildId}`;

  const saveCaptcha = () => {
    if (data.embed_image_url) {
      try {
        const u = new URL(data.embed_image_url);
        if (!['http:', 'https:'].includes(u.protocol)) throw new Error();
      } catch {
        toast.error(t('invalidImageUrl'), { description: t('invalidImageUrlDesc') });
        return;
      }
    }
    if (data.embed_color && !/^#[0-9a-fA-F]{6}$/.test(String(data.embed_color).trim())) {
      toast.error(t('invalidColor'), { description: t('invalidColorDesc') });
      return;
    }
    save({
      channel_id: data.channel_id,
      role_id: data.role_id,
      embed_title: data.embed_title || 'Captcha',
      embed_description: data.embed_description || '',
      embed_color: data.embed_color || '#e08a4e',
      embed_image_url: data.embed_image_url || null,
      embed_footer: data.embed_footer || '',
      button_label: data.button_label || 'Verify',
      button_emoji: data.button_emoji || '✅',
      page_heading: data.page_heading || 'Captcha',
      page_description: data.page_description || '',
      page_button_label: data.page_button_label || 'Verify',
      page_success_heading: data.page_success_heading || '',
      page_success_message: data.page_success_message || '',
      page_already_verified_message: data.page_already_verified_message || '',
      page_not_member_message: data.page_not_member_message || '',
      min_account_age_days: Number(data.min_account_age_days) || 0,
    });
  };

  const postPanel = async () => {
    if (!data.channel_id) { toast.error(t('chooseChannelFirst')); return; }
    if (!data.role_id) { toast.error(t('chooseRoleFirst')); return; }
    setPosting(true);
    try {
      const r = await fetch(`/api/guilds/${guildId}/captcha/panel`, { method: 'POST' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        toast.error(t('publishFailed'), { description: d?.error || `HTTP ${r.status}` });
        return;
      }
      setData((prev) => ({ ...prev, ...d }));
      toast.success(t('publishSuccess'));
    } catch (e) {
      toast.error(t('publishFailed'), { description: e.message });
    } finally {
      setPosting(false);
    }
  };

  const eligibleRoles = (meta.roles || []).filter((r) => !r.managed);

  return (
    <div className="space-y-6">
      <SectionHeader title="Captcha" description={t('description')} />
      <div className="grid xl:grid-cols-[1.05fr_.95fr] gap-6 items-start">
        <div className="space-y-6">
          <Card className="p-4 sm:p-6 space-y-5 bg-card/60">
            <FieldRow label={tc('channel')}>
              <ChannelSelect value={data.channel_id} onChange={(v) => setData({ ...data, channel_id: v })} channels={meta.channels} />
            </FieldRow>
            <FieldRow label={t('roleLabel')} hint={t('roleHint')}>
              <RoleSelect value={data.role_id} onChange={(v) => setData({ ...data, role_id: v })} roles={eligibleRoles} />
            </FieldRow>
          </Card>

          <Card className="p-4 sm:p-6 space-y-5 bg-card/60">
            <div><div className="font-semibold">{t('discordCardTitle')}</div><div className="text-xs text-muted-foreground mt-1">{t('discordCardDesc')}</div></div>
            <div><Label>{tc('titleLabel')}</Label><Input value={data.embed_title ?? ''} onChange={(e) => setData({ ...data, embed_title: e.target.value })} placeholder="Captcha" maxLength={256} /></div>
            <div><Label>{t('descriptionLabel')}</Label><Textarea rows={4} value={data.embed_description ?? ''} onChange={(e) => setData({ ...data, embed_description: e.target.value })} maxLength={4096} /></div>
            <div><Label>{tc('footerLabel')}</Label><Input value={data.embed_footer ?? ''} onChange={(e) => setData({ ...data, embed_footer: e.target.value })} maxLength={2048} /></div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div><Label>{tc('accentColor')}</Label><div className="flex gap-2"><Input type="color" className="w-14 p-1 h-10" value={data.embed_color || '#e08a4e'} onChange={(e) => setData({ ...data, embed_color: e.target.value })} /><Input value={data.embed_color || '#e08a4e'} onChange={(e) => setData({ ...data, embed_color: e.target.value })} /></div></div>
              <div><div className="flex items-center gap-1.5 mb-1"><Label className="mb-0">{t('imageLabel')}</Label><InfoHint>{t('imageHint')}</InfoHint></div><Input value={data.embed_image_url || ''} onChange={(e) => setData({ ...data, embed_image_url: e.target.value || null })} placeholder="https://example.com/banner.png" /></div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div><Label>{t('buttonTextLabel')}</Label><Input value={data.button_label ?? ''} onChange={(e) => setData({ ...data, button_label: e.target.value })} maxLength={80} /></div>
              <div><Label>{t('buttonEmojiLabel')}</Label><Input value={data.button_emoji ?? ''} onChange={(e) => setData({ ...data, button_emoji: e.target.value })} maxLength={64} /></div>
            </div>
          </Card>

          <Card className="p-4 sm:p-6 space-y-5 bg-card/60">
            <div><div className="font-semibold">{t('webCardTitle')}</div><div className="text-xs text-muted-foreground mt-1">{t('webCardDesc')}</div></div>
            <div><Label>{t('pageTitleLabel')}</Label><Input value={data.page_heading ?? ''} onChange={(e) => setData({ ...data, page_heading: e.target.value })} maxLength={256} /></div>
            <div><Label>{t('pageDescriptionLabel')}</Label><Textarea rows={3} value={data.page_description ?? ''} onChange={(e) => setData({ ...data, page_description: e.target.value })} maxLength={1024} /></div>
            <div><Label>{t('pageButtonLabel')}</Label><Input value={data.page_button_label ?? ''} onChange={(e) => setData({ ...data, page_button_label: e.target.value })} maxLength={80} /></div>
            <Separator />
            <div><Label>{t('successTitleLabel')}</Label><Input value={data.page_success_heading ?? ''} onChange={(e) => setData({ ...data, page_success_heading: e.target.value })} maxLength={256} /></div>
            <div><Label>{t('successMessageLabel')}</Label><Textarea rows={2} value={data.page_success_message ?? ''} onChange={(e) => setData({ ...data, page_success_message: e.target.value })} maxLength={1024} /></div>
            <div><Label>{t('alreadyVerifiedLabel')}</Label><Textarea rows={2} value={data.page_already_verified_message ?? ''} onChange={(e) => setData({ ...data, page_already_verified_message: e.target.value })} maxLength={1024} /></div>
            <div><Label>{t('notMemberLabel')}</Label><Textarea rows={2} value={data.page_not_member_message ?? ''} onChange={(e) => setData({ ...data, page_not_member_message: e.target.value })} maxLength={1024} /></div>
            <Separator />
            <div>
              <Label>{t('minAccountAgeLabel')}</Label>
              <Input
                type="number"
                min={0}
                max={365}
                value={data.min_account_age_days ?? 0}
                onChange={(e) => setData({ ...data, min_account_age_days: e.target.value })}
              />
              <p className="text-xs text-muted-foreground mt-1">{t('minAccountAgeHelp')}</p>
            </div>
          </Card>

          <SaveBar saving={saving} dirty={dirty} onDiscard={discard} onSave={saveCaptcha} />

          <Card className="p-4 sm:p-6 space-y-3 bg-card/60">
            <div className="font-semibold">{t('publishCardTitle')}</div>
            <p className="text-xs text-muted-foreground">{t('publishCardDesc')}</p>
            <div className="flex justify-end pt-2">
              <Button onClick={postPanel} disabled={posting} className="gradient-primary">
                {posting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ExternalLink className="w-4 h-4 mr-2" />}
                {t('publishButton')}
              </Button>
            </div>
          </Card>
        </div>

        <div className="space-y-6 xl:sticky xl:top-6">
          <Card className="p-5 bg-card/60">
            <div className="flex items-center justify-between mb-4"><div><div className="font-semibold">{t('discordPreviewTitle')}</div><div className="text-xs text-muted-foreground">{tc('updatesInstantly')}</div></div><Badge variant="outline">Captcha</Badge></div>
            <DiscordMessage>
              <EmbedPreview
                accentColor={/^#[0-9a-fA-F]{6}$/.test(String(data.embed_color || '')) ? data.embed_color : '#e08a4e'}
                title={data.embed_title || 'Verificare membru'}
                description={data.embed_description || ''}
                imageUrl={data.embed_image_url || null}
                footer={data.embed_footer || ''}
                buttons={[{ label: data.button_label || 'Verifica te', emoji: /^<a?:/.test(String(data.button_emoji || '')) ? null : (data.button_emoji || '✅'), style: 'link' }]}
              />
            </DiscordMessage>
          </Card>

          <Card className="p-5 bg-card/60">
            <div className="flex items-center justify-between mb-4"><div><div className="font-semibold">{t('webPreviewTitle')}</div><div className="text-xs text-muted-foreground break-all">{verifyUrl}</div></div></div>
            <div className="rounded-2xl border border-border/60 bg-background/60 p-5 text-center space-y-3">
              <div className="mx-auto w-12 h-12 rounded-full bg-[#e08a4e]/15 flex items-center justify-center"><ShieldCheck className="w-6 h-6 text-[#e08a4e]" /></div>
              <div className="font-semibold">{data.page_heading || 'Captcha'}</div>
              <div className="text-xs text-muted-foreground">{data.page_description}</div>
              <div className="inline-block rounded-md bg-[#e08a4e] px-4 py-2 text-sm font-medium text-white">{data.page_button_label || 'Verify'}</div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
function AutoRolePanel({ guildId, meta }) {
  const t = useTranslations('guildSettings.autorole');
  const { data, setData, save, saving, dirty, discard } = useModule(guildId, 'welcome');
  if (!data) return <Skeleton />;
  return (
    <div className="space-y-6">
      <SectionHeader title={t('title')} description={t('description')} />
      <Card className="p-4 sm:p-6 space-y-5 bg-card/60">
        <FieldRow label={t('autoRole')}>
          <RoleSelect value={data.auto_role_id} onChange={(v) => setData({ ...data, auto_role_id: v })} roles={meta.roles} />
        </FieldRow>
        <SaveBar saving={saving} dirty={dirty} onDiscard={discard} onSave={() => save({ auto_role_id: data.auto_role_id, activate_autorole: Boolean(data.auto_role_id) })} />
      </Card>
      <Card className="p-4 sm:p-6 bg-amber-500/[0.06] border-amber-500/30">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-amber-300"><AlertTriangle className="h-4 w-4" aria-hidden="true" />{t('helpTitle')}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{t('helpIntro')}</p>
        <ol className="mt-3 space-y-2.5 text-sm">
          {t.raw('helpItems').map((item, i) => (
            <li key={i} className="flex gap-3"><span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-xs font-semibold text-amber-300">{i + 1}</span><span><strong className="font-semibold">{item.title}</strong> <span className="text-muted-foreground">{item.text}</span></span></li>
          ))}
        </ol>
      </Card>
    </div>
  );
}

function ModerationPanel({ guildId, meta }) {
  const t = useTranslations('guildSettings.moderation');
  const { data, setData, save, saving, dirty, discard } = useModule(guildId, 'settings');
  if (!data) return <Skeleton />;
  return (
    <div className="space-y-6">
      <SectionHeader title={t('title')} description={t('description')} />
      <Card className="p-4 sm:p-6 space-y-5 bg-card/60">
        <FieldRow label={t('adminRole')} hint={t('adminRoleHint')}>
          <RoleSelect value={data.admin_role_id} onChange={(v) => setData({ ...data, admin_role_id: v })} roles={meta.roles} />
        </FieldRow>
        <FieldRow label={t('moderatorRole')} hint={t('moderatorRoleHint')}>
          <RoleSelect value={data.moderator_role_id} onChange={(v) => setData({ ...data, moderator_role_id: v })} roles={meta.roles} />
        </FieldRow>
        <FieldRow label={t('modLogChannel')} hint={t('modLogChannelHint')}>
          <ChannelSelect value={data.mod_log_channel_id} onChange={(v) => setData({ ...data, mod_log_channel_id: v })} channels={meta.channels} />
        </FieldRow>
        <SaveBar saving={saving} dirty={dirty} onDiscard={discard} onSave={() => save({
          admin_role_id: data.admin_role_id,
          moderator_role_id: data.moderator_role_id,
          mod_log_channel_id: data.mod_log_channel_id,
        })} />
      </Card>
    </div>
  );
}

function AutomodPanel({ guildId, meta }) {
  const t = useTranslations('guildSettings.automod');
  const tMod = useTranslations('guildSettings.moderation');
  const tModPage = useTranslations('modules');
  const { data, setData, save, saving, dirty, discard } = useModule(guildId, 'automod');
  const { data: modSettings } = useModule(guildId, 'settings');
  if (!data) return <Skeleton />;
  const toggles = [
    ['anti_spam', t('toggleAntiSpam'), t('toggleAntiSpamHint')], ['anti_mention_spam', t('toggleAntiMentionSpam'), t('toggleAntiMentionSpamHint')], ['anti_invite', t('toggleAntiInvite'), t('toggleAntiInviteHint')],
    ['anti_link', t('toggleAntiLink'), t('toggleAntiLinkHint')], ['anti_raid', t('toggleAntiRaid'), t('toggleAntiRaidHint')], ['anti_scam_links', t('toggleAntiScamLinks'), t('toggleAntiScamLinksHint')],
    ['anti_phishing', t('toggleAntiPhishing'), t('toggleAntiPhishingHint')], ['bad_words_filter', t('toggleBadWords'), t('toggleBadWordsHint')], ['caps_filter', t('toggleCaps'), t('toggleCapsHint')],
    ['duplicate_filter', t('toggleDuplicate'), t('toggleDuplicateHint')], ['repeated_chars_filter', t('toggleRepeatedChars'), t('toggleRepeatedCharsHint')], ['message_length_filter', t('toggleMessageLength'), t('toggleMessageLengthHint')],
    ['anti_mass_spam', t('toggleMassSpam'), t('toggleMassSpamHint')],
  ];
  const actionFields = [
    ['bad_words_filter', 'bad_words_action', t('actionBadWords')], ['anti_spam', 'anti_spam_action', t('actionSpam')],
    ['anti_link', 'anti_link_action', t('actionLinks')], ['anti_invite', 'anti_invite_action', t('actionInvites')],
    ['anti_mention_spam', 'anti_mention_spam_action', t('actionMentions')], ['anti_scam_links', 'anti_scam_links_action', t('actionScamPatterns')],
    ['caps_filter', 'caps_filter_action', t('actionCaps')], ['duplicate_filter', 'duplicate_filter_action', t('actionDuplicates')],
    ['repeated_chars_filter', 'repeated_chars_filter_action', t('actionRepeatedChars')], ['anti_phishing', 'anti_phishing_action', t('actionPhishing')],
    ['message_length_filter', 'message_length_filter_action', t('actionLongMessages')],
    ['anti_mass_spam', 'anti_mass_spam_action', t('actionMassSpam')],
    ['image_scam', 'image_scam_action', t('actionImageScam')],
    ['new_member_link_minutes', 'new_member_links_action', t('actionNewMemberLinks')],
  ];
  const actionOptions = [['delete',t('optionDelete')],['warn',t('optionWarn')],['timeout',t('optionTimeout')],['kick',t('optionKick')],['ban',t('optionBan')]];
  const set = (k, v) => setData({ ...data, [k]: v });
  return (
    <div className="space-y-6">
      <SectionHeader title={t('title')} description={t('description')} />
      <Card className="p-4 sm:p-6 space-y-5 bg-card/60">
        <div className="rounded-lg border border-border/50 bg-secondary/20 px-4 py-3 text-sm text-muted-foreground">
          {t('expandedBanner')}
        </div>
        <div className="rounded-lg border border-border/50 bg-secondary/20 px-4 py-3 text-sm text-muted-foreground">
          {t('moduleScopeNote')}
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          {toggles.map(([k, label, hint]) => <div key={k} className="flex items-center justify-between gap-3 rounded-lg border border-border/50 px-4 py-3 bg-secondary/20"><span className="flex min-w-0 items-center gap-1.5 text-sm"><span className="min-w-0">{label}</span><InfoHint>{hint}</InfoHint></span><Switch checked={!!data[k]} onCheckedChange={(v) => set(k, v)} /></div>)}
        </div>
        <Separator />
        <div className="grid sm:grid-cols-2 gap-4">
          <NumField label={t('spamThreshold')} hint={t('spamThresholdHint')} value={data.spam_threshold} onChange={(v) => set('spam_threshold', v)} disabled={!data.anti_spam} />
          <NumField label={t('spamInterval')} hint={t('spamIntervalHint')} value={data.spam_interval} onChange={(v) => set('spam_interval', v)} disabled={!data.anti_spam} />
          <NumField label={t('mentionThreshold')} hint={t('mentionThresholdHint')} value={data.mention_threshold} onChange={(v) => set('mention_threshold', v)} disabled={!data.anti_mention_spam} />
          <NumField label={t('capsThreshold')} hint={t('capsThresholdHint')} value={data.caps_threshold} onChange={(v) => set('caps_threshold', v)} disabled={!data.caps_filter} />
          <NumField label={t('duplicateWindow')} hint={t('duplicateWindowHint')} value={data.duplicate_window} onChange={(v) => set('duplicate_window', v)} disabled={!data.duplicate_filter} />
          <NumField label={t('repeatedCharsThreshold')} hint={t('repeatedCharsThresholdHint')} value={data.repeated_chars_threshold} onChange={(v) => set('repeated_chars_threshold', v)} disabled={!data.repeated_chars_filter} />
          <NumField label={t('maxMessageLength')} hint={t('maxMessageLengthHint')} value={data.max_message_length} onChange={(v) => set('max_message_length', v)} disabled={!data.message_length_filter} />
        </div>
        <Separator />
        <div className="space-y-3">
          <div className="flex items-center gap-1.5"><Label className="mb-0">{t('actionsLabel')}</Label><InfoHint>{t('actionsHint')}</InfoHint></div>
          <FieldRow label={t('defaultAction')}><Select value={data.default_action || 'delete'} onValueChange={(v) => set('default_action', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{actionOptions.map(([v,l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select></FieldRow>
          <div className="grid sm:grid-cols-2 gap-3">
            {actionFields.map(([enabled, field, label]) => <FieldRow key={field} label={label}><Select disabled={!data[enabled]} value={data[field] || data.default_action || 'delete'} onValueChange={(v) => set(field, v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{actionOptions.map(([v,l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select></FieldRow>)}
          </div>
          {(data.default_action === 'timeout' || actionFields.some(([, field]) => (data[field] || data.default_action) === 'timeout')) && (
            <NumField label={t('timeoutSeconds')} hint={t('timeoutSecondsHint')} value={data.timeout_seconds} onChange={(v) => set('timeout_seconds', v)} />
          )}
        </div>
        <Separator />
        <div className="space-y-3">
          <div className="flex items-center gap-1.5"><Label className="mb-0">{t('strikeSystem')}</Label><InfoHint>{t('strikeSystemHint')}</InfoHint></div>
          <div className="flex items-center justify-between rounded-lg border border-border/50 px-4 py-3 bg-secondary/20"><span className="text-sm">{t('enableStrikes')}</span><Switch checked={data.strike_enabled !== false} onCheckedChange={(v) => set('strike_enabled', v)} /></div>
          <div className="grid sm:grid-cols-2 gap-4">
            <NumField label={t('strikesToEscalate')} hint={t('strikesToEscalateHint')} value={data.strike_threshold} onChange={(v) => set('strike_threshold', v)} disabled={data.strike_enabled === false} />
            <NumField label={t('strikeDecay')} hint={t('strikeDecayHint')} value={data.strike_decay_seconds} onChange={(v) => set('strike_decay_seconds', v)} disabled={data.strike_enabled === false} />
          </div>
          <FieldRow label={t('escalationAction')}><Select disabled={data.strike_enabled === false} value={data.escalation_action || 'timeout'} onValueChange={(v) => set('escalation_action', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{actionOptions.map(([v,l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select></FieldRow>
          {data.strike_enabled !== false && data.escalation_action === 'timeout' && data.default_action !== 'timeout' && !actionFields.some(([, field]) => (data[field] || data.default_action) === 'timeout') && (
            <NumField label={t('timeoutSeconds')} hint={t('timeoutSecondsHint')} value={data.timeout_seconds} onChange={(v) => set('timeout_seconds', v)} />
          )}
        </div>
        <Separator />
        <div className="space-y-3">
          <div className="flex items-center gap-1.5"><Label className="mb-0">{t('raidProtection')}</Label><InfoHint>{t('raidProtectionHint')}</InfoHint></div>
          <div className="grid sm:grid-cols-3 gap-4">
            <NumField label={t('raidJoins')} hint={t('raidJoinsHint')} value={data.raid_join_threshold} onChange={(v) => set('raid_join_threshold', v)} disabled={!data.anti_raid} />
            <NumField label={t('raidWindow')} hint={t('raidWindowHint')} value={data.raid_window_seconds} onChange={(v) => set('raid_window_seconds', v)} disabled={!data.anti_raid} />
            <NumField label={t('newAccountAge')} hint={t('newAccountAgeHint')} value={data.raid_new_account_days} onChange={(v) => set('raid_new_account_days', v)} disabled={!data.anti_raid} />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <FieldRow label={t('raidAction')} hint={t('raidActionHint')}><Select disabled={!data.anti_raid} value={data.raid_action || 'kick'} onValueChange={(v) => set('raid_action', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{[['kick', t('optionKick')], ['ban', t('optionBan')], ['timeout', t('raidTimeoutOption')]].map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select></FieldRow>
            <NumField label={t('raidLockdown')} hint={t('raidLockdownHint')} value={data.raid_lockdown_minutes ?? 10} onChange={(v) => set('raid_lockdown_minutes', v)} disabled={!data.anti_raid} />
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            {[['raid_raise_verification', t('raidRaiseVerification'), t('raidRaiseVerificationHint')], ['raid_alert_staff', t('raidAlertStaff'), t('raidAlertStaffHint')], ['raid_no_avatar', t('raidNoAvatar'), t('raidNoAvatarHint')]].map(([k, label, hint]) => (
              <div key={k} className="flex items-center justify-between gap-3 rounded-lg border border-border/50 px-4 py-3 bg-secondary/20">
                <span className="flex min-w-0 items-center gap-1.5 text-sm">{label}<InfoHint>{hint}</InfoHint></span>
                <Switch disabled={!data.anti_raid} checked={data[k] !== false} onCheckedChange={(v) => set(k, v)} />
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border/50 px-4 py-3 bg-secondary/20">
            <span className="flex min-w-0 items-center gap-1.5 text-sm">{t('imageScam')}<InfoHint>{t('imageScamHint')}</InfoHint></span>
            <Switch checked={data.image_scam === true} onCheckedChange={(v) => set('image_scam', v)} />
          </div>
        </div>
        <Separator />
        <div className="space-y-3">
          <div className="flex items-center gap-1.5"><Label className="mb-0">{t('joinGuards')}</Label><InfoHint>{t('joinGuardsHint')}</InfoHint></div>
          <div className="grid sm:grid-cols-2 gap-4">
            <NumField label={t('minAccountAge')} hint={t('minAccountAgeHint')} value={data.min_account_age_days ?? 0} onChange={(v) => set('min_account_age_days', v)} />
            <NumField label={t('newMemberLinks')} hint={t('newMemberLinksHint')} value={data.new_member_link_minutes ?? 0} onChange={(v) => set('new_member_link_minutes', v)} />
          </div>
        </div>
        <FieldRow label={tMod('modLogChannel')} hint={t('modLogNote', { moderation: tModPage('moderation.title'), logging: tModPage('logging.title') })}><ChannelSelect value={modSettings?.mod_log_channel_id ?? null} onChange={() => {}} channels={meta.channels} disabled /></FieldRow>
        <div><div className="flex items-center gap-1.5 mb-1"><Label className="mb-0">{t('allowedDomains')}</Label><InfoHint>{t('allowedDomainsHint')}</InfoHint></div><TagListTextarea rows={2} value={data.allowed_domains} onChange={(v) => set('allowed_domains', v)} placeholder="example.com, discord.com" disabled={!data.anti_link} /></div>
        <div><div className="flex items-center gap-1.5 mb-1"><Label className="mb-0">{t('exemptRoles')}</Label><InfoHint>{t('exemptRolesHint')}</InfoHint></div><RoleMultiSelect value={data.whitelist_role_ids} onChange={(v) => set('whitelist_role_ids', v)} roles={meta.roles} placeholder={t('noRolesExempted')} /></div>
        <div><Label>{t('badWordsLabel')}</Label><TagListTextarea rows={3} value={data.bad_words} onChange={(v) => set('bad_words', v)} disabled={!data.bad_words_filter} /></div>
        <SaveBar saving={saving} dirty={dirty} onDiscard={discard} onSave={() => save({ ...data, log_channel_id: undefined })} />
      </Card>
    </div>
  );
}

const AUTOMOD_ACTION_MESSAGES = [
  ['warn_message', 'automodWarn'],
  ['timeout_message', 'automodTimeout'],
  ['unmute_message', 'automodUnmute'],
  ['kick_message', 'automodKick'],
  ['ban_message', 'automodBan'],
];

function LoggingPanel({ guildId, meta }) {
  const t = useTranslations('guildSettings.logging');
  const tMod = useTranslations('guildSettings.moderation');
  const { data, setData, save, saving, dirty, discard } = useModule(guildId, 'settings');
  const { data: amData, setData: setAmData, save: saveAm, saving: savingAm, dirty: dirtyAm, discard: discardAm } = useModule(guildId, 'automod');
  if (!data || !amData) return <Skeleton />;
  const savingAny = saving || savingAm;
  return (
    <div className="space-y-6">
      <SectionHeader title={t('title')} description={t('description')} />
      <Card className="p-4 sm:p-6 space-y-5 bg-card/60">
        <FieldRow label={tMod('modLogChannel')} hint={tMod('modLogChannelHint')}>
          <ChannelSelect value={data.mod_log_channel_id} onChange={(v) => setData({ ...data, mod_log_channel_id: v })} channels={meta.channels} />
        </FieldRow>
        <div className="rounded-lg border border-border/60 bg-background/40 p-4 text-sm text-muted-foreground space-y-2">
          <div className="font-medium text-foreground/90">{t('whatGetsPosted')}</div>
          <ul className="space-y-1.5 list-disc list-inside">
            <li><span className="text-foreground/80">{t('eventMessageEdited')}</span> {t('eventMessageEditedDesc')}</li>
            <li><span className="text-foreground/80">{t('eventMessageDeleted')}</span> {t('eventMessageDeletedDesc')}</li>
            <li><span className="text-foreground/80">{t('eventNicknameChanged')}</span> {t('eventNicknameChangedDesc')}</li>
            <li><span className="text-foreground/80">{t('eventMemberJoined')}</span> {t('eventMemberJoinedDesc')}</li>
            <li><span className="text-foreground/80">{t('eventMemberLeft')}</span> {t('eventMemberLeftDesc')}</li>
            <li><span className="text-foreground/80">{t('eventRolesUpdated')}</span> {t('eventRolesUpdatedDesc')}</li>
            <li><span className="text-foreground/80">{t('eventChannels')}</span> {t('eventChannelsDesc')}</li>
          </ul>
          <div className="pt-1">{t('modActionsNote')}</div>
        </div>

        <div className="pt-2 border-t border-border/50">
          <div className="font-semibold">{t('automodMessagesTitle')}</div>
          <p className="text-xs text-muted-foreground mt-1 mb-4">{t('automodMessagesDesc')}</p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {AUTOMOD_ACTION_MESSAGES.map(([field, prefix]) => (
              <div key={field} className="min-w-0">
                <div className="flex items-center gap-1.5 mb-1"><Label className="mb-0">{t(`${prefix}MessageLabel`)}</Label><InfoHint>{t(`${prefix}MessageHint`)}</InfoHint></div>
                <Textarea
                  rows={3}
                  value={amData[field] || ''}
                  onChange={(e) => setAmData({ ...amData, [field]: e.target.value })}
                  placeholder={t(`${prefix}MessagePlaceholder`)}
                  maxLength={1000}
                />
              </div>
            ))}
          </div>
        </div>

        <SaveBar saving={savingAny} dirty={dirty || dirtyAm} onDiscard={() => { discard(); discardAm(); }} onSave={async () => {
          await Promise.all([
            save({ mod_log_channel_id: data.mod_log_channel_id }),
            saveAm({
              warn_message: amData.warn_message || '',
              timeout_message: amData.timeout_message || '',
              unmute_message: amData.unmute_message || '',
              kick_message: amData.kick_message || '',
              ban_message: amData.ban_message || '',
            }),
          ]);
        }} />
      </Card>
    </div>
  );
}


function TicketAccordion({ title, description, icon: Icon, open, onToggle, badge, children }) {
  return <Card className="overflow-hidden border-border/60 bg-card/70">
    <button type="button" onClick={onToggle} className="w-full text-left p-5 flex items-center gap-4 hover:bg-secondary/20 transition-colors">
      <div className="w-11 h-11 rounded-xl border border-border/70 bg-secondary/30 flex items-center justify-center shrink-0"><Icon className="w-5 h-5" /></div>
      <div className="min-w-0 flex-1"><div className="font-semibold text-xl flex items-center gap-2 flex-wrap">{title}{badge}</div><p className="text-sm text-muted-foreground mt-1">{description}</p></div>
      {open ? <ChevronDown className="w-5 h-5 shrink-0" /> : <ChevronRight className="w-5 h-5 shrink-0" />}
    </button>
    {open && <div className="border-t border-border/60 p-5 space-y-5">{children}</div>}
  </Card>;
}
function decimalColorToHex(value) {
  const n = Number(value);
  const safe = Number.isFinite(n) && n >= 0 && n <= 0xffffff ? n : 0xe08a4e;
  return `#${safe.toString(16).padStart(6, '0')}`;
}
function hexColorToDecimal(hex) {
  const n = parseInt(String(hex || '').replace('#', ''), 16);
  return Number.isFinite(n) ? n : 0xe08a4e;
}

const TICKET_VARIABLES = ['username','userid','usermention','useravatar','reason','description','field1','field2','field3','field4','field5','fields','subcategory','tickettype','channel','channelid','guild','guildid','guildicon'];
const MAX_TICKET_TYPES = 10;
function TicketsPanel({ guildId, meta }) {
  const t = useTranslations('guildSettings.tickets');
  const tc = useTranslations('guildSettings.common');
  const [data, setData] = useState(null);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [openSection, setOpenSection] = useState('appearance');
  const [, setWizardStep] = useState(1);
  const ticketErrorLabels = {
    missing_bot_permissions: t('errorLabels.missing_bot_permissions'),
    discord_create_failed: t('errorLabels.discord_create_failed'),
    ticket_record_create_failed: t('errorLabels.ticket_record_create_failed'),
    initial_ticket_message_failed: t('errorLabels.initial_ticket_message_failed'),
    support_role_warning_failed: t('errorLabels.support_role_warning_failed'),
    ticket_details_message_failed: t('errorLabels.ticket_details_message_failed'),
    claim_update_failed: t('errorLabels.claim_update_failed'),
    transcript_build_failed: t('errorLabels.transcript_build_failed'),
    transcript_destination_unavailable: t('errorLabels.transcript_destination_unavailable'),
    transcript_send_forbidden: t('errorLabels.transcript_send_forbidden'),
    transcript_send_failed: t('errorLabels.transcript_send_failed'),
    transcript_dm_fallback_failed: t('errorLabels.transcript_dm_fallback_failed'),
    transcript_fallback_failed: t('errorLabels.transcript_fallback_failed'),
    close_update_failed: t('errorLabels.close_update_failed'),
    channel_delete_forbidden: t('errorLabels.channel_delete_forbidden'),
    channel_delete_failed: t('errorLabels.channel_delete_failed'),
  };

  async function load() {
    const d = await safeJson(`/api/guilds/${guildId}/tickets`, {});
    setData(d);
  }
  useEffect(() => { load(); }, [guildId]);

  function blankPanel() {
    return { version: 2, title: t('defaults.title'), description: t('defaults.description'), channel_id: null, category_id: null, support_role_id: null, transcript_channel_id: null, transcript_default_channel_id: null, panel_color: 0xe08a4e, panel_image_url: '', panel_image_position: 'image', control_staff_role_ids: [], button_style: 1, button_label: t('defaults.buttonLabel'), button_emoji: '🎫', select_placeholder: t('defaults.selectPlaceholder'), footer_text: t('defaults.footerText'), welcome_title: t('defaults.title'), welcome_message: t('defaults.welcomeMessage'), welcome_footer: t('defaults.welcomeFooter'), form: { title: t('defaults.formTitle'), description_label: t('defaults.descriptionLabel'), description_placeholder: t('defaults.descriptionPlaceholder'), links_label: t('defaults.linksLabel'), links_placeholder: t('defaults.linksPlaceholder'), extra_label: t('defaults.extraLabel'), extra_placeholder: t('defaults.extraPlaceholder'), details_title: t('defaults.detailsTitle'), custom_fields: [] }, message_overrides: { welcome_title: '', welcome_message: '', close_title: t('defaults.closeTitle'), close_message: t('defaults.closeMessage'), reopen_message: t('defaults.reopenMessage'), delete_warning: t('defaults.deleteWarning'), transcript_message: t('defaults.transcriptMessage') }, options: [{ id: `new-${Date.now()}`, label: t('defaults.title'), emoji: '🎫', category_id: null, support_role_id: null, transcript_channel_id: null, welcome_title: t('defaults.title'), welcome_message: t('defaults.welcomeMessage'), welcome_image_mode: 'none', welcome_image_url: null }] };
  }

  async function savePanel() {
    if (!editing?.title?.trim()) { toast.error(t('errors.titleRequired'), { description: t('errors.titleRequiredDesc') }); return; }
    if (!editing?.channel_id) { toast.error(t('errors.channelMissing'), { description: t('errors.channelMissingDesc') }); return; }
    if (!editing.options?.length) { toast.error(t('errors.typeRequired'), { description: t('errors.typeRequiredDesc') }); return; }

    const invalidType = editing.options.findIndex((o) => !o.label?.trim());
    if (invalidType !== -1) {
      toast.error(t('errors.typeIncomplete', { index: invalidType + 1 }), { description: t('errors.typeIncompleteDesc') });
      return;
    }
    const invalidImage = editing.options.findIndex((o) => {
      if (o.welcome_image_mode !== 'custom' || !o.welcome_image_url) return false;
      try { const u = new URL(o.welcome_image_url); return !['http:', 'https:'].includes(u.protocol); }
      catch { return true; }
    });
    if (invalidImage !== -1) {
      toast.error(t('errors.invalidImage', { index: invalidImage + 1 }), { description: t('errors.invalidImageDesc') });
      return;
    }

    setSaving(true);
    try {
      const isNew = !editing._id;
      const r = await fetch(`/api/guilds/${guildId}/tickets/panels${isNew ? '' : `/${editing._id}`}`, { method: isNew ? 'POST' : 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        const messages = {
          ticket_panel_not_found: t('errors.panelNotFound'),
          invalid_channel: t('errors.invalidChannel', { field: d.field ? ` (${d.field})` : '' }),
          invalid_category: t('errors.invalidCategory'),
          invalid_role: t('errors.invalidRole'),
          invalid_transcript_channel: t('errors.invalidTranscriptChannel'),
          channel_move_not_supported: t('errors.channelMoveNotSupported'),
          discord_edit_failed: t('errors.discordEditFailed', { detail: d.detail || t('errors.unknownDiscordError') }),
          discord_send_failed: t('errors.discordSendFailed', { detail: d.detail || t('errors.unknownDiscordError') }),
          invalid_options_count: t('errors.invalidOptionsCount'),
          ticket_panel_limit: d.detail || t('errors.panelLimit', { limit: d.limit || 1 }),
        };
        throw new Error(messages[d.error] || d.detail || d.error || t('errors.genericSaveFailed'));
      }
      toast.success(isNew ? t('success.created') : t('success.updated'), { description: t('success.savedDesc') });
      setEditing(null); await load();
    } catch (e) {
      toast.error(t('errors.saveFailedTitle'), { description: e.message || t('errors.saveFailedDefaultDesc') });
    } finally { setSaving(false); }
  }

  async function deletePanel(id) {
    if (!confirm(t('confirmDelete'))) return;
    const r = await fetch(`/api/guilds/${guildId}/tickets/panels/${id}`, { method: 'DELETE' });
    if (!r.ok) { toast.error(t('errors.deleteFailed')); return; }
    toast.success(t('success.deleted')); load();
  }

  function updateOption(index, patch) {
    setEditing((p) => ({ ...p, options: p.options.map((o, i) => i === index ? { ...o, ...patch } : o) }));
  }
  function addOption() {
    if ((editing.options || []).length >= MAX_TICKET_TYPES) return toast.error(t('errors.maxTypes', { max: MAX_TICKET_TYPES }));
    setEditing((p) => ({ ...p, options: [...p.options, { id: `new-${Date.now()}`, label: t('defaults.ticketN', { n: p.options.length + 1 }), emoji: '🎫', category_id: null, support_role_id: null, transcript_channel_id: null, welcome_title: p.title || t('defaults.title'), welcome_message: p.welcome_message || t('defaults.welcomeMessage'), welcome_image_mode: 'none', welcome_image_url: null }] }));
  }

  if (!data) return <Skeleton />;
  const maxPanels = data.max_panels || 1;
  const standardPanels = data.is_premium ? FREE_LIMITS.ticket_panels : maxPanels;
  function openCreate() {
    if ((data.panels?.length || 0) >= maxPanels) {
      toast.error(t('limitReachedTitle'), {
        description: premiumBoostLine(tc, standardPanels, data.is_premium, t('panelsWord')),
      });
      return;
    }
    setWizardStep(1); setEditing(blankPanel());
  }
  if (editing) {
    const isV2 = Number(editing.version || 1) >= 2;
    const toggle = (name) => setOpenSection(openSection === name ? '' : name);
    if (!isV2) return <div className="space-y-6"><SectionHeader title={t('editPanel')} description={t('v2.legacyDescription')} /><Card className="p-6 space-y-4"><div><Label>{t('panelTitleLabel')}</Label><Input value={editing.title || ''} onChange={(e)=>setEditing({...editing,title:e.target.value})}/></div><div><Label>{t('panelDescriptionLabel')}</Label><Textarea value={editing.description || ''} onChange={(e)=>setEditing({...editing,description:e.target.value})}/></div><div><Label>{t('panelChannelLabel')}</Label><ChannelSelect value={editing.channel_id} onChange={(v)=>setEditing({...editing,channel_id:v})} channels={meta.channels}/></div><div className="flex justify-end gap-2"><Button variant="outline" onClick={()=>setEditing(null)}>{t('cancel')}</Button><Button onClick={savePanel} disabled={saving}>{saving?t('v2.saving'):t('savePanel')}</Button></div></Card></div>;
    return <div className="space-y-5 max-w-6xl">
      <SectionHeader title={editing._id ? t('editPanel') : t('createPanel')} description={t('v2.builderDescription')} />
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-5 items-start">
        <div className="space-y-4">
          <TicketAccordion title={t('v2.appearance.title')} description={t('v2.appearance.description')} icon={Palette} open={openSection==='appearance'} onToggle={()=>toggle('appearance')}>
            <div className="grid md:grid-cols-2 gap-4"><div><Label>{t('panelTitleLabel')}</Label><Input value={editing.title||''} onChange={e=>setEditing({...editing,title:e.target.value})}/></div><div><Label>{t('v2.channel')}</Label><ChannelSelect value={editing.channel_id} onChange={v=>setEditing({...editing,channel_id:v})} channels={meta.channels}/></div></div>
            <div><Label>{t('panelDescriptionLabel')}</Label><Textarea rows={4} value={editing.description||''} onChange={e=>setEditing({...editing,description:e.target.value})}/></div>
            <div className="grid md:grid-cols-4 gap-4"><div><Label>{t('v2.embedColor')}</Label><div className="flex gap-2"><Input type="color" className="w-14 p-1 h-10" value={decimalColorToHex(editing.panel_color)} onChange={e=>setEditing({...editing,panel_color:hexColorToDecimal(e.target.value)})}/><Input value={decimalColorToHex(editing.panel_color)} onChange={e=>{ if(/^#[0-9a-fA-F]{6}$/.test(e.target.value)) setEditing({...editing,panel_color:hexColorToDecimal(e.target.value)}); }} placeholder="#e08a4e"/></div></div><div><Label>{t('v2.buttonStyle')}</Label><Select value={String(editing.button_style||1)} onValueChange={v=>setEditing({...editing,button_style:Number(v)})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="1">{t('v2.colors.blue')}</SelectItem><SelectItem value="2">{t('v2.colors.grey')}</SelectItem><SelectItem value="3">{t('v2.colors.green')}</SelectItem><SelectItem value="4">{t('v2.colors.red')}</SelectItem></SelectContent></Select></div><div><Label>{t('v2.buttonLabel')}</Label><Input value={editing.button_label||''} onChange={e=>setEditing({...editing,button_label:e.target.value})}/></div><div><Label>{t('buttonEmoji')}</Label><Input value={editing.button_emoji||''} onChange={e=>setEditing({...editing,button_emoji:e.target.value})}/></div></div>
            <div className="grid md:grid-cols-2 gap-4"><div><div className="flex items-center gap-1.5 mb-1"><Label className="mb-0">{t('v2.panelImageUrl')}</Label><InfoHint>{t('v2.panelImageUrlHint')}</InfoHint></div><Input value={editing.panel_image_url||''} onChange={e=>setEditing({...editing,panel_image_url:e.target.value})} placeholder="https://..."/></div><div><Label>{t('v2.imagePosition')}</Label><Select value={editing.panel_image_position||'image'} onValueChange={v=>setEditing({...editing,panel_image_position:v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="thumbnail">{t('v2.imagePositions.smallTop')}</SelectItem><SelectItem value="image">{t('v2.imagePositions.largeBottom')}</SelectItem></SelectContent></Select></div></div>
          </TicketAccordion>
          <TicketAccordion title={t('v2.settings.title')} description={t('v2.settings.description')} icon={Settings2} open={openSection==='settings'} onToggle={()=>toggle('settings')}>
            <div><div className="flex items-center gap-1.5 mb-1"><Label className="mb-0">{t('v2.staffRoles')}</Label><InfoHint>{t('v2.staffRolesHint')}</InfoHint></div><RoleMultiSelect value={editing.control_staff_role_ids||[]} onChange={v=>setEditing({...editing,control_staff_role_ids:v})} roles={meta.roles}/></div>
            <div className="grid md:grid-cols-3 gap-4"><div><Label>{t('panelFooter')}</Label><Input value={editing.footer_text||''} onChange={e=>setEditing({...editing,footer_text:e.target.value})}/></div><div><Label>{t('v2.ticketFooter')}</Label><Input value={editing.welcome_footer||''} onChange={e=>setEditing({...editing,welcome_footer:e.target.value})}/></div><div><div className="flex items-center gap-1.5 mb-1"><Label className="mb-0">{t('defaultTranscriptChannel')}</Label><InfoHint>{t('defaultTranscriptChannelHint')}</InfoHint></div><ChannelSelect value={editing.transcript_default_channel_id} onChange={v=>setEditing({...editing,transcript_default_channel_id:v})} channels={meta.channels} noneLabel={t('serverModLogFallback')}/></div></div>
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm">{t('v2.lifecycleHint')}</div>
          </TicketAccordion>
          <TicketAccordion title={t('v2.routing.title')} description={t('v2.routing.description')} icon={Route} open={openSection==='routing'} onToggle={()=>toggle('routing')} badge={<Badge variant="secondary">{t('v2.typesCount', { count: editing.options?.length||0 })}</Badge>}>
            <div className="flex justify-between items-center"><div className="font-medium">{t('v2.ticketCategories')}</div><Button size="sm" type="button" variant="outline" disabled={(editing.options||[]).length>=MAX_TICKET_TYPES} onClick={addOption}><Plus className="w-4 h-4 mr-1"/>{t('addType')} ({(editing.options||[]).length}/{MAX_TICKET_TYPES})</Button></div>
            <div className="space-y-4">{(editing.options||[]).map((o,idx)=><Card key={o.id||idx} className="p-4 bg-secondary/10"><div className="flex justify-between gap-2 mb-4"><Badge variant="secondary">{t('typeLabel', { index: idx + 1 })}</Badge>{editing.options.length>1&&<Button size="sm" variant="ghost" onClick={()=>setEditing({...editing,options:editing.options.filter((_,i)=>i!==idx)})}><Trash2 className="w-4 h-4"/></Button>}</div><div className="grid md:grid-cols-2 gap-4"><div><Label>{t('name')}</Label><Input value={o.label||''} onChange={e=>updateOption(idx,{label:e.target.value})}/></div><div><Label>{t('emoji')}</Label><Input value={o.emoji||''} onChange={e=>updateOption(idx,{emoji:e.target.value})}/></div><div><div className="flex items-center gap-1.5 mb-1"><Label className="mb-0">{t('ticketCategory')}</Label><InfoHint>{t('v2.ticketCategoryHint')}</InfoHint></div><ChannelSelect value={o.category_id} onChange={v=>updateOption(idx,{category_id:v})} channels={meta.channels} types={[4]} placeholder={t('v2.selectACategory')}/></div><div><div className="flex items-center gap-1.5 mb-1"><Label className="mb-0">{t('supportRole')}</Label><InfoHint>{t('supportRoleHint')}</InfoHint></div><RoleSelect value={o.support_role_id} onChange={v=>updateOption(idx,{support_role_id:v})} roles={meta.roles}/></div><div><div className="flex items-center gap-1.5 mb-1"><Label className="mb-0">{t('transcriptChannel')}</Label><InfoHint>{t('transcriptChannelHint')}</InfoHint></div><ChannelSelect value={o.transcript_channel_id} onChange={v=>updateOption(idx,{transcript_channel_id:v})} channels={meta.channels} noneLabel={t('useDefaultTranscriptChannel')}/></div><div><div className="flex items-center gap-1.5 mb-1"><Label className="mb-0">{t('v2.ticketImageUrl')}</Label><InfoHint>{t('v2.ticketImageUrlHint')}</InfoHint></div><Input value={o.welcome_image_url||''} onChange={e=>updateOption(idx,{welcome_image_url:e.target.value,welcome_image_mode:e.target.value?'custom':'none'})} placeholder="https://..."/></div><div><Label>{t('v2.imagePosition')}</Label><Select value={o.welcome_image_position||'image'} onValueChange={v=>updateOption(idx,{welcome_image_position:v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="thumbnail">{t('v2.imagePositions.smallTop')}</SelectItem><SelectItem value="image">{t('v2.imagePositions.largeBottom')}</SelectItem></SelectContent></Select></div></div></Card>)}</div>
          </TicketAccordion>
          <TicketAccordion title={t('v2.form.title')} description={t('v2.form.description')} icon={FileText} open={openSection==='form'} onToggle={()=>toggle('form')}>
            <div className="grid md:grid-cols-2 gap-4"><div><Label>{t('formTitle')}</Label><Input value={editing.form?.title||''} onChange={e=>setEditing({...editing,form:{...editing.form,title:e.target.value}})}/></div><div><Label>{t('detailsEmbedTitle')}</Label><Input value={editing.form?.details_title||''} onChange={e=>setEditing({...editing,form:{...editing.form,details_title:e.target.value}})}/></div><div><Label>{t('problemFieldLabel')}</Label><Input value={editing.form?.description_label||''} onChange={e=>setEditing({...editing,form:{...editing.form,description_label:e.target.value}})}/></div><div><Label>{t('problemPlaceholder')}</Label><Input value={editing.form?.description_placeholder||''} onChange={e=>setEditing({...editing,form:{...editing.form,description_placeholder:e.target.value}})}/></div><div><Label>{t('linksFieldLabel')}</Label><Input value={editing.form?.links_label||''} onChange={e=>setEditing({...editing,form:{...editing.form,links_label:e.target.value}})}/></div><div><Label>{t('extraInfoLabel')}</Label><Input value={editing.form?.extra_label||''} onChange={e=>setEditing({...editing,form:{...editing.form,extra_label:e.target.value}})}/></div></div>
            <div className="space-y-3"><div className="flex justify-between"><div className="font-medium">{t('v2.customFields')}</div><Button size="sm" variant="outline" disabled={(editing.form?.custom_fields||[]).length>=2} onClick={()=>setEditing({...editing,form:{...editing.form,custom_fields:[...(editing.form?.custom_fields||[]),{label:t('v2.newField'),placeholder:t('v2.enterAnswer'),required:false,style:'short'}]}})}><Plus className="w-4 h-4 mr-1"/>{t('v2.addField')}</Button></div>{(editing.form?.custom_fields||[]).map((f,i)=><div key={i} className="grid md:grid-cols-4 gap-3 rounded-xl border p-3"><Input value={f.label||''} placeholder={t('v2.label')} onChange={e=>{const a=[...(editing.form?.custom_fields||[])];a[i]={...a[i],label:e.target.value};setEditing({...editing,form:{...editing.form,custom_fields:a}})}}/><Input value={f.placeholder||''} placeholder={t('v2.placeholder')} onChange={e=>{const a=[...(editing.form?.custom_fields||[])];a[i]={...a[i],placeholder:e.target.value};setEditing({...editing,form:{...editing.form,custom_fields:a}})}}/><Select value={f.style||'short'} onValueChange={v=>{const a=[...(editing.form?.custom_fields||[])];a[i]={...a[i],style:v};setEditing({...editing,form:{...editing.form,custom_fields:a}})}}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="short">{t('v2.shortAnswer')}</SelectItem><SelectItem value="paragraph">{t('v2.longAnswer')}</SelectItem></SelectContent></Select><div className="flex items-center gap-2"><input type="checkbox" checked={!!f.required} onChange={e=>{const a=[...(editing.form?.custom_fields||[])];a[i]={...a[i],required:e.target.checked};setEditing({...editing,form:{...editing.form,custom_fields:a}})}}/><span className="text-xs">{t('v2.required')}</span></div><Input type="number" min={1} max={1000} value={f.max_length??500} onChange={e=>{const a=[...(editing.form?.custom_fields||[])];a[i]={...a[i],max_length:e.target.value===''?'':Math.min(1000,Math.max(0,Math.floor(Number(e.target.value)||0)))};setEditing({...editing,form:{...editing.form,custom_fields:a}})}} onBlur={()=>{const a=[...(editing.form?.custom_fields||[])];if(!a[i]||a[i].max_length>=1)return;a[i]={...a[i],max_length:a[i].max_length===''?500:1};setEditing({...editing,form:{...editing.form,custom_fields:a}})}}/><Button size="sm" variant="ghost" onClick={()=>{const a=[...(editing.form?.custom_fields||[])];a.splice(i,1);setEditing({...editing,form:{...editing.form,custom_fields:a}})}}><Trash2 className="w-4 h-4"/></Button></div>)}</div>
          </TicketAccordion>
          <TicketAccordion title={t('v2.messages.title')} description={t('v2.messages.description')} icon={MessageSquareText} open={openSection==='messages'} onToggle={()=>toggle('messages')}>
            {['close_title','close_message','reopen_message','delete_warning','transcript_message'].map(key=><div key={key}><Label>{t(`v2.messageFields.${key}`)}</Label>{key.includes('message')||key==='delete_warning'?<Textarea rows={3} value={editing.message_overrides?.[key]||''} onChange={e=>setEditing({...editing,message_overrides:{...editing.message_overrides,[key]:e.target.value}})}/>:<Input value={editing.message_overrides?.[key]||''} onChange={e=>setEditing({...editing,message_overrides:{...editing.message_overrides,[key]:e.target.value}})}/>}</div>)}
            <div className="rounded-xl border bg-secondary/20 p-4"><div className="font-semibold mb-3">{t('v2.availableVariables')}</div><div className="grid sm:grid-cols-2 gap-2 text-sm">{TICKET_VARIABLES.map((key)=><div key={key} className="flex gap-2"><code className="text-primary">{`{${key}}`}</code><span className="text-muted-foreground">{t(`v2.variables.${key}`)}</span></div>)}</div></div>
          </TicketAccordion>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={()=>setEditing(null)}>{t('cancel')}</Button><Button onClick={savePanel} disabled={saving} className="gradient-primary">{saving?<Loader2 className="w-4 h-4 mr-2 animate-spin"/>:<Save className="w-4 h-4 mr-2"/>}{saving?t('v2.saving'):t('savePanel')}</Button></div>
        </div>
        <Card className="p-5 xl:sticky xl:top-4 bg-card/80">
          <div className="flex items-center gap-2 font-semibold mb-4"><Eye className="w-4 h-4"/>{t('v2.livePreview')}</div>
          <DiscordMessage>
            <EmbedPreview
              accentColor={decimalColorToHex(editing.panel_color)}
              title={editing.title||'Tickets'}
              description={editing.description||''}
              imageUrl={editing.panel_image_url||null}
              imageAsThumbnail={editing.panel_image_position==='thumbnail'}
              footer={editing.footer_text||''}
              select={(editing.options||[]).length > 1 ? (editing.select_placeholder||'Choose a ticket type…') : null}
              buttons={(editing.options||[]).length > 1 ? [] : [{ label: editing.button_label||'Open ticket', emoji: /^<a?:/.test(String(editing.button_emoji||'')) ? null : (editing.button_emoji||'🎫'), style: ({1:'primary',2:'secondary',3:'success',4:'danger'})[editing.button_style||1] || 'primary' }]}
            />
          </DiscordMessage>
          <Separator className="my-4"/>
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-secondary/20 px-3 py-2"><span className="text-muted-foreground">{t('v2.previewOpen')}</span><span className="font-medium truncate max-w-[60%] text-right">{editing.form?.title||t('defaults.formTitle')}</span></div>
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-secondary/20 px-3 py-2"><span className="text-muted-foreground">{t('v2.previewStaffRoles')}</span><span className="font-medium">{(editing.control_staff_role_ids||[]).length}</span></div>
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-secondary/20 px-3 py-2"><span className="text-muted-foreground">{t('v2.previewDelete')}</span><span className="font-medium">{t('v2.cancelWindow')}</span></div>
          </div>
        </Card>
      </div>
    </div>;
  }

  return (
    <div className="space-y-6">
      <SectionHeader title={t('title')} />
      <LimitPlanNotice isPremium={data.is_premium} t={tc} />
      <div className="flex justify-start"><Button onClick={openCreate} className="gradient-primary"><Plus className="w-4 h-4 mr-2" />{t('createPanel')}</Button></div>
      <Card className="p-6 bg-card/60">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <div className="font-semibold">{t('configuredPanels')}</div>
            <p className="text-xs text-muted-foreground mt-1">{tc('premiumUnlimitedNote')}</p>
          </div>
          <Badge variant="secondary">{data.panels?.length || 0} / {isUnlimited(maxPanels) ? '∞' : maxPanels}</Badge>
        </div>
        <div className="mb-5"><ProgressBar value={data.panels?.length || 0} max={maxPanels} label={t('activePanels')} note={(data.panels?.length || 0) >= maxPanels ? (data.is_premium ? t('panelLimitReached') : t('panelLimitReachedFree', { clause: premiumBoostClause(tc, standardPanels, t('panelsWord')) })) : t('panelSlotsAvailable')} /></div>
        {!data.panels?.length ? <Empty title={t('noPanelsTitle')} text={t('noPanelsText')} action={<Button onClick={openCreate} className="gradient-primary"><Plus className="w-4 h-4 mr-2" />{t('createPanelBtn')}</Button>} /> : <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 min-w-0">
          {data.panels.map((p) => <div key={p._id} className="rounded-xl border border-border/50 p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3"><div><div className="font-semibold flex items-center gap-2">{p.title}<Badge variant="secondary">{Number(p.version || 1) >= 2 ? t('v2.newVersion') : t('v2.legacy')}</Badge></div><div className="text-xs text-muted-foreground mt-1">{channelName(meta, p.channel_id) || t('unknown')} · {t('ticketTypeCount', { count: (p.options || []).length, plural: (p.options || []).length === 1 ? '' : 's' })}</div></div><div className="flex gap-1"><Button size="sm" variant="outline" onClick={() => { setWizardStep(1); setEditing({ ...p, transcript_default_channel_id: panelDefaultTranscriptId(p), form: { ...(p.form || {}) } }); }}>{t('edit')}</Button><Button size="icon" variant="ghost" onClick={() => deletePanel(p._id)}><Trash2 className="w-4 h-4 text-destructive" /></Button></div></div>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{p.description}</p>
            <div className="text-xs text-muted-foreground">{t('support')}: {roleName(meta, p.support_role_id) || roleName(meta, p.options?.[0]?.support_role_id) || t('none')} · {t('transcriptChannel')}: {channelName(meta, panelDefaultTranscriptId(p)) || ((p.options || []).some((o) => o.transcript_channel_id) ? t('transcriptPerType') : t('serverModLogFallback'))}</div>
            <div className="flex flex-wrap gap-2">{(p.options || []).map((o) => <Badge key={o.id} variant="secondary">{o.emoji || '🎫'} {o.label}</Badge>)}</div>
          </div>)}
        </div>}
      </Card>
      <Card className="p-6 bg-card/60">
        <div className="flex items-start justify-between gap-4 mb-4"><div><div className="font-semibold flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-500" />{t('errorCenter')}</div><p className="text-xs text-muted-foreground mt-1">{t('errorCenterHint')}</p></div><Badge variant="secondary">{data.errors?.length || 0}</Badge></div>
        {!data.errors?.length ? <div className="rounded-xl border border-dashed border-border/70 bg-secondary/10 p-5"><div className="font-medium text-sm">{t('noRecentErrors')}</div><p className="text-xs text-muted-foreground mt-1">{t('noRecentErrorsText')}</p></div> : <div className="space-y-2">{data.errors.slice(0, 8).map((e) => <div key={e._id} className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4"><div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1"><div className="flex items-center gap-2 min-w-0"><AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" /><span className="font-medium text-sm break-words">{ticketErrorLabels[e.code] || e.code || t('ticketError')}</span></div><span className="text-[11px] text-muted-foreground shrink-0">{e.created_at ? new Date(e.created_at).toLocaleString() : ''}</span></div><p className="text-xs text-muted-foreground mt-2 whitespace-pre-wrap">{e.detail || t('noAdditionalDetails')}</p></div>)}</div>}
      </Card>
      <Card className="p-6 bg-card/60">
        <div className="flex items-center justify-between mb-3"><div className="font-semibold">{t('openTicketsCount', { count: data.open_tickets?.length || 0 })}</div></div>
        {!data.open_tickets?.length ? <Empty title={t('noOpenTickets')} text={t('noOpenTicketsText')} /> : <div className="space-y-2">{data.open_tickets.map((tk) => <div key={tk._id} className="rounded-lg border border-border/50 p-3 text-sm">{t('channelLabel', { channel: channelName(meta, tk.channel_id) || t('unknown'), user: tk.user_name || t('unknownUser'), ticket: tk.option_label || t('ticketFallback') })}</div>)}</div>}
      </Card>
      <Card className="p-6 bg-card/60">
        <div className="flex items-center justify-between mb-3"><div className="font-semibold">{t('reviewsCount', { count: data.review_total || 0 })}</div>{data.review_total > 0 && <div className="flex items-center gap-1 text-sm text-muted-foreground"><Star className="w-4 h-4 fill-current text-yellow-500" />{Number(data.review_avg || 0).toFixed(1)} / 5</div>}</div>
        {!data.reviews?.length ? <Empty title={t('noReviewsTitle')} text={t('noReviewsText')} /> : <div className={`space-y-2 ${data.reviews.length > 20 ? 'max-h-[70vh] overflow-y-auto pr-1' : ''}`}>{data.reviews.map((r) => <div key={r._id} className="rounded-lg border border-border/50 p-3 text-sm"><div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1"><span className="shrink-0">{'⭐'.repeat(r.rating || 0)}</span><span className="text-xs text-muted-foreground">{r.user_name || t('userFallback', { id: r.user_id })} · {r.option_label || t('ticketFallback')}</span></div>{r.comment && <p className="text-muted-foreground mt-1">{r.comment}</p>}</div>)}</div>}
      </Card>
    </div>
  );
}

function ReactionRolesPanel({ guildId, meta }) {
  const t = useTranslations('guildSettings.reactionRoles');
  const tc = useTranslations('guildSettings.common');
  const [rrs, setRrs] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [mode, setMode] = useState('toggle');
  const [variant, setVariant] = useState('emoji');
  const [channelId, setChannelId] = useState(null);
  const [pairs, setPairs] = useState([{ emoji: '', role_id: null, label: '' }]);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [limit, setLimit] = useState(1);
  const [isPremium, setIsPremium] = useState(false);

  async function load() {
    const d = await safeJson(`/api/guilds/${guildId}/reaction_roles`, {});
    setRrs(d.items || []);
    setCooldown(Number(d.cooldown_seconds || 0));
    setLimit(Number(d.limit || 1));
    setIsPremium(Boolean(d.is_premium));
  }
  useEffect(() => { load(); }, [guildId]);
  useEffect(() => {
    if (!cooldown) return;
    const timer = setInterval(() => setCooldown((v) => Math.max(0, v - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  function updatePair(i, patch) {
    setPairs((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  }

  function addPair() {
    if (variant === 'button' && pairs.length >= 10) return;
    setPairs((prev) => [...prev, { emoji: '', role_id: null, label: '' }]);
  }

  function removePair(i) {
    setPairs((prev) => prev.filter((_, idx) => idx !== i));
  }

  function changeVariant(next) {
    setVariant(next);
    setPairs([{ emoji: '', role_id: null, label: '' }]);
  }

  async function create() {
    if (!channelId) { toast.error(t('chooseChannelError')); return; }
    if (!title.trim()) { toast.error(t('titleRequiredError')); return; }
    if (rrs.length >= limit) {
      const standardRR = isPremium ? FREE_LIMITS.reaction_panels : limit;
      toast.error(t('limitReachedTitle'), {
        description: premiumBoostLine(tc, standardRR, isPremium, t('panelsWord')),
      });
      return;
    }

    const entries = pairs
      .map((p) => ({
        emoji: String(p.emoji || '').trim(),
        role_id: p.role_id ? String(p.role_id) : null,
        label: String(p.label || '').trim(),
      }))
      .filter((p) => variant === 'emoji' ? (p.emoji && p.role_id) : (p.emoji || p.label));

    if (entries.length === 0) {
      toast.error(variant === 'emoji' ? t('addEmojiRoleError') : t('addButtonError'));
      return;
    }
    if (variant === 'button' && entries.length > 10) {
      toast.error(t('buttonLimitError'));
      return;
    }

    setBusy(true);
    const r = await fetch(`/api/guilds/${guildId}/reaction_roles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description, mode, type: variant, channel_id: channelId, entries }),
    });
    setBusy(false);

    if (r.ok) {
      setTitle('');
      setDescription('');
      setPairs([{ emoji: '', role_id: null, label: '' }]);
      toast.success(variant === 'button' ? t('buttonPostedSuccess') : t('panelPostedSuccess'));
      load();
    } else {
      const d = await r.json().catch(() => ({}));
      if (r.status === 429 && d.error === 'reaction_cooldown') {
        setCooldown(Number(d.retry_after || 600));
      }
      if (r.status === 429 && d.error === 'reaction_limit' && d.limit) {
        setLimit(Number(d.limit));
        setIsPremium(Boolean(d.is_premium));
      }
      toast.error(t('postFailed'), { description: d.detail || d.error || t('tryAgain') });
    }
  }

  async function del(id) {
    if (!confirm(t('deleteConfirm'))) return;
    const r = await fetch(`/api/guilds/${guildId}/reaction_roles/${id}`, { method: 'DELETE' });
    if (r.ok) { toast.success(t('deletedSuccess')); load(); }
    else toast.error(t('deleteFailed'));
  }

  if (!rrs) return <Skeleton />;

  const roleName = (id) => { const r = (meta.roles || []).find((x) => String(x.id) === String(id)); return r ? `@${r.name}` : '@role'; };
  const previewText = [
    description.trim(),
    variant === 'emoji' ? pairs.filter((p) => p.emoji && p.role_id).map((p) => `${p.emoji} → ${roleName(p.role_id)}`).join('\n') : '',
  ].filter(Boolean).join('\n\n');

  return (
    <div className="space-y-6">
      <SectionHeader title={t('title')} />
      <LimitPlanNotice isPremium={isPremium} t={tc} />

      <div className="grid sm:grid-cols-3 gap-3">
        <Card className="p-4 bg-card/60">
          <div className="text-xs text-muted-foreground uppercase tracking-wide">{t('serverLimit')}</div>
          <div className="text-2xl font-bold mt-1">{rrs.length}/{isUnlimited(limit) ? '∞' : limit}</div>
          <div className="text-xs text-muted-foreground mt-1">{tc('premiumUnlimitedNote')}</div>
        </Card>
        <Card className="p-4 bg-card/60">
          <div className="text-xs text-muted-foreground uppercase tracking-wide">{t('cooldown')}</div>
          <div className="text-2xl font-bold mt-1">{cooldown ? t('minutesShort', { m: Math.ceil(cooldown / 60) }) : t('ready')}</div>
          <div className="text-xs text-muted-foreground mt-1">{t('cooldownHint')}</div>
        </Card>
        <Card className="p-4 bg-card/60">
          <div className="text-xs text-muted-foreground uppercase tracking-wide">{t('security')}</div>
          <div className="text-2xl font-bold mt-1">{t('serverSecured')}</div>
          <div className="text-xs text-muted-foreground mt-1">{t('securityHint')}</div>
        </Card>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
      <Card className="p-6 space-y-5 bg-card/60">
        <div>
          <Label>{t('titleLabel')}</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('titlePlaceholder')} />
        </div>

        <div>
          <Label>{t('channelLabel')}</Label>
          <ChannelSelect value={channelId} onChange={setChannelId} channels={meta.channels} includeNone={false} placeholder={t('channelPlaceholder')} />
        </div>

        <div>
          <Label>{t('descriptionLabel')}</Label>
          <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('descriptionPlaceholder')} />
        </div>

        <div>
          <FieldRow label={t('typeLabel')} hint={t('typeHint')}>
            <Select value={variant} onValueChange={changeVariant}>
              <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="emoji">{t('typeEmoji')}</SelectItem>
                <SelectItem value="button">{t('typeButton')}</SelectItem>
              </SelectContent>
            </Select>
          </FieldRow>
        </div>

        <div>
          <FieldRow label={t('modeLabel')} hint={t('modeHint')}>
            <Select value={mode} onValueChange={setMode}>
              <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">{t('modeNormal')}</SelectItem>
                <SelectItem value="toggle">{t('modeToggle')}</SelectItem>
                <SelectItem value="unique">{t('modeUnique')}</SelectItem>
                <SelectItem value="verify">{t('modeVerify')}</SelectItem>
              </SelectContent>
            </Select>
          </FieldRow>
        </div>

        {mode === 'verify' && (
          <p className="text-xs text-muted-foreground rounded-lg border border-border/50 bg-secondary/20 px-3 py-2">
            {t('legacyVerifyHint')}
          </p>
        )}

        {variant === 'emoji' ? (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5"><Label className="mb-0">{t('emojiRolePairs')}</Label><InfoHint>{t.rich('customEmojiHint', { code: (chunks) => chunks })}</InfoHint></div>
            {pairs.map((p, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  className="w-24"
                  value={p.emoji}
                  onChange={(e) => updatePair(i, { emoji: e.target.value })}
                  placeholder={t('emojiPlaceholder')}
                />
                <div className="flex-1">
                  <RoleSelect value={p.role_id} onChange={(v) => updatePair(i, { role_id: v })} roles={meta.roles} includeNone={false} />
                </div>
                <Button size="icon" variant="ghost" onClick={() => removePair(i)} disabled={pairs.length === 1}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addPair}>
              <Plus className="w-4 h-4 mr-1" /> {t('addPair')}
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5"><Label className="mb-0">{t('buttonsLabel')}</Label><InfoHint>{t('buttonHint')}</InfoHint></div>
              <span className="text-xs text-muted-foreground">{pairs.length}/10</span>
            </div>

            {pairs.map((p, i) => (
              <div key={i} className="rounded-lg border border-border/50 p-3 space-y-2">
                <div className="grid sm:grid-cols-[1fr_1fr_auto] gap-2 items-end">
                  <div>
                    <Label>{t('buttonText')}</Label>
                    <Input
                      value={p.label}
                      onChange={(e) => updatePair(i, { label: e.target.value.slice(0, 80) })}
                      placeholder={t('buttonTextPlaceholder')}
                    />
                  </div>
                  <div>
                    <Label>{t('buttonEmojiOptional')}</Label>
                    <Input
                      value={p.emoji}
                      onChange={(e) => updatePair(i, { emoji: e.target.value })}
                      placeholder={t('emojiPlaceholder')}
                    />
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => removePair(i)} disabled={pairs.length === 1}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
                <div>
                  <Label>{t('buttonRoleOptional')}</Label>
                  <RoleSelect value={p.role_id} onChange={(v) => updatePair(i, { role_id: v })} roles={meta.roles} includeNone />
                </div>
              </div>
            ))}

            <Button variant="outline" size="sm" onClick={addPair} disabled={pairs.length >= 10}>
              <Plus className="w-4 h-4 mr-1" /> {t('addButton')}
            </Button>
          </div>
        )}

        <Button className="gradient-primary" onClick={create} disabled={busy || rrs.length >= 3 || cooldown > 0}>
          {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
          {rrs.length >= 3 ? t('serverLimitReached') : cooldown > 0 ? t('waitMinutes', { m: Math.ceil(cooldown / 60) }) : t('postPanel')}
        </Button>
      </Card>

      <div className="xl:sticky xl:top-24" data-rr-preview>
        <DiscordMessagePreview
          label={t('previewTitle')}
          embed={{ color: '#e08a4e', title: title.trim() || t('previewDefaultTitle'), description: previewText }}
          buttons={variant === 'button' ? pairs.filter((p) => p.emoji || p.label).map((p) => ({ label: p.label, emoji: p.emoji, style: 'primary' })) : []}
        />
        {variant === 'emoji' && pairs.some((p) => p.emoji && p.role_id) ? (
          <div className="mt-3">
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t('previewReactions')}</div>
            <div className="flex flex-wrap gap-1.5">
              {pairs.filter((p) => p.emoji && p.role_id).map((p, i) => <span key={i} className="inline-flex h-7 min-w-[2.25rem] items-center justify-center rounded-lg border border-[#5865f2]/60 bg-[#5865f2]/20 px-2 text-sm">{p.emoji}</span>)}
            </div>
          </div>
        ) : null}
        <p className="mt-3 text-xs text-muted-foreground">{t('previewHint', { mode: t(`mode${mode.charAt(0).toUpperCase()}${mode.slice(1)}`) })}</p>
      </div>
      </div>

      <Card className="p-6 bg-card/60">
        {rrs.length === 0 ? <Empty text={t('emptyPanels')} /> : (
          <div className="space-y-2">
            {rrs.map((r) => (
              <div key={r._id} className="rounded-lg border border-border/50 p-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{r.type === 'button' ? t('typeButton') : t('typeEmoji')}</Badge>
                    <Badge variant="outline">{r.mode}</Badge>
                    <span className="text-sm">{t('messageLabel', { id: r.message_id })}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {r.entries?.map((e, i) => (
                      <span key={i} className="text-xs rounded-full bg-secondary/60 px-2 py-1">
                        {r.type === 'button' ? (e.emoji || '') + (e.label ? ` ${e.label}` : '') : e.emoji}
                        {e.role_id ? ` → ${roleName(meta, e.role_id)}` : ''}
                      </span>
                    ))}
                  </div>
                </div>
                <Button size="icon" variant="ghost" onClick={() => del(r._id)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function AutoResponsesPanel({ guildId, meta }) {
  const t = useTranslations('guildSettings.autoResponses');
  const tc = useTranslations('guildSettings.common');
  const [items, setItems] = useState(null);
  const [trigger, setTrigger] = useState('');
  const [response, setResponse] = useState('');
  const [exact, setExact] = useState(false);
  const [wildcard, setWildcard] = useState(false);
  const [allowedChannels, setAllowedChannels] = useState([]);
  const [ignoredChannels, setIgnoredChannels] = useState([]);
  const [allowedRoles, setAllowedRoles] = useState([]);
  const [ignoredRoles, setIgnoredRoles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [limit, setLimit] = useState(1);
  const [isPremium, setIsPremium] = useState(false);
  async function load() {
    const d = await safeJson(`/api/guilds/${guildId}/auto_responses`, {});
    setItems(d.items || []);
    setLimit(Number(d.limit || 5));
    setIsPremium(Boolean(d.is_premium));
  }
  useEffect(() => { load(); }, [guildId]);
  function resetForm() {
    setTrigger(''); setResponse(''); setExact(false); setWildcard(false);
    setAllowedChannels([]); setIgnoredChannels([]); setAllowedRoles([]); setIgnoredRoles([]);
  }
  async function add() {
    if (!trigger.trim() || !response.trim()) { toast.error(t('triggerResponseRequired')); return; }
    if ((items?.length || 0) >= limit) {
      const standardAR = isPremium ? FREE_LIMITS.auto_responses : limit;
      toast.error(t('limitReachedTitle'), {
        description: premiumBoostLine(tc, standardAR, isPremium, t('responsesWord')),
      });
      return;
    }
    setBusy(true);
    const r = await fetch(`/api/guilds/${guildId}/auto_responses`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        trigger, response, exact_match: exact, wildcard,
        allowed_channel_ids: allowedChannels, ignored_channel_ids: ignoredChannels,
        allowed_role_ids: allowedRoles, ignored_role_ids: ignoredRoles,
      }),
    });
    setBusy(false);
    if (r.ok) { resetForm(); toast.success(t('addedSuccess')); load(); }
    else {
      const d = await r.json().catch(() => ({}));
      if (r.status === 429 && d.error === 'auto_response_limit' && d.limit) {
        setLimit(Number(d.limit));
        setIsPremium(Boolean(d.is_premium));
      }
      toast.error(t('addFailed'), { description: d.detail || d.error || t('tryAgain') });
    }
  }
  async function del(id) {
    if (!confirm(t('deleteConfirm'))) return;
    const r = await fetch(`/api/guilds/${guildId}/auto_responses/${id}`, { method: 'DELETE' });
    if (r.ok) { toast.success(t('deletedSuccess')); load(); }
    else toast.error(t('deleteFailed'));
  }
  if (!items) return <Skeleton />;
  const atLimit = items.length >= limit;
  return (
    <div className="space-y-6">
      <SectionHeader title={t('title')} />
      <LimitPlanNotice isPremium={isPremium} t={tc} />
      <Card className="p-6 bg-card/60">
        <div className="flex items-center justify-between gap-4 mb-1">
          <div>
            <div className="font-semibold">{t('configuredHeading')}</div>
            <p className="text-xs text-muted-foreground mt-1">{tc('premiumUnlimitedNote')}</p>
          </div>
          <Badge variant="secondary">{items.length} / {isUnlimited(limit) ? '∞' : limit}</Badge>
        </div>
        <div className="mt-4"><ProgressBar value={items.length} max={limit} label={t('usedLabel')} note={atLimit ? (isPremium ? t('limitReachedPremium') : t('limitReachedFree', { clause: premiumBoostClause(tc, (isPremium ? FREE_LIMITS.auto_responses : limit), t('responsesWord')) })) : t('slotsAvailable')} /></div>
      </Card>
      <Card className="p-6 space-y-4 bg-card/60">
        <div>
          <Label>{t('triggerLabel')}</Label>
          <Input value={trigger} onChange={(e) => setTrigger(e.target.value)} placeholder={t('triggerPlaceholder')} disabled={atLimit} />
        </div>
        <div>
          <div className="flex items-center gap-1.5 mb-1"><Label className="mb-0">{t('responseLabel')}</Label><InfoHint>{t('variablesHint')}</InfoHint></div>
          <Input value={response} onChange={(e) => setResponse(e.target.value)} placeholder={t('responsePlaceholder')} disabled={atLimit} />
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <div className="flex items-center gap-2">
            <Switch checked={exact} onCheckedChange={setExact} disabled={atLimit} /> <span className="text-sm">{t('exactMatch')}</span>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={wildcard} onCheckedChange={setWildcard} disabled={atLimit} />
            <span className="flex items-center gap-1.5 text-sm">{t('wildcardLabel')}<InfoHint>{t('wildcardHint')}</InfoHint></span>
          </div>
        </div>
        <div>
          <div className="flex items-center gap-1.5 mb-1"><Label className="mb-0">{t('allowedChannelsLabel')}</Label><InfoHint>{t('allowedChannelsHint')}</InfoHint></div>
          <ChannelMultiSelect value={allowedChannels} onChange={setAllowedChannels} channels={meta?.channels} disabled={atLimit} placeholder={tc('noChannelsSelected')} />
        </div>
        <div>
          <div className="flex items-center gap-1.5 mb-1"><Label className="mb-0">{t('ignoredChannelsLabel')}</Label><InfoHint>{t('ignoredChannelsHint')}</InfoHint></div>
          <ChannelMultiSelect value={ignoredChannels} onChange={setIgnoredChannels} channels={meta?.channels} disabled={atLimit} placeholder={tc('noChannelsSelected')} />
        </div>
        <div>
          <div className="flex items-center gap-1.5 mb-1"><Label className="mb-0">{t('allowedRolesLabel')}</Label><InfoHint>{t('allowedRolesHint')}</InfoHint></div>
          <RoleMultiSelect value={allowedRoles} onChange={setAllowedRoles} roles={meta?.roles} disabled={atLimit} />
        </div>
        <div>
          <div className="flex items-center gap-1.5 mb-1"><Label className="mb-0">{t('ignoredRolesLabel')}</Label><InfoHint>{t('ignoredRolesHint')}</InfoHint></div>
          <RoleMultiSelect value={ignoredRoles} onChange={setIgnoredRoles} roles={meta?.roles} disabled={atLimit} />
        </div>
        <Button className="w-full sm:w-auto sm:ml-auto sm:flex gradient-primary" onClick={add} disabled={busy || atLimit}><Plus className="w-4 h-4 mr-1" /> {t('add')}</Button>
      </Card>
      <Card className="p-6 bg-card/60">
        {items.length === 0 ? <Empty text={t('empty')} /> : (
          <div className="space-y-2">
            {items.map((it) => {
              const tags = [];
              if (it.wildcard) tags.push(t('wildcardLabel'));
              if (it.allowed_channel_ids?.length) tags.push(t('allowedChannelsTag', { count: it.allowed_channel_ids.length }));
              if (it.ignored_channel_ids?.length) tags.push(t('ignoredChannelsTag', { count: it.ignored_channel_ids.length }));
              if (it.allowed_role_ids?.length) tags.push(t('allowedRolesTag', { count: it.allowed_role_ids.length }));
              if (it.ignored_role_ids?.length) tags.push(t('ignoredRolesTag', { count: it.ignored_role_ids.length }));
              return (
                <div key={it._id} className="rounded-lg border border-border/50 p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{t('arrow', { trigger: it.trigger, response: it.response })}</div>
                    <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span>{it.exact_match ? t('exactMatch') : t('contains')}</span>
                      {tags.map((tag) => <span key={tag}>· {tag}</span>)}
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => del(it._id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

const EMPTY_CC_RESTRICTIONS = {
  allowed_channel_ids: [], blocked_channel_ids: [],
  required_role_ids: [], blocked_role_ids: [],
  cooldown_seconds: 0, channel_message: '', permission_message: '', cooldown_message: '',
};

const EMPTY_CC_REWARDS = { role_enabled: false, role_ids: [], emoji_enabled: false, nickname_emojis: [], nickname_position: 'before' };

function AutomationTile({ icon: Icon, title, description, enabled, onToggle, children }) {
  return (
    <div className={`rounded-xl border p-4 transition-colors ${enabled ? 'border-primary/60 bg-primary/5 shadow-sm' : 'border-border/60 bg-secondary/10'}`}>
      <div className="flex items-start gap-3">
        <div className={`h-10 w-10 shrink-0 rounded-lg grid place-items-center ${enabled ? 'gradient-primary text-white' : 'bg-secondary text-muted-foreground'}`}><Icon className="w-5 h-5" /></div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold leading-tight">{title}</div>
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        </div>
        <Switch checked={!!enabled} onCheckedChange={onToggle} aria-label={title} />
      </div>
      {enabled && <div className="mt-4 space-y-4 border-t border-border/50 pt-4">{children}</div>}
    </div>
  );
}

function CustomCommandRewardsFields({ rewards, onChange, meta, t }) {
  const set = (patch) => onChange({ ...rewards, ...patch });
  const chosen = Array.isArray(rewards.nickname_emojis) ? rewards.nickname_emojis : [];
  const [typed, setTyped] = useState('');
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState(EMOJI_GROUPS[0].id);
  const [tone, setTone] = useState(0);
  const full = chosen.length >= NICK_EMOJI_MAX;
  const add = (list) => {
    const next = [...chosen];
    for (const e of list) if (next.length < NICK_EMOJI_MAX && !next.includes(e)) next.push(e);
    set({ nickname_emojis: next });
  };
  const remove = (e) => set({ nickname_emojis: chosen.filter((x) => x !== e) });
  const toggle = (e) => (chosen.includes(e) ? remove(e) : add([e]));
  const addTyped = () => {
    const found = extractEmojis(typed);
    if (!found.length) { toast.error(t('ccRewardEmojiInvalid')); return; }
    add(found);
    setTyped('');
  };
  const position = NICK_POSITIONS.includes(rewards.nickname_position) ? rewards.nickname_position : 'before';
  return (
    <div className="space-y-3">
      <div>
        <div className="font-semibold">{t('ccAutomationsHeading')}</div>
        <p className="text-xs text-muted-foreground mt-0.5">{t('ccAutomationsHint')}</p>
      </div>
      <AutomationTile icon={ShieldCheck} title={t('ccAutoRoleTitle')} description={t('ccAutoRoleDesc')} enabled={rewards.role_enabled} onToggle={(v) => set({ role_enabled: v })}>
        <div>
          <Label className="mb-1 block">{t('ccRewardRoles')}</Label>
          <p className="text-xs text-muted-foreground mb-2">{t('ccRewardRolesHint', { max: NICK_ROLE_MAX })}</p>
          <RoleMultiSelect value={rewards.role_ids} onChange={(v) => set({ role_ids: v.slice(0, NICK_ROLE_MAX) })} roles={meta.roles} placeholder={t('ccRewardNoRole')} />
        </div>
      </AutomationTile>
      <AutomationTile icon={Smile} title={t('ccAutoEmojiTitle')} description={t('ccAutoEmojiDesc')} enabled={rewards.emoji_enabled} onToggle={(v) => set({ emoji_enabled: v })}>
        <div className="space-y-3">
        <div>
          <Label className="mb-1 block">{t('ccRewardEmojis', { max: NICK_EMOJI_MAX })}</Label>
          <p className="text-xs text-muted-foreground">{t('ccRewardEmojisHint')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 min-h-[2.5rem]" aria-live="polite">
          {chosen.length === 0 ? <span className="text-xs text-muted-foreground">{t('ccRewardNoEmoji')}</span> : chosen.map((e) => (
            <button key={e} type="button" onClick={() => remove(e)} title={t('ccRewardRemoveEmoji')} className="h-9 min-w-9 px-2 rounded-lg border border-border bg-background text-xl hover:border-destructive/70">{e}</button>
          ))}
          <Badge variant="secondary" className="ml-auto">{chosen.length} / {NICK_EMOJI_MAX}</Badge>
        </div>
        <div className="flex gap-2">
          <Input value={typed} onChange={(e) => setTyped(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTyped(); } }} placeholder={t('ccRewardEmojiPlaceholder')} disabled={full} maxLength={40} />
          <Button type="button" variant="secondary" onClick={addTyped} disabled={full || !typed.trim()}>{t('ccRewardEmojiAdd')}</Button>
        </div>
        <div className="rounded-lg border border-border/50 p-2 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('ccRewardSearch')} className="h-8 flex-1 min-w-[10rem]" maxLength={40} />
            <div className="flex items-center gap-1" role="group" aria-label={t('ccRewardSkinTone')} title={t('ccRewardSkinTone')}>
              {SKIN_TONES.map((_, i) => (
                <button key={i} type="button" onClick={() => setTone(i)} className={`h-8 w-8 rounded-md text-base ${tone === i ? 'bg-primary/25 ring-1 ring-primary' : 'hover:bg-secondary/50'}`}>{toneSwatch(i)}</button>
              ))}
            </div>
          </div>
          {!query.trim() && (
            <div className="flex flex-wrap gap-1">
              {EMOJI_GROUPS.map((g) => (
                <button key={g.id} type="button" onClick={() => setTab(g.id)} className={`px-2 py-1 rounded-md text-xs ${tab === g.id ? 'bg-primary/25 ring-1 ring-primary font-medium' : 'hover:bg-secondary/50 text-muted-foreground'}`}>
                  {g.emojis[0][0]} {t(`ccRewardGroup_${g.id}`)}
                </button>
              ))}
            </div>
          )}
          {(() => {
            const list = query.trim() ? searchEmojis(query) : (EMOJI_GROUPS.find((g) => g.id === tab) || EMOJI_GROUPS[0]).emojis;
            if (!list.length) return <div className="p-3 text-xs text-muted-foreground">{t('ccRewardNoResults')}</div>;
            return (
              <div className="max-h-60 overflow-y-auto scrollbar-thin flex flex-wrap gap-1">
                {list.map(([base, name, skin]) => {
                  const e = skin ? withTone(base, SKIN_TONES[tone]) : base;
                  const on = chosen.includes(e);
                  return (
                    <button key={base} type="button" title={name} onClick={() => toggle(e)} disabled={!on && full}
                      className={`h-9 w-9 rounded-md text-xl transition ${on ? 'bg-primary/25 ring-1 ring-primary' : 'hover:bg-secondary/50'} ${!on && full ? 'opacity-30 cursor-not-allowed' : ''}`}>{e}</button>
                  );
                })}
              </div>
            );
          })()}
        </div>
        <div>
          <Label className="mb-1 block">{t('ccRewardPosition')}</Label>
          <div className="flex flex-wrap gap-2">
            {NICK_POSITIONS.map((p) => (
              <Button key={p} type="button" size="sm" variant={position === p ? 'default' : 'outline'} className={position === p ? 'gradient-primary' : ''} onClick={() => set({ nickname_position: p })}>{t(`ccRewardPos_${p}`)}</Button>
            ))}
          </div>
        </div>
        {chosen.length > 0 && (
          <div className="text-xs text-muted-foreground">
            {t('ccRewardPreview')}: <span className="font-medium text-foreground">
              {position === 'random' ? `${previewNickname(t('ccRewardSampleName'), chosen, 'before')}  /  ${previewNickname(t('ccRewardSampleName'), chosen, 'after')}` : previewNickname(t('ccRewardSampleName'), chosen, position)}
            </span>
          </div>
        )}
          <p className="text-xs text-muted-foreground">{t('ccRewardPermHint')}</p>
        </div>
      </AutomationTile>
    </div>
  );
}

function CustomCommandRestrictionsFields({ restrictions, onChange, deleteTrigger, onDeleteTriggerChange, meta, t }) {
  const set = (patch) => onChange({ ...restrictions, ...patch });
  return (
    <div className="space-y-4 rounded-lg border border-border/60 p-4 bg-secondary/10">
      <div>
        <Label className="mb-1 block">{t('ccAllowedChannels')}</Label>
        <ChannelMultiSelect value={restrictions.allowed_channel_ids} onChange={(v) => set({ allowed_channel_ids: v })} channels={meta.channels} types={[0, 5]} placeholder={t('ccNoChannelRestriction')} />
      </div>
      <div>
        <Label className="mb-1 block">{t('ccBlockedChannels')}</Label>
        <ChannelMultiSelect value={restrictions.blocked_channel_ids} onChange={(v) => set({ blocked_channel_ids: v })} channels={meta.channels} types={[0, 5]} placeholder={t('ccNoChannelsBlocked')} />
      </div>
      <div>
        <Label className="mb-1 block">{t('ccRequiredRoles')}</Label>
        <RoleMultiSelect value={restrictions.required_role_ids} onChange={(v) => set({ required_role_ids: v })} roles={meta.roles} placeholder={t('ccNoRoleRequired')} />
      </div>
      <div>
        <Label className="mb-1 block">{t('ccBlockedRoles')}</Label>
        <RoleMultiSelect value={restrictions.blocked_role_ids} onChange={(v) => set({ blocked_role_ids: v })} roles={meta.roles} placeholder={t('ccNoRolesBlocked')} />
      </div>
      <div>
        <Label className="mb-1 block">{t('ccCooldown')}</Label>
        <Input type="number" min="0" max="86400" value={restrictions.cooldown_seconds || 0} onChange={(e) => set({ cooldown_seconds: Math.max(0, Math.min(86400, Number(e.target.value) || 0)) })} />
      </div>
      <div><Label className="mb-1 block">{t('ccChannelMessage')}</Label><Input value={restrictions.channel_message || ''} onChange={(e) => set({ channel_message: e.target.value })} placeholder={t('ccChannelMessagePlaceholder')} maxLength={300} /></div>
      <div><Label className="mb-1 block">{t('ccPermissionMessage')}</Label><Input value={restrictions.permission_message || ''} onChange={(e) => set({ permission_message: e.target.value })} placeholder={t('ccPermissionMessagePlaceholder')} maxLength={300} /></div>
      <div><Label className="mb-1 block">{t('ccCooldownMessage')}</Label><Input value={restrictions.cooldown_message || ''} onChange={(e) => set({ cooldown_message: e.target.value })} placeholder={t('ccCooldownMessagePlaceholder')} maxLength={300} /></div>
      <FieldRow label={t('ccDeleteTrigger')} hint={t('ccDeleteTriggerHint')}><Switch checked={!!deleteTrigger} onCheckedChange={onDeleteTriggerChange} /></FieldRow>
    </div>
  );
}

function CustomCommandsPanel({ guildId, meta }) {
  const t = useTranslations('guildSettings.customCommands');
  const tc = useTranslations('guildSettings.common');
  const [items, setItems] = useState(null);
  const [name, setName] = useState('');
  const [response, setResponse] = useState('');
  const [busy, setBusy] = useState(false);
  const [limit, setLimit] = useState(1);
  const [isPremium, setIsPremium] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [restrictions, setRestrictions] = useState(EMPTY_CC_RESTRICTIONS);
  const [deleteTrigger, setDeleteTrigger] = useState(false);
  const [rewards, setRewards] = useState(EMPTY_CC_REWARDS);
  const [editRewards, setEditRewards] = useState(EMPTY_CC_REWARDS);
  const [editingId, setEditingId] = useState(null);
  const [editResponse, setEditResponse] = useState('');
  const [editRestrictions, setEditRestrictions] = useState(EMPTY_CC_RESTRICTIONS);
  const [editDeleteTrigger, setEditDeleteTrigger] = useState(false);
  const [editEnabled, setEditEnabled] = useState(true);
  const [editBusy, setEditBusy] = useState(false);
  async function load() {
    const d = await safeJson(`/api/guilds/${guildId}/custom_commands`, {});
    setItems(d.items || []);
    setLimit(Number(d.limit || 5));
    setIsPremium(Boolean(d.is_premium));
  }
  useEffect(() => { load(); }, [guildId]);
  async function add() {
    if (!name.trim() || !response.trim()) { toast.error(t('nameResponseRequired')); return; }
    if ((items?.length || 0) >= limit) {
      const standardCC = isPremium ? FREE_LIMITS.custom_commands : limit;
      toast.error(t('limitReachedTitle'), {
        description: premiumBoostLine(tc, standardCC, isPremium, t('commandsWord')),
      });
      return;
    }
    setBusy(true);
    const r = await fetch(`/api/guilds/${guildId}/custom_commands`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, response, restrictions, rewards, delete_trigger: deleteTrigger }),
    });
    setBusy(false);
    if (r.ok) { setName(''); setResponse(''); setRestrictions(EMPTY_CC_RESTRICTIONS); setRewards(EMPTY_CC_REWARDS); setDeleteTrigger(false); setShowAdvanced(false); toast.success(t('addedSuccess')); load(); }
    else {
      const d = await r.json().catch(() => ({}));
      if (r.status === 429 && d.error === 'custom_command_limit' && d.limit) {
        setLimit(Number(d.limit));
        setIsPremium(Boolean(d.is_premium));
      }
      toast.error(t('addFailed'), { description: d.detail || d.error || t('tryAgain') });
    }
  }
  async function del(id) {
    if (!confirm(t('deleteConfirm'))) return;
    const r = await fetch(`/api/guilds/${guildId}/custom_commands/${id}`, { method: 'DELETE' });
    if (r.ok) { toast.success(t('deletedSuccess')); load(); }
    else toast.error(t('deleteFailed'));
  }
  function startEdit(it) {
    setEditingId(it._id);
    setEditResponse(it.response || '');
    setEditRestrictions({ ...EMPTY_CC_RESTRICTIONS, ...(it.restrictions || {}) });
    {
      const rw = it.rewards || {};
      setEditRewards({
        ...EMPTY_CC_REWARDS, ...rw,
        role_enabled: rw.role_enabled === undefined ? (rw.role_ids || []).length > 0 : !!rw.role_enabled,
        emoji_enabled: rw.emoji_enabled === undefined ? (rw.nickname_emojis || []).length > 0 : !!rw.emoji_enabled,
      });
    }
    setEditDeleteTrigger(!!it.delete_trigger);
    setEditEnabled(it.enabled !== false);
  }
  async function saveEdit(id) {
    setEditBusy(true);
    const r = await fetch(`/api/guilds/${guildId}/custom_commands/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ response: editResponse, restrictions: editRestrictions, rewards: editRewards, delete_trigger: editDeleteTrigger, enabled: editEnabled }),
    });
    setEditBusy(false);
    if (r.ok) { toast.success(t('savedSuccess')); setEditingId(null); load(); }
    else toast.error(t('addFailed'));
  }
  if (!items) return <Skeleton />;
  const atLimit = items.length >= limit;
  return (
    <div className="space-y-6">
      <SectionHeader title={t('title')} />
      <LimitPlanNotice isPremium={isPremium} t={tc} />
      <Card className="p-6 bg-card/60">
        <div className="flex items-center justify-between gap-4 mb-1">
          <div>
            <div className="font-semibold">{t('configuredHeading')}</div>
            <p className="text-xs text-muted-foreground mt-1">{tc('premiumUnlimitedNote')}</p>
          </div>
          <Badge variant="secondary">{items.length} / {isUnlimited(limit) ? '∞' : limit}</Badge>
        </div>
        <div className="mt-4"><ProgressBar value={items.length} max={limit} label={t('usedLabel')} note={atLimit ? (isPremium ? t('limitReachedPremium') : t('limitReachedFree', { clause: premiumBoostClause(tc, (isPremium ? FREE_LIMITS.custom_commands : limit), t('commandsWord')) })) : t('slotsAvailable')} /></div>
      </Card>
      <Card className="p-6 space-y-4 bg-card/60">
        <div><Label>{t('nameLabel')}</Label><Input value={name} onChange={(e) => setName(e.target.value.toLowerCase())} placeholder={t('namePlaceholder')} disabled={atLimit} /></div>
        <div><Label>{t('responseLabel')}</Label><Input value={response} onChange={(e) => setResponse(e.target.value)} placeholder={t('responsePlaceholder')} disabled={atLimit} /></div>
        <CustomCommandRewardsFields rewards={rewards} onChange={setRewards} meta={meta} t={t} />
        <button type="button" onClick={() => setShowAdvanced((v) => !v)} aria-expanded={showAdvanced} className={`group flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all ${showAdvanced ? 'border-primary/60 bg-primary/10' : 'border-border/60 bg-secondary/20 hover:border-primary/50 hover:bg-primary/5'}`}>
          <span className={`h-10 w-10 shrink-0 rounded-lg grid place-items-center transition-colors ${showAdvanced ? 'gradient-primary text-white' : 'bg-secondary text-primary group-hover:gradient-primary group-hover:text-white'}`}><SlidersHorizontal className="w-5 h-5" /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold leading-tight">{t('ccAdvancedTitle')}</span>
            <span className="block text-xs text-muted-foreground mt-0.5">{t('ccAdvancedDesc')}</span>
          </span>
          <span className={`h-7 w-7 shrink-0 rounded-full border grid place-items-center transition-colors ${showAdvanced ? 'border-primary/60 bg-primary/15 text-primary' : 'border-border text-muted-foreground group-hover:border-primary/60 group-hover:text-primary'}`}><ChevronDown className={`h-4 w-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} /></span>
        </button>
        {showAdvanced && (
          <CustomCommandRestrictionsFields restrictions={restrictions} onChange={setRestrictions} deleteTrigger={deleteTrigger} onDeleteTriggerChange={setDeleteTrigger} meta={meta} t={t} />
        )}
        <Button className="gradient-primary w-full sm:w-auto sm:ml-auto sm:flex" onClick={add} disabled={busy || atLimit}><Plus className="w-4 h-4 mr-1" /> {t('add')}</Button>
      </Card>
      <Card className="p-6 bg-card/60">
        {items.length === 0 ? <Empty text={t('empty')} /> : (
          <div className="space-y-2">
            {items.map((it) => (
              <div key={it._id} className="rounded-lg border border-border/50 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 cursor-pointer" onClick={() => (editingId === it._id ? setEditingId(null) : startEdit(it))}>
                    <div className="text-sm font-medium truncate flex items-center gap-2">
                      !{it.name}
                      {it.enabled === false && <Badge variant="secondary" className="text-[10px]">{t('ccDisabledBadge')}</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{it.response}</div>
                    {((it.rewards?.role_enabled !== false && it.rewards?.role_ids?.length > 0) || (it.rewards?.emoji_enabled !== false && it.rewards?.nickname_emojis?.length > 0)) && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {it.rewards?.role_enabled !== false && it.rewards?.role_ids?.length > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary"><ShieldCheck className="w-3 h-3" /> {t('ccRewardRoleBadge', { count: it.rewards.role_ids.length })}</span>
                        )}
                        {it.rewards?.emoji_enabled !== false && it.rewards?.nickname_emojis?.length > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary"><Smile className="w-3 h-3" /> {t('ccRewardEmojiBadge')} <span className="text-sm leading-none">{it.rewards.nickname_emojis.join('')}</span></span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="sm" variant="ghost" onClick={() => (editingId === it._id ? setEditingId(null) : startEdit(it))}>{editingId === it._id ? tc('cancel') : t('ccEdit')}</Button>
                    <Button size="icon" variant="ghost" onClick={() => del(it._id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </div>
                </div>
                {editingId === it._id && (
                  <div className="mt-4 space-y-4 border-t border-border/50 pt-4">
                    <div><Label>{t('responseLabel')}</Label><Input value={editResponse} onChange={(e) => setEditResponse(e.target.value)} /></div>
                    <FieldRow label={t('ccEnabled')}><Switch checked={editEnabled} onCheckedChange={setEditEnabled} /></FieldRow>
                    <CustomCommandRewardsFields rewards={editRewards} onChange={setEditRewards} meta={meta} t={t} />
                    <CustomCommandRestrictionsFields restrictions={editRestrictions} onChange={setEditRestrictions} deleteTrigger={editDeleteTrigger} onDeleteTriggerChange={setEditDeleteTrigger} meta={meta} t={t} />
                    <div className="flex justify-end"><Button className="gradient-primary" onClick={() => saveEdit(it._id)} disabled={editBusy}>{tc('saveChanges')}</Button></div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function GiveawaysPanel({ guildId, meta }) {
  const t = useTranslations('guildSettings.giveaways');
  const tc = useTranslations('guildSettings.common');
  const [items, setItems] = useState(null);
  const [limit, setLimit] = useState(1);
  const [activeCount, setActiveCount] = useState(0);
  const [isPremium, setIsPremium] = useState(false);
  const [prize, setPrize] = useState('');
  const [channelId, setChannelId] = useState(null);
  const [winners, setWinners] = useState(1);
  const [durationValue, setDurationValue] = useState(60);
  const [durationUnit, setDurationUnit] = useState('minutes');
  const [mentionRoleIds, setMentionRoleIds] = useState([]);
  const [blockedRoleIds, setBlockedRoleIds] = useState([]);
  const [allowedRoleIds, setAllowedRoleIds] = useState([]);
  const [roleWeights, setRoleWeights] = useState({});
  const [busy, setBusy] = useState(false);
  const [actingId, setActingId] = useState(null);

  async function load() {
    const d = await safeJson(`/api/guilds/${guildId}/giveaways`, {});
    setItems(d.items || []);
    setLimit(Number(d.limit) || 1);
    setActiveCount(Number(d.active_count) || 0);
    setIsPremium(Boolean(d.is_premium));
  }
  useEffect(() => { load(); }, [guildId]);

  const unitToMinutes = { minutes: 1, hours: 60, days: 60 * 24 };

  async function create() {
    if (!channelId) { toast.error(t('chooseChannel')); return; }
    if (!prize.trim()) { toast.error(t('prizeRequired')); return; }
    setBusy(true);
    const r = await fetch(`/api/guilds/${guildId}/giveaways`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prize, channel_id: channelId, winners_count: Number(winners) || 1,
        duration_minutes: Number(durationValue) * (unitToMinutes[durationUnit] || 1),
        mention_role_ids: mentionRoleIds, blocked_role_ids: blockedRoleIds, allowed_role_ids: allowedRoleIds,
        role_weights: roleWeights,
      }),
    });
    setBusy(false);
    if (r.ok) { setPrize(''); setMentionRoleIds([]); setBlockedRoleIds([]); setAllowedRoleIds([]); setRoleWeights({}); toast.success(t('posted')); load(); }
    else {
      const d = await r.json().catch(() => ({}));
      toast.error(t('postFailed'), { description: d.detail || d.error || '' });
    }
  }

  async function endNow(id) {
    setActingId(id);
    const r = await fetch(`/api/guilds/${guildId}/giveaways/${id}/end`, { method: 'POST' });
    setActingId(null);
    if (r.ok) { toast.success(t('endingNow')); setTimeout(load, 4000); }
    else toast.error(t('endFailed'));
  }

  async function reroll(id) {
    setActingId(id);
    const r = await fetch(`/api/guilds/${guildId}/giveaways/${id}/reroll`, { method: 'POST' });
    setActingId(null);
    if (r.ok) toast.success(t('rerolled'));
    else {
      const d = await r.json().catch(() => ({}));
      toast.error(t('rerollFailed'), { description: d.error || '' });
    }
  }

  async function cancel(id) {
    if (!confirm(t('cancelConfirm'))) return;
    setActingId(id);
    const r = await fetch(`/api/guilds/${guildId}/giveaways/${id}`, { method: 'DELETE' });
    setActingId(null);
    if (r.ok) { toast.success(t('cancelled')); load(); }
    else toast.error(t('cancelFailed'));
  }

  if (!items) return <Skeleton />;
  return (
    <div className="space-y-6">
      <SectionHeader title={t('title')} />
      <LimitPlanNotice isPremium={isPremium} t={tc} />
      <Card className="p-5 bg-card/60">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium">{t('activeGiveaways')}</div>
            <div className="text-xs text-muted-foreground mt-1">{t('activePremiumNote')}</div>
          </div>
          <div className="text-2xl font-bold">{activeCount}/{isUnlimited(limit) ? '∞' : limit}</div>
        </div>
        <div className="mt-3 h-2 rounded-full bg-secondary overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: isUnlimited(limit) ? '100%' : `${Math.min(100, (activeCount / Math.max(1, limit)) * 100)}%`, opacity: isUnlimited(limit) ? 0.45 : 1 }} />
        </div>
      </Card>
      <Card className="p-6 space-y-4 bg-card/60">
        <div className="grid sm:grid-cols-2 gap-3">
          <div><Label>{t('prizeLabel')}</Label><Input value={prize} onChange={(e) => setPrize(e.target.value)} placeholder={t('prizePlaceholder')} /></div>
          <div>
            <Label>{t('channelLabel')}</Label>
            <ChannelSelect value={channelId} onChange={setChannelId} channels={meta.channels} includeNone={false} placeholder={t('channelPlaceholder')} />
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <NumField label={t('winnersLabel')} value={winners} onChange={setWinners} />
          <div>
            <Label>{t('durationLabel')}</Label>
            <div className="flex gap-2">
              <Input type="number" min={1} className="w-24" value={durationValue} onChange={(e) => setDurationValue(e.target.value)} />
              <Select value={durationUnit} onValueChange={setDurationUnit}>
                <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="minutes">{t('unitMinutes')}</SelectItem>
                  <SelectItem value="hours">{t('unitHours')}</SelectItem>
                  <SelectItem value="days">{t('unitDays')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <div className="flex items-center gap-1.5 mb-1"><Label className="mb-0">{t('rolesToTag')}</Label><InfoHint>{t('rolesToTagDesc')}</InfoHint></div>
            <RoleMultiSelect value={mentionRoleIds} onChange={setMentionRoleIds} roles={meta.roles} placeholder={t('noRoleSelected')} />
          </div>
          <div>
            <div className="flex items-center gap-1.5 mb-1"><Label className="mb-0">{t('rolesBlocked')}</Label><InfoHint>{t('rolesBlockedDesc')}</InfoHint></div>
            <RoleMultiSelect
              value={blockedRoleIds}
              onChange={setBlockedRoleIds}
              roles={meta.roles}
              placeholder={t('noRoleBlocked')}
              disabled={allowedRoleIds.length > 0}
            />
          </div>
        </div>
        <div>
          <div className="flex items-center gap-1.5 mb-1"><Label className="mb-0">{t('rolesAllowed')}</Label><InfoHint>{t('rolesAllowedDesc')}</InfoHint></div>
          <RoleMultiSelect
            value={allowedRoleIds}
            onChange={setAllowedRoleIds}
            roles={meta.roles}
            placeholder={t('noRoleRestriction')}
            disabled={blockedRoleIds.length > 0}
          />
        </div>
        <div>
          <div className="flex items-center gap-1.5 mb-1"><Label className="mb-0">{t('roleOdds')}</Label><InfoHint>{t('roleOddsDesc')}</InfoHint></div>
          <RoleWeightList value={roleWeights} onChange={setRoleWeights} roles={meta.roles} addLabel={t('addRoleOdds')} />
        </div>
        <Button className="gradient-primary" onClick={create} disabled={busy || activeCount >= limit}>
          {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Gift className="w-4 h-4 mr-1" />} {t('startGiveaway')}
        </Button>
      </Card>
      <Card className="p-6 bg-card/60">
        {items.length === 0 ? <Empty text={t('empty')} /> : (
          <div className="space-y-2">
            {items.map((g) => (
              <div key={g._id} className="rounded-lg border border-border/50 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium">🎁 {g.prize || t('prizeFallback')}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {t('winnersColon')} {g.winners_count || 1} · {t('channelColon')} {channelName(meta, g.channel_id) || t('unknownChannel')} · {g.ended ? t('statusEnded') : t('statusActive')}
                    {!g.ended ? ` · ${t('joinedCount', { count: g.participant_count ?? 0 })}` : ''}
                    {g.host_name ? ` · ${t('hostedBy', { name: g.host_name })}` : ''}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!g.ended && (
                    <Button size="sm" variant="outline" disabled={actingId === g._id} onClick={() => endNow(g._id)}>
                      {t('endNow')}
                    </Button>
                  )}
                  {g.ended && (
                    <Button size="sm" variant="outline" disabled={actingId === g._id} onClick={() => reroll(g._id)}>
                      {t('reroll')}
                    </Button>
                  )}
                  {!g.ended && (
                    <Button size="icon" variant="ghost" disabled={actingId === g._id} onClick={() => cancel(g._id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function ScheduledMessagesPanel({ guildId, meta }) {
  const t = useTranslations('guildSettings.scheduledMessages');
  const tc = useTranslations('guildSettings.common');
  const [items, setItems] = useState(null);
  const [limit, setLimit] = useState(1);
  const [activeCount, setActiveCount] = useState(0);
  const [isPremium, setIsPremium] = useState(false);
  const [channelId, setChannelId] = useState(null);
  const [content, setContent] = useState('');
  const [repeat, setRepeat] = useState('once');
  const [intervalMinutes, setIntervalMinutes] = useState(60);
  const [sendAt, setSendAt] = useState('');
  const [useEmbed, setUseEmbed] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#e08a4e');
  const [imageUrl, setImageUrl] = useState('');
  const [mentionRoleIds, setMentionRoleIds] = useState([]);
  const [busy, setBusy] = useState(false);
  const adv = useAdvancedEmbed();
  const tAdv = useTranslations('guildSettings.embedBuilder');

  async function load() {
    const d = await safeJson(`/api/guilds/${guildId}/scheduled_messages`, {});
    setItems(d.items || []);
    setLimit(Number(d.limit) || 1);
    setActiveCount(Number(d.active_count) || 0);
    setIsPremium(Boolean(d.is_premium));
  }
  useEffect(() => { load(); }, [guildId]);

  async function create() {
    if (!channelId) { toast.error(t('chooseChannel')); return; }
    if (!content.trim() && !useEmbed) { toast.error(t('writeMessageOrEmbed')); return; }
    if (useEmbed && !title.trim() && !description.trim() && !imageUrl.trim()) {
      toast.error(t('embedNeedsContent')); return;
    }
    if (useEmbed && imageUrl.trim()) {
      try {
        const u = new URL(imageUrl.trim());
        if (!['http:', 'https:'].includes(u.protocol)) throw new Error('bad_protocol');
      } catch {
        toast.error(t('invalidImageUrlTitle'), { description: t('invalidImageUrlDesc') });
        return;
      }
    }
    if (!sendAt) { toast.error(t('pickDateTime')); return; }
    const embed = useEmbed ? {
      title: title || undefined,
      description: description || undefined,
      color: parseInt(color.replace('#', ''), 16) || 0xe08a4e,
      image: imageUrl.trim() ? { url: imageUrl.trim() } : undefined,
    } : null;
    const advRes = buildAdvancedPayload(adv, tAdv, { withEmbed: useEmbed });
    if (advRes.error) { toast.error(advRes.error); return; }
    const advancedPayload = advRes.payload;
    const mentions = mentionRoleIds.map((id) => `<@&${id}>`).join(' ');
    const finalContent = mentions ? `${mentions}${content.trim() ? ` ${content}` : ''}` : content;
    setBusy(true);
    const r = await fetch(`/api/guilds/${guildId}/scheduled_messages`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel_id: channelId, content: finalContent, embed, repeat,
        interval_minutes: Number(intervalMinutes) || 60,
        send_at: new Date(sendAt).toISOString(),
        mention_role_ids: mentionRoleIds,
        ...(advancedPayload ? { advanced: advancedPayload } : {}),
      }),
    });
    setBusy(false);
    if (r.ok) { setContent(''); setTitle(''); setDescription(''); setImageUrl(''); setMentionRoleIds([]); adv.reset(); toast.success(t('scheduled')); load(); }
    else {
      const d = await r.json().catch(() => ({}));
      toast.error(t('failed'), { description: d.detail || d.error || '' });
    }
  }

  async function del(id) {
    if (!confirm(t('cancelConfirm'))) return;
    const r = await fetch(`/api/guilds/${guildId}/scheduled_messages/${id}`, { method: 'DELETE' });
    if (r.ok) { toast.success(t('cancelled')); load(); }
    else toast.error(t('cancelFailed'));
  }

  if (!items) return <Skeleton />;
  return (
    <div className="space-y-6">
      <SectionHeader title={t('title')} />
      <LimitPlanNotice isPremium={isPremium} t={tc} />
      <Card className="p-5 bg-card/60">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium">{t('activeScheduled')}</div>
            <div className="text-xs text-muted-foreground mt-1">{t('activePremiumNote')}</div>
          </div>
          <div className="text-2xl font-bold">{activeCount}/{isUnlimited(limit) ? '∞' : limit}</div>
        </div>
        <div className="mt-3 h-2 rounded-full bg-secondary overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: isUnlimited(limit) ? '100%' : `${Math.min(100, (activeCount / Math.max(1, limit)) * 100)}%`, opacity: isUnlimited(limit) ? 0.45 : 1 }} />
        </div>
      </Card>
      <div className="grid xl:grid-cols-[1.05fr_.95fr] gap-6 items-start">
        <Card className="p-4 sm:p-6 space-y-4 bg-card/60">
          <AdvancedModeToggle adv={adv} t={tAdv} />
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label>{t('channelLabel')}</Label>
              <ChannelSelect value={channelId} onChange={setChannelId} channels={meta.channels} includeNone={false} />
            </div>
            <div>
              <Label>{t('sendAtLabel')}</Label>
              <Input type="datetime-local" value={sendAt} onChange={(e) => setSendAt(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>{t('messageTextLabel')}</Label>
            <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder={t('messagePlaceholder')} />
          </div>
          <div>
            <div className="flex items-center gap-1.5 mb-1"><Label className="mb-0">{t('tagRolesLabel')}</Label><InfoHint>{t('tagRolesDesc')}</InfoHint></div>
            <RoleMultiSelect value={mentionRoleIds} onChange={setMentionRoleIds} roles={meta.roles} placeholder={t('noRolesTagged')} />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label>{t('repeatLabel')}</Label>
              <Select value={repeat} onValueChange={setRepeat}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="once">{t('repeatOnce')}</SelectItem>
                  <SelectItem value="daily">{t('repeatDaily')}</SelectItem>
                  <SelectItem value="weekly">{t('repeatWeekly')}</SelectItem>
                  <SelectItem value="interval">{t('repeatInterval')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {repeat === 'interval' && (
              <NumField label={t('everyMinutesLabel')} value={intervalMinutes} onChange={setIntervalMinutes} />
            )}
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={useEmbed} onCheckedChange={setUseEmbed} /> <span className="text-sm">{t('includeEmbed')}</span>
          </div>
          {useEmbed && (
            <div className="grid sm:grid-cols-2 gap-3">
              <div><Label>{t('embedTitleLabel')}</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
              <div><Label>{t('colorLabel')}</Label><Input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 w-16 p-1 cursor-pointer" /></div>
              <div className="sm:col-span-2"><Label>{t('embedDescriptionLabel')}</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} /></div>
              <div className="sm:col-span-2"><div className="flex items-center gap-1.5 mb-1"><Label className="mb-0">{t('imageUrlLabel')}</Label><InfoHint>{t('imageUrlHint')}</InfoHint></div><Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder={t('imageUrlPlaceholder')} /></div>
            </div>
          )}
          {adv.advanced && <AdvancedFields adv={adv} t={tAdv} showEmbedParts={useEmbed} />}
          {adv.advanced && !useEmbed && <p className="text-xs text-muted-foreground">{tAdv('needsEmbed')}</p>}
          <p className="text-xs text-muted-foreground">{t('lockedAfterSend')}</p>
          <Button className="gradient-primary" onClick={create} disabled={busy || activeCount >= limit}>
            {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />} {t('scheduleButton')}
          </Button>
        </Card>

        <Card className="p-5 bg-card/60 xl:sticky xl:top-6">
          <div className="flex items-center justify-between mb-4">
            <div><div className="font-semibold">{t('livePreview')}</div><div className="text-xs text-muted-foreground">{t('livePreviewUpdates')}</div></div>
            <Badge variant="outline">{t('scheduledBadge')}</Badge>
          </div>
          {(() => {
            const pingLine = [mentionRoleIds.map((id) => roleName(meta, id)).filter(Boolean).map((n) => `@${n}`).join(' '), content.trim() ? content : ''].filter(Boolean).join(' ');
            const hasEmbed = useEmbed && (title.trim() || description.trim() || imageUrl.trim() || (adv.advanced && (adv.authorName.trim() || previewFields(adv).length)));
            const previewBtns = previewButtons(adv);
            if (!pingLine && !hasEmbed) return <div className="rounded-2xl border border-dashed border-[#2b2d31] p-6 text-center text-xs text-muted-foreground">{t('nothingToPreview')}</div>;
            return (
              <DiscordMessage>
                {pingLine ? <DiscordText>{pingLine}</DiscordText> : null}
                {!hasEmbed && previewBtns.length ? <DiscordButtons buttons={previewBtns} /> : null}
                {hasEmbed ? <EmbedPreview accentColor={color || '#e08a4e'} title={title} description={description} imageUrl={imageUrl.trim() || null} authorName={adv.advanced ? adv.authorName.trim() : ''} fields={previewFields(adv)} buttons={previewButtons(adv)} /> : null}
              </DiscordMessage>
            );
          })()}
        </Card>
      </div>
      <Card className="p-6 bg-card/60">
        {items.length === 0 ? <Empty text={t('empty')} /> : (
          <div className="space-y-2">
            {items.map((it) => {
              const repeatLabels = { once: t('repeatOnce'), daily: t('repeatDaily'), weekly: t('repeatWeekly'), interval: t('repeatInterval') };
              return (
              <div key={it._id} className="rounded-lg border border-border/50 p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{it.content || it.embed?.title || t('embedFallback')}</div>
                  <div className="text-xs text-muted-foreground">
                    {t('channelColon')} {channelName(meta, it.channel_id) || t('unknownChannel')} · {repeatLabels[it.repeat] || it.repeat} · {t('nextColon')} {new Date(it.next_run).toLocaleString()} · {it.active ? t('statusActive') : t('statusSent')}
                  </div>
                  {!it.active || it.sent_at ? <div className="text-[11px] text-muted-foreground mt-0.5">{t('lockedBadge')}</div> : null}
                </div>
                <Button size="icon" variant="ghost" onClick={() => del(it._id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
              </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

function ForumsPanel({ guildId, meta }) {
  const t = useTranslations('guildSettings.forums');
  const tc = useTranslations('guildSettings.common');
  const [items, setItems] = useState(null);
  const [channelId, setChannelId] = useState(null);
  const [enabled, setEnabled] = useState(true);
  const [logChannelId, setLogChannelId] = useState(null);
  const [cooldown, setCooldown] = useState(60);
  const [archiveMinutes, setArchiveMinutes] = useState(1440);
  const [tagIds, setTagIds] = useState([]);
  const [limit, setLimit] = useState(1);
  const [isPremium, setIsPremium] = useState(false);
  const [busy, setBusy] = useState(false);

  async function load() {
    const d = await safeJson(`/api/guilds/${guildId}/forums`, {});
    setItems(d.items || []);
    setLimit(Number(d.limit) || 1);
    setIsPremium(Boolean(d.is_premium));
    const first = d.items?.[0];
    if (first) {
      setChannelId(String(first.channel_id));
      setEnabled(first.enabled !== false);
      setLogChannelId(first.log_channel_id ? String(first.log_channel_id) : null);
      setCooldown(Number(first.cooldown_seconds) || (d.is_premium ? 30 : 60));
      setArchiveMinutes(Number(first.auto_archive_minutes) || 1440);
      setTagIds((first.default_tag_ids || []).map(String));
    }
  }

  useEffect(() => { load(); }, [guildId]);

  const forumChannels = (meta?.channels || []).filter((channel) => Number(channel.type) === 15);
  const selectedChannel = forumChannels.find((channel) => channel.id === String(channelId));
  const tags = selectedChannel?.available_tags || [];
  const existing = items?.find((item) => String(item.channel_id) === String(channelId));

  function selectChannel(value) {
    setChannelId(value);
    const item = items?.find((entry) => String(entry.channel_id) === String(value));
    if (item) {
      setEnabled(item.enabled !== false);
      setLogChannelId(item.log_channel_id ? String(item.log_channel_id) : null);
      setCooldown(Number(item.cooldown_seconds) || (isPremium ? 30 : 60));
      setArchiveMinutes(Number(item.auto_archive_minutes) || 1440);
      setTagIds((item.default_tag_ids || []).map(String));
    } else {
      setEnabled(true);
      setLogChannelId(null);
      setCooldown(isPremium ? 30 : 60);
      setArchiveMinutes(1440);
      setTagIds([]);
    }
  }

  async function save() {
    if (!channelId) { toast.error(t('chooseForumChannel')); return; }
    setBusy(true);
    const r = await fetch(`/api/guilds/${guildId}/forums`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel_id: channelId,
        enabled,
        log_channel_id: logChannelId,
        cooldown_seconds: Number(cooldown) || 60,
        auto_archive_minutes: Number(archiveMinutes) || 1440,
        default_tag_ids: tagIds,
      }),
    });
    setBusy(false);
    const d = await r.json().catch(() => ({}));
    if (r.ok) {
      toast.success(existing ? t('updatedSuccess') : t('enabledSuccess'));
      load();
    } else {
      toast.error(t('saveFailed'), { description: d.detail || d.error || '' });
    }
  }

  async function remove() {
    if (!existing) return;
    if (!confirm(t('disableConfirm'))) return;
    const r = await fetch(`/api/guilds/${guildId}/forums/${existing._id}`, { method: 'DELETE' });
    if (r.ok) {
      toast.success(t('disabledSuccess'));
      setChannelId(null);
      setItems([]);
      load();
    } else toast.error(t('disableFailed'));
  }

  if (!items) return <Skeleton />;

  return (
    <div className="space-y-6">
      <SectionHeader
        title={t('title')}
        description={t('description')}
      />
      <LimitPlanNotice isPremium={isPremium} t={tc} />

      <Card className="p-5 bg-card/60">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium">{t('configuredChannels')}</div>
            <div className="text-xs text-muted-foreground mt-1">{t('premiumAllows')}</div>
          </div>
          <div className="text-2xl font-bold">{items.length}/{isUnlimited(limit) ? '∞' : limit}</div>
        </div>
      </Card>

      <Card className="p-4 sm:p-6 space-y-5 bg-card/60">
        <div>
          <Label>{t('forumChannelLabel')}</Label>
          <ChannelSelect value={channelId} onChange={selectChannel} channels={meta.channels} types={[15]} includeNone={false} placeholder={t('forumChannelPlaceholder')} />
        </div>

        <FieldRow label={t('enableAutomation')} hint={t('enableAutomationHint')}>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </FieldRow>

        <div className="grid sm:grid-cols-2 gap-4">
          <NumField
            label={t('cooldownLabel')}
            hint={t('cooldownHint')}
            value={cooldown}
            onChange={setCooldown}
          />
          <div>
            <Label>{t('autoArchiveLabel')}</Label>
            <Select value={String(archiveMinutes)} onValueChange={(value) => setArchiveMinutes(Number(value))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="60">{t('archive1h')}</SelectItem>
                <SelectItem value="1440">{t('archive1d')}</SelectItem>
                <SelectItem value="4320">{t('archive3d')}</SelectItem>
                <SelectItem value="10080">{t('archive7d')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <div className="flex items-center gap-1.5 mb-2"><Label className="mb-0">{t('defaultTagsLabel')}</Label><InfoHint>{t('defaultTagsDesc')}</InfoHint></div>
          {!selectedChannel ? (
            <div className="text-sm text-muted-foreground">{t('chooseForumFirst')}</div>
          ) : tags.length === 0 ? (
            <div className="text-sm text-muted-foreground">{t('noTagsAvailable')}</div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-2">
              {tags.map((tag) => (
                <label key={tag.id} className="flex items-center gap-2 rounded-lg border border-border/50 p-3 text-sm cursor-pointer">
                  <Checkbox
                    checked={tagIds.includes(String(tag.id))}
                    onCheckedChange={(checked) => {
                      const id = String(tag.id);
                      setTagIds((current) => checked
                        ? [...new Set([...current, id])].slice(0, 5)
                        : current.filter((value) => value !== id)
                      );
                    }}
                  />
                  <span className="truncate">{tag.name}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div>
          <Label>{t('logChannelLabel')}</Label>
          <ChannelSelect value={logChannelId} onChange={setLogChannelId} channels={meta.channels} types={[0, 5]} includeNone placeholder={t('logChannelPlaceholder')} />
        </div>

        <div className="rounded-xl border border-border/50 bg-secondary/10 p-4 text-xs text-muted-foreground leading-5">
          {isPremium ? t('premiumNote') : t('freeNote')}
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <Button className="gradient-primary" onClick={save} disabled={busy || (!existing && items.length >= limit)}>
            {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
            {existing ? t('saveChanges') : t('enableAutomationButton')}
          </Button>
          {existing && <Button variant="outline" onClick={remove}>{t('disable')}</Button>}
        </div>
      </Card>
    </div>
  );
}

function EmbedBuilderPanel({ guildId, meta }) {
  const t = useTranslations('guildSettings.embedBuilder');
  const [channelId, setChannelId] = useState(null);
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#e08a4e');
  const [footer, setFooter] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [thumbUrl, setThumbUrl] = useState('');
  const [mentionRoleIds, setMentionRoleIds] = useState([]);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const adv = useAdvancedEmbed();
  const { advanced } = adv;

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((v) => Math.max(0, v - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  async function send() {
    if (!channelId) { toast.error(t('chooseChannel')); return; }
    if (!title.trim() && !description.trim() && !imageUrl.trim() && !thumbUrl.trim()) {
      toast.error(t('addContent')); return;
    }
    let normalizedImageUrl = imageUrl.trim();
    let normalizedThumbUrl = thumbUrl.trim();
    for (const [label, url, apply] of [
      [t('imageUrlWord'), imageUrl, (v) => { normalizedImageUrl = v; }],
      [t('thumbnailUrlWord'), thumbUrl, (v) => { normalizedThumbUrl = v; }],
    ]) {
      if (!url.trim()) continue;
      try {
        const u = new URL(url.trim());
        if (!['http:', 'https:'].includes(u.protocol)) throw new Error('bad_protocol');
        apply(u.href);
      } catch {
        toast.error(t('invalidUrlTitle', { field: label }), { description: t('invalidUrlDesc') });
        return;
      }
    }
    const embed = {
      title: title || undefined,
      description: description || undefined,
      color: parseInt(color.replace('#', ''), 16) || 0xe08a4e,
      footer: footer ? { text: footer } : undefined,
      image: normalizedImageUrl ? { url: normalizedImageUrl } : undefined,
      thumbnail: normalizedThumbUrl ? { url: normalizedThumbUrl } : undefined,
    };
    const advRes = buildAdvancedPayload(adv, t);
    if (advRes.error) { toast.error(advRes.error); return; }
    const advancedPayload = advRes.payload;
    const mentions = mentionRoleIds.map((id) => `<@&${id}>`).join(' ');
    const finalContent = mentions ? `${mentions}${content.trim() ? ` ${content}` : ''}` : content;
    setBusy(true);
    const r = await fetch(`/api/guilds/${guildId}/embeds/send`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel_id: channelId, content: finalContent, embed, mention_role_ids: mentionRoleIds, ...(advancedPayload ? { advanced: advancedPayload } : {}) }),
    });
    setBusy(false);
    if (r.ok) {
      toast.success(t('sentSuccess'));
      setCooldown(30);
    } else {
      const d = await r.json().catch(() => ({}));
      if (d.error === 'embed_cooldown') setCooldown(Number(d.retry_after) || 30);
      toast.error(t('sendFailed'), { description: d.detail || d.error || '' });
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader title={t('title')} description={t('description')} />
      <div className="grid xl:grid-cols-[1.05fr_.95fr] gap-6 items-start">
        <Card className="p-4 sm:p-6 space-y-3 bg-card/60">
          <AdvancedModeToggle adv={adv} t={t} />
          <div>
            <Label>{t('channelLabel')}</Label>
            <ChannelSelect value={channelId} onChange={setChannelId} channels={meta.channels} includeNone={false} />
          </div>
          <div><div className="flex items-center gap-1.5 mb-1"><Label className="mb-0">{t('textAboveLabel')}</Label><InfoHint>{t('textAboveLabelHint')}</InfoHint></div><Input value={content} onChange={(e) => setContent(e.target.value)} /></div>
          <div>
            <div className="flex items-center gap-1.5 mb-1"><Label className="mb-0">{t('tagRolesLabel')}</Label><InfoHint>{t('tagRolesDesc')}</InfoHint></div>
            <RoleMultiSelect value={mentionRoleIds} onChange={setMentionRoleIds} roles={meta.roles} placeholder={t('noRolesTagged')} />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div><div className="flex items-center gap-1.5 mb-1"><Label className="mb-0">{t('titleLabel')}</Label><InfoHint>{t('titleLabelHint')}</InfoHint></div><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
            <div><Label>{t('colorLabel')}</Label><Input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 w-16 p-1 cursor-pointer" /></div>
          </div>
          <div><div className="flex items-center gap-1.5 mb-1"><Label className="mb-0">{t('descriptionLabel')}</Label><InfoHint>{t('descriptionLabelHint')}</InfoHint></div><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={5} /></div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div><Label>{t('footerLabel')}</Label><Input value={footer} onChange={(e) => setFooter(e.target.value)} /></div>
            <div><div className="flex items-center gap-1.5 mb-1"><Label className="mb-0">{t('imageUrlLabel')}</Label><InfoHint>{t('imageUrlHint')}</InfoHint></div><Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} /></div>
          </div>
          <div><div className="flex items-center gap-1.5 mb-1"><Label className="mb-0">{t('thumbnailUrlLabel')}</Label><InfoHint>{t('thumbnailUrlHint')}</InfoHint></div><Input value={thumbUrl} onChange={(e) => setThumbUrl(e.target.value)} /></div>
          {advanced && <AdvancedFields adv={adv} t={t} />}
          <div className="flex flex-wrap items-center gap-3">
            <Button className="gradient-primary" onClick={send} disabled={busy || cooldown > 0}>
              {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <MessageSquare className="w-4 h-4 mr-1" />}
              {cooldown > 0 ? t('waitSeconds', { seconds: cooldown }) : t('sendToDiscord')}
            </Button>
            <span className="text-xs text-muted-foreground">{t('rateLimitNote')}</span>
          </div>
        </Card>

        <Card className="p-5 bg-card/60 xl:sticky xl:top-6">
          <div className="flex items-center justify-between mb-4">
            <div><div className="font-semibold">{t('livePreview')}</div><div className="text-xs text-muted-foreground">{t('livePreviewUpdates')}</div></div>
            <Badge variant="outline">{t('embedBadge')}</Badge>
          </div>
          {(() => {
            const pingLine = [mentionRoleIds.map((id) => roleName(meta, id)).filter(Boolean).map((n) => `@${n}`).join(' '), content.trim() ? content : ''].filter(Boolean).join(' ');
            const hasEmbed = Boolean(title.trim() || description.trim() || footer.trim() || imageUrl.trim() || thumbUrl.trim() || (advanced && (adv.authorName.trim() || previewFields(adv).length)));
            if (!pingLine && !hasEmbed) return <div className="rounded-2xl border border-dashed border-[#2b2d31] p-6 text-center text-xs text-muted-foreground">{t('nothingToPreview')}</div>;
            return (
              <DiscordMessage>
                {pingLine ? <DiscordText>{pingLine}</DiscordText> : null}
                <EmbedPreview accentColor={color || '#e08a4e'} title={title} description={description} footer={footer} imageUrl={imageUrl.trim() || null} thumbnailUrl={thumbUrl.trim() || null} authorName={advanced ? adv.authorName.trim() : ''} fields={previewFields(adv)} buttons={previewButtons(adv)} />
              </DiscordMessage>
            );
          })()}
        </Card>
      </div>
    </div>
  );
}

const LEVEL_CARD_PRESETS = {
  compact:  { w: 800,  h: 420, pad: 54, avatar: 200, name: 48, small: 28, rank: 22, bar: 32, labelGap: 76, rankGap: 34, textGap: 56 },
  balanced: { w: 900,  h: 300, pad: 36, avatar: 150, name: 36, small: 22, rank: 18, bar: 22, labelGap: 56, rankGap: 26, textGap: 42 },
  banner:   { w: 1000, h: 210, pad: 22, avatar: 110, name: 28, small: 17, rank: 14, bar: 15, labelGap: 38, rankGap: 17, textGap: 30 },
};

const AURORA_GRADIENTS = {
  ember:    [['#1a0905', '#5a1f0a', '#c4622a'], ['#f2a65a', '#7c3010'], '#ffb26b'],
  aurora:   [['#06141b', '#0b3d3a', '#1d6b5f'], ['#3ef2b0', '#7b5cff'], '#4cf0b8'],
  sunset:   [['#2a0b2e', '#a8326a', '#ff8a4c'], ['#ffcf6e', '#ff4f8b'], '#ffd27a'],
  ocean:    [['#04142e', '#0b3a75', '#1f7ad1'], ['#5ee0ff', '#2a4bff'], '#6fe3ff'],
  neon:     [['#12002b', '#3b0a7a', '#8a1fd1'], ['#ff3ec8', '#3e8bff'], '#ff6ad5'],
  royal:    [['#0b0f1f', '#1d2547', '#3a2f6b'], ['#e9c46a', '#6c5ce7'], '#f4d27a'],
  forest:   [['#05170f', '#0f3d27', '#2f7a4a'], ['#a8e063', '#1fa37a'], '#b8f27c'],
  midnight: [['#050507', '#14141c', '#2a2a38'], ['#8a8aa8', '#c46a2d'], '#e08a4e'],
  coast:    [['#1a0b3b', '#8a2a7a', '#ff5e8a'], ['#ffb36b', '#7a3cff'], '#ffb36b'],
  dusk:     [['#0b1f2e', '#1d4f5e', '#e8744f'], ['#5ff0d0', '#ff9a5a'], '#5ff0d0'],
  skyline:  [['#0a0620', '#2b1458', '#ff6a7a'], ['#ffc46b', '#5b3cff'], '#ffc46b'],
  miami:    [['#1a0b3b', '#8a2a7a', '#ff5e8a'], ['#3ee0ff', '#ff9ad5'], '#3ee0ff'],
};
const SPECIAL_GRADIENTS = ['coast', 'dusk', 'skyline', 'miami'];
function AuroraScene({ kind }) {
  return <SvgScene kind={kind} />;
}
const auroraBackground = (key) => {
  const [stops, glows] = AURORA_GRADIENTS[key] || AURORA_GRADIENTS.ember;
  return `radial-gradient(60% 120% at 88% 5%, ${glows[0]}78, transparent 60%), radial-gradient(45% 110% at 12% 100%, ${glows[1]}6b, transparent 60%), linear-gradient(105deg, ${stops[0]}, ${stops[1]} 50%, ${stops[2]})`;
};

function AuroraCardPreview({ fontId, gradient, backgroundUrl, previewBackgroundUrl, overlayColor, overlayOpacity, textColor, accentColor, ring, avatarSrc, name = 'Member', level = 12, xpText = '429 / 1337 XP', percent = 32, rank = 3 }) {
  const W = 934;
  const u = (v) => `${(v / W) * 100}cqw`;
  const useImage = Boolean(backgroundUrl);
  const accent = useImage ? accentColor : (AURORA_GRADIENTS[gradient] || AURORA_GRADIENTS.ember)[2];
  const pad = 30; const avatar = 282 - pad * 2 - 12; const ax = pad + 6; const ay = (282 - avatar) / 2;
  const px0 = ax + avatar + 30; const inner = 24;
  return (
    <div className="relative w-full overflow-hidden select-none" style={{ aspectRatio: '934/282', containerType: 'inline-size', background: useImage ? '#000' : auroraBackground(gradient), ...cardFontStyle(fontId) }}>
      {useImage && <PreviewImage url={previewBackgroundUrl} alt="" className="absolute inset-0 h-full w-full object-cover" draggable="false" />}
      {useImage && <div className="absolute inset-0" style={{ backgroundColor: overlayColor, opacity: overlayOpacity / 100 }} />}
      {!useImage && SPECIAL_GRADIENTS.includes(gradient) && <AuroraScene kind={gradient} />}
      {!useImage && <div className="absolute inset-0 opacity-[0.07] [background-image:radial-gradient(#fff_1px,transparent_1px)]" style={{ backgroundSize: u(13) + ' ' + u(13) }} />}
      <img src={avatarSrc} alt="" draggable="false" className="absolute rounded-full object-cover"
        style={{ left: u(ax), top: u(ay), width: u(avatar), height: u(avatar), boxShadow: ring ? `0 0 0 ${u(6)} ${accent}, 0 0 ${u(30)} ${accent}aa` : undefined }} />
      <div className="absolute" style={{ left: u(px0), right: u(pad), top: u(pad), bottom: u(pad), borderRadius: u(22), background: 'rgba(8,6,12,.47)', border: `${u(1.5)} solid rgba(255,255,255,.13)` }}>
        <div className="absolute flex items-start justify-between gap-[2cqw]" style={{ left: u(inner), right: u(inner), top: u(inner - 2) }}>
          <span className="min-w-0 truncate font-bold leading-tight" style={{ color: textColor, fontSize: u(name.length > 22 ? 26 : 42), textShadow: '0 1px 3px rgba(0,0,0,.6)' }}>{name}</span>
          <span className="shrink-0 rounded-full font-bold leading-none" style={{ background: accent, color: '#120c0a', fontSize: u(20), padding: `${u(7)} ${u(14)}` }}>RANK #{rank}</span>
        </div>
        <div className="absolute inline-flex items-center font-bold leading-none" style={{ left: u(inner), top: u(inner + 62), gap: u(10), padding: `${u(10)} ${u(14)}`, borderRadius: u(10), background: 'rgba(255,255,255,.1)', border: `${u(1.5)} solid ${accent}a0` }}>
          <span style={{ color: accent, fontSize: u(15), letterSpacing: '0.04em' }}>LEVEL</span><span style={{ color: textColor, fontSize: u(26) }}>{level}</span>
        </div>
        <div className="absolute flex items-end justify-between leading-none" style={{ left: u(inner), right: u(inner), bottom: u(inner + 26 + 10) }}>
          <span style={{ color: textColor, opacity: 0.8, fontSize: u(17) }}>{percent}% to level {level + 1}</span>
          <span className="font-bold" style={{ color: textColor, fontSize: u(22) }}>{xpText}</span>
        </div>
        <div className="absolute overflow-hidden" style={{ left: u(inner), right: u(inner), bottom: u(inner), height: u(26), borderRadius: u(13), background: 'rgba(0,0,0,.43)', border: '1px solid rgba(255,255,255,.12)' }}>
          <div className="h-full" style={{ width: `${percent}%`, minWidth: u(26), borderRadius: u(13), background: `linear-gradient(90deg, ${accent}, ${accent}cc 40%, #ffffffb0)`, boxShadow: `0 0 ${u(14)} ${accent}` }} />
        </div>
      </div>
    </div>
  );
}

function LevelCardPreview({ fontId, size, overlayColor, overlayOpacity, backgroundUrl, previewBackgroundUrl, textColor, accentColor, ring, bold, avatarSrc, name = 'Member', level = 12, rankText, progressText, xpText = '429 / 1337 XP', percent = 32 }) {
  const g = LEVEL_CARD_PRESETS[size] || LEVEL_CARD_PRESETS.compact;
  const u = (v) => `${(v / g.w) * 100}cqw`;
  const ringRoom = ring ? 8 : 0;
  const labelY = g.h - g.pad - g.bar - g.labelGap;
  const rankY = labelY + g.rankGap;
  const minGap = Math.max(10, Math.floor(g.labelGap / 4));
  const avatar = Math.max(40, Math.min(g.avatar, labelY - g.pad - ringRoom - minGap));
  const ax = g.pad + ringRoom;
  const tx = ax + avatar + ringRoom + g.textGap;
  const weight = bold ? 700 : 500;
  const shadow = '0 0 0.15em rgba(0,0,0,.75), 0 0.04em 0.12em rgba(0,0,0,.6)';

  const boxRef = useRef(null);
  const textRef = useRef(null);
  const [k, setK] = useState(1);
  useLayoutEffect(() => {
    const box = boxRef.current;
    const text = textRef.current;
    if (!box || !text) return undefined;
    const fit = () => {
      text.style.transform = 'none';
      const avail = box.clientWidth;
      const need = text.scrollWidth;
      if (!avail || !need) return;
      setK(Math.max(0.35, Math.min(1, avail / need)));
    };
    fit();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null;
    if (ro) ro.observe(box);
    return () => { if (ro) ro.disconnect(); };
  }, [name, level, size, ring, bold]);

  return (
    <div className="w-full relative overflow-hidden select-none" style={{ backgroundColor: overlayColor, aspectRatio: `${g.w}/${g.h}`, containerType: 'inline-size', ...cardFontStyle(fontId) }}>
      {backgroundUrl && <PreviewImage url={previewBackgroundUrl} alt="" className="absolute inset-0 w-full h-full object-cover" draggable="false" />}
      <div className="absolute inset-0" style={{ backgroundColor: overlayColor, opacity: overlayOpacity / 100 }} />
      <img src={avatarSrc} alt="" className="absolute rounded-full object-cover" draggable="false"
        style={{ left: u(ax), top: u(g.pad), width: u(avatar), height: u(avatar), boxShadow: ring ? `0 0 0 ${u(8)} ${accentColor}, 0 0 ${u(24)} ${accentColor}88` : undefined }} />
      <div ref={boxRef} className="absolute flex items-center overflow-hidden"
        style={{ left: u(tx), right: u(g.pad), top: u(g.pad), height: u(avatar) }}>
        <div ref={textRef} className="whitespace-nowrap leading-none" style={{ fontSize: `calc(${u(g.name)} * ${k})`, fontWeight: weight, textShadow: shadow }}>
          <span style={{ color: textColor }}>{name}</span><span style={{ color: accentColor }}> - Level {level}</span>
        </div>
      </div>
      <div className="absolute flex justify-between leading-none whitespace-nowrap" style={{ left: u(g.pad), right: u(g.pad), top: u(labelY), fontSize: u(g.small), color: textColor, fontWeight: weight, textShadow: shadow }}>
        <span>{progressText}</span><span>{xpText}</span>
      </div>
      <div className="absolute leading-none whitespace-nowrap text-right" style={{ right: u(g.pad), top: u(rankY), fontSize: u(g.rank), color: accentColor, fontWeight: weight, textShadow: shadow }}>{rankText}</div>
      <div className="absolute overflow-hidden" style={{ left: u(g.pad), right: u(g.pad), top: u(g.h - g.pad - g.bar), height: u(g.bar), borderRadius: u(g.bar / 2), backgroundColor: 'rgba(0,0,0,.35)' }}>
        <div className="h-full" style={{ width: `${percent}%`, borderRadius: u(g.bar / 2), backgroundColor: accentColor }} />
      </div>
    </div>
  );
}

function LevelsPanel({ guildId, meta }) {
  const t = useTranslations('guildSettings.levels');
  const tc = useTranslations('guildSettings.common');
  const tm = useTranslations('guildSettings.levelsCard');
  const locale = useLocale();
  const [data, setData] = useState(null);
  const { data: settings, setData: setSettings, save, saving, dirty, discard, rights, setRights } = useModule(guildId, 'settings');
  useEffect(() => { safeJson(`/api/guilds/${guildId}/levels`, {}).then(setData); }, [guildId]);
  const [savedFormat, setSavedFormat] = useState(null);
  const [savedCardSize, setSavedCardSize] = useState(null);
  useEffect(() => {
    if (settings && savedFormat === null) {
      const stored = settings.level_message_format || 'legacy';
      setSavedFormat(stored === 'legacy' ? 'card' : stored);
    }
    if (settings && savedCardSize === null) {
      setSavedCardSize(settings.level_card_size || 'compact');
    }
  }, [settings, savedFormat, savedCardSize]);
  if (!data || !settings) return <Skeleton />;
  const leaderboard = Array.isArray(data.leaderboard) ? data.leaderboard : [];

  const levelEnabled = true;
  const storedFormat = settings.level_message_format || 'legacy';
  const messageFormat = storedFormat === 'legacy' ? 'card' : storedFormat;
  const backgroundUrl = settings.level_card_background_url || '';
  const previewBackgroundUrl = resolvePreviewUrl(backgroundUrl);
  const overlayColor = settings.level_card_overlay_color || '#111827';
  const overlayOpacity = Number(settings.level_card_overlay_opacity ?? 55);
  const textColor = settings.level_card_text_color || '#ffffff';
  const accentColor = settings.level_card_color || '#57F287';
  const cardSize = settings.level_card_size || 'compact';
  const CARD_SIZE_ASPECT = { compact: '1.9/1', balanced: '3/1', banner: '4.76/1', aurora: '3.31/1' };
  const CARD_SIZE_DIMENSIONS = { compact: '1200×630', balanced: '900×300', banner: '1000×210', aurora: '934×282' };
  const cardGradient = AURORA_GRADIENTS[settings.level_card_gradient] ? settings.level_card_gradient : 'ember';
  const cardAspect = CARD_SIZE_ASPECT[cardSize] || CARD_SIZE_ASPECT.compact;
  const levelImageMode = settings.level_image_mode || (settings.level_image_url ? 'custom' : 'none');
  const levelEmbedPreviewImage = levelImageMode === 'server_avatar'
    ? (meta.guild.icon ? discordCdnUrl(`https://cdn.discordapp.com/icons/${meta.guild.id}/${meta.guild.icon}.png?size=256`) : null)
    : levelImageMode === 'member_avatar'
      ? discordCdnUrl('https://cdn.discordapp.com/embed/avatars/0.png')
      : levelImageMode === 'custom' && settings.level_image_url ? resolvePreviewUrl(settings.level_image_url) : null;
  const previewAvatar = discordCdnUrl('https://cdn.discordapp.com/embed/avatars/0.png');
  const replacePreview = (text) => String(text || '')
    .replaceAll('{user}', '@Member')
    .replaceAll('{user.mention}', '@Member')
    .replaceAll('{user.name}', 'Member')
    .replaceAll('{level}', '12')
    .replaceAll('{guild.name}', meta.guild.name || 'Your Server');
  const levelPreviewText = replacePreview(settings.level_message || '🎉 {user.mention} reached **level {level}**!');
  const setFormat = (format) => setSettings({ ...settings, level_message_format: format });
  const savePayload = {
    level_channel_id: settings.level_channel_id,
    level_message: settings.level_message, level_up_embed: settings.level_up_embed,
    level_ignored_channel_ids: settings.level_ignored_channel_ids || [],
    level_channel_multipliers: settings.level_channel_multipliers || {},
    level_rewards: Array.isArray(settings.level_rewards) ? settings.level_rewards : [],
    level_role_bonuses: Array.isArray(settings.level_role_bonuses) ? settings.level_role_bonuses : [],
  };
  const levelCardKeys = ['level_message_format', 'level_card_background_url', 'level_card_overlay_color', 'level_card_overlay_opacity', 'level_card_text_color', 'level_card_color', 'level_card_avatar_ring', 'level_card_font', 'level_card_size', 'level_card_gradient', 'level_image_mode', 'level_image_url', 'level_use_member_profile'];
  for (const key of levelCardKeys) if (Object.prototype.hasOwnProperty.call(settings, key)) savePayload[key] = settings[key];
  if (!savePayload.level_message_format && levelCardKeys.some((key) => Object.prototype.hasOwnProperty.call(settings, key))) {
    savePayload.level_message_format = messageFormat;
  }

  return (
    <div className="space-y-6">
      <SectionHeader title={t('title')} description={t('description')} />
      {settings && hasUserImage(settings, window.location.host) ? <PolicyConsent ns="guildSettings.common" checked={rights} onChange={setRights} /> : null}
      <div className="grid xl:grid-cols-[minmax(0,1fr)_420px] gap-6 items-start">
        <div className="space-y-6">
          <Card className="p-6 bg-card/60 space-y-5">
            <FieldRow label={t('levelUpChannel')} hint={t('levelUpChannelHint')}><ChannelSelect value={settings.level_channel_id} onChange={(v) => setSettings({ ...settings, level_channel_id: v })} channels={meta.channels} disabled={!levelEnabled} /></FieldRow>
            <div>
              <div className="flex items-center gap-1.5"><Label className="mb-0">{t('messageFormat')}</Label>{storedFormat === 'legacy' && <InfoHint>{t('legacyFormatHint')}</InfoHint>}</div>
              <div className="grid sm:grid-cols-3 gap-3 mt-2">
                {[['plain', t('formatPlain'), t('formatPlainHint')], ['embed', t('formatEmbed'), t('formatEmbedHint')], ['card', t('formatCard'), t('formatCardHint')]].map(([mode, title, hint]) => (
                  <button key={mode} type="button" role="radio" aria-checked={messageFormat === mode} disabled={!levelEnabled} onClick={() => setFormat(mode)} className={`text-left rounded-xl border p-4 transition disabled:opacity-50 ${messageFormat === mode ? 'border-primary bg-primary/10 ring-1 ring-primary' : 'border-border hover:bg-secondary/40'}`}>
                    <div className="flex items-center flex-wrap gap-x-2.5 gap-y-1">
                      <div className="font-semibold text-sm break-words">{title}</div>
                      <span className="shrink-0 flex items-center gap-1.5">
                        {savedFormat === mode && <span className="rounded-full bg-primary/15 border border-primary/30 px-2 py-0.5 text-[10px] font-semibold text-primary whitespace-nowrap">{tc('active')}</span>}
                        {messageFormat === mode && savedFormat !== mode && <span className="rounded-full bg-secondary border border-border px-2 py-0.5 text-[10px] font-semibold text-muted-foreground whitespace-nowrap">{tc('unsaved')}</span>}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">{hint}</div>
                  </button>
                ))}
              </div>
            </div>
            <div><Label>{t('levelUpMessage')}</Label><Textarea rows={3} value={settings.level_message || ''} onChange={(e) => setSettings({ ...settings, level_message: e.target.value })} placeholder="🎉 {user.mention} reached **level {level}**!" disabled={!levelEnabled} /></div>
            <div><Label>{tc('variablesLabel')}</Label><div className="flex flex-wrap gap-2 mt-2">{['{user.name}', '{user.mention}', '{user}', '{level}', '{guild.name}'].map((v) => (<button key={v} type="button" disabled={!levelEnabled} onClick={() => setSettings({ ...settings, level_message: `${settings.level_message || ''}${settings.level_message ? ' ' : ''}${v}` })} className="rounded-full border border-border bg-secondary/50 px-2.5 py-1 text-xs hover:bg-secondary transition disabled:opacity-50">{v}</button>))}</div></div>
            <div><div className="flex items-center gap-1.5 mb-1"><Label className="mb-0">{t('blockedChannels')}</Label><InfoHint>{t('blockedChannelsHint')}</InfoHint></div><ChannelPickerList value={settings.level_ignored_channel_ids} onChange={(v) => setSettings({ ...settings, level_ignored_channel_ids: v })} channels={meta.channels} disabled={!levelEnabled} addLabel={t('noChannelsBlocked')} /></div>
            <div><div className="flex items-center gap-1.5 mb-1"><Label className="mb-0">{t('boostedChannels')}</Label><InfoHint>{t('boostedChannelsHint')}</InfoHint></div><ChannelMultiplierList value={settings.level_channel_multipliers} onChange={(v) => setSettings({ ...settings, level_channel_multipliers: v })} channels={meta.channels} disabled={!levelEnabled} addLabel={t('addBoostedChannel')} /></div>
          </Card>

          <LevelRewardsEditor rewards={settings.level_rewards} onChange={(v) => setSettings({ ...settings, level_rewards: v })} roles={meta.roles} />
          <RoleXpBonusesEditor bonuses={settings.level_role_bonuses} onChange={(v) => setSettings({ ...settings, level_role_bonuses: v })} roles={meta.roles} />

          {messageFormat === 'embed' && (
            <Card className="p-6 bg-card/60 space-y-5">
              <div><div className="font-semibold">{tc('imageLabel')}</div><div className="text-xs text-muted-foreground mt-1">{t('formatEmbedHint')}</div></div>
              <div><Label>{tc('imageLabel')}</Label><Select value={levelImageMode} onValueChange={(v) => setSettings({ ...settings, level_image_mode: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="member_avatar">{tc('memberAvatar')}</SelectItem><SelectItem value="server_avatar">{tc('serverAvatar')}</SelectItem><SelectItem value="custom">{tc('customImage')}</SelectItem><SelectItem value="none">{tc('noImage')}</SelectItem></SelectContent></Select></div>
              {levelImageMode === 'custom' && <div><div className="flex items-center gap-1.5 mb-1"><Label className="mb-0">{tc('imageUrlLabel')}</Label><InfoHint>{tc('imageUrlHint')}</InfoHint></div><div className="flex flex-col sm:flex-row gap-2"><Input className="sm:flex-1" value={settings.level_image_url || ''} onChange={(e) => setSettings({ ...settings, level_image_mode: e.target.value ? 'custom' : 'none', level_image_url: e.target.value || null })} placeholder="https://example.com/levelup.gif" /><PresetPicker category="welcome-background" onSelect={(url) => setSettings({ ...settings, level_image_mode: 'custom', level_image_url: url })} /></div><ImageHostingTip /></div>}
            </Card>
          )}

          {messageFormat === 'card' && (
            <Card className="p-6 bg-card/60 space-y-5">
              <div><div className="font-semibold">{t('customizeCard')}</div><div className="text-xs text-muted-foreground mt-1">{t('customizeCardHint')}</div></div>
              <div><div className="flex items-center gap-1.5 mb-1"><Label className="mb-0">{t('backgroundImage')}</Label><InfoHint>{t('backgroundImageHint')}</InfoHint></div><div className="flex flex-col sm:flex-row gap-2"><Input className="sm:flex-1" value={backgroundUrl} onChange={(e) => setSettings({ ...settings, level_card_background_url: e.target.value || null })} placeholder="https://example.com/background.jpg" /><PresetPicker category="level-card-background" label={t('minimalistPresets')} onSelect={(url) => setSettings({ ...settings, level_card_background_url: url, level_card_text_color: '#ffffff' })} /><PresetPicker category="welcome-background" onSelect={(url) => setSettings({ ...settings, level_card_background_url: url })} /></div><ImageHostingTip /></div>
              <div>
                <div className="flex items-center gap-1.5 mb-1"><Label className="mb-0">{t('cardSize')}</Label><InfoHint>{t('cardSizeHint')}</InfoHint></div>
                <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
                  {[
                    ['compact', t('cardSizeCompact'), t('cardSizeCompactHint')],
                    ['balanced', t('cardSizeBalanced'), t('cardSizeBalancedHint')],
                    ['banner', t('cardSizeBanner'), t('cardSizeBannerHint')],
                    ['aurora', t('cardSizeAurora'), t('cardSizeAuroraHint')],
                  ].map(([key, title, hint]) => (
                    <button key={key} type="button" role="radio" aria-checked={cardSize === key} onClick={() => setSettings({ ...settings, level_card_size: key })} className={`text-left rounded-xl border p-3 transition flex flex-col h-full ${cardSize === key ? 'border-primary bg-primary/10 ring-1 ring-primary' : 'border-border hover:bg-secondary/40'}`}>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <div className="font-semibold text-sm">{title}</div>
                        {savedCardSize != null && savedCardSize === key && <span className="rounded-full bg-primary/15 border border-primary/30 px-2 py-0.5 text-[10px] font-semibold text-primary whitespace-nowrap">{tc('active')}</span>}
                        {savedCardSize != null && cardSize === key && savedCardSize !== key && <span className="rounded-full bg-secondary border border-border px-2 py-0.5 text-[10px] font-semibold text-muted-foreground whitespace-nowrap">{tc('unsaved')}</span>}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">{hint}</div>
                      <div className="text-[11px] text-muted-foreground/70 mt-auto pt-1.5 font-mono">{CARD_SIZE_DIMENSIONS[key]}</div>
                    </button>
                  ))}
                </div>
              </div>
              {cardSize === 'aurora' && <AuroraGradientPicker value={cardGradient} onChange={(v) => setSettings({ ...settings, level_card_gradient: v })} hasImage={Boolean(backgroundUrl)} onClearImage={() => setSettings({ ...settings, level_card_background_url: null })} />}
              <div className="grid sm:grid-cols-2 gap-4">
                <CardFontPicker allowBold value={settings.level_card_font} onChange={(v) => setSettings({ ...settings, level_card_font: v })} />
                <div className="flex items-end"><FieldRow label={t('avatarRing')}><Switch checked={settings.level_card_avatar_ring !== false} onCheckedChange={(v) => setSettings({ ...settings, level_card_avatar_ring: v })} /></FieldRow></div>
              </div>
              <div className="rounded-xl border border-border p-3">
                <FieldRow label={tm('useMemberProfile')} hint={tm('useMemberProfileHint')}><Switch checked={settings.level_use_member_profile === true} onCheckedChange={(v) => setSettings({ ...settings, level_use_member_profile: v })} /></FieldRow>
                <div className="mt-3"><HintLink href="/profile?tab=card" icon={IdCard}>{tm('useMemberProfileLink')}</HintLink></div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div><Label>{t('mainColor')}</Label><div className="flex gap-2"><Input type="color" className="w-14 p-1 h-10" value={accentColor} onChange={(e) => setSettings({ ...settings, level_card_color: e.target.value })} /><Input value={accentColor} onChange={(e) => setSettings({ ...settings, level_card_color: e.target.value })} /></div></div>
                <div><Label>{t('textColor')}</Label><div className="flex gap-2"><Input type="color" className="w-14 p-1 h-10" value={textColor} onChange={(e) => setSettings({ ...settings, level_card_text_color: e.target.value })} /><Input value={textColor} onChange={(e) => setSettings({ ...settings, level_card_text_color: e.target.value })} /></div></div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div><Label>{t('overlayColor')}</Label><div className="flex gap-2"><Input type="color" className="w-14 p-1 h-10" value={overlayColor} onChange={(e) => setSettings({ ...settings, level_card_overlay_color: e.target.value })} /><Input value={overlayColor} onChange={(e) => setSettings({ ...settings, level_card_overlay_color: e.target.value })} /></div></div>
                <div><div className="flex justify-between mb-2"><Label>{t('overlayOpacity')}</Label><span className="text-xs text-muted-foreground">{overlayOpacity}%</span></div><input className="w-full accent-primary" type="range" min="0" max="100" value={overlayOpacity} onChange={(e) => setSettings({ ...settings, level_card_overlay_opacity: Number(e.target.value) })} /></div>
              </div>
            </Card>
          )}
          <SaveBar saving={saving} dirty={dirty} onDiscard={discard} onSave={async () => { const issue = levelRulesIssue(settings, meta.roles); if (issue) { toast.error(t(issue)); return; } const ok = await save(savePayload); if (ok) { setSavedFormat(messageFormat); setSavedCardSize(cardSize); } }} />
          <Card className="p-6 bg-card/60">
            <div className="font-semibold mb-3">{t('leaderboardTitle')}</div>
            {leaderboard.length === 0 ? <Empty text={t('noXpData')} /> : <div className="space-y-1">{leaderboard.map((u, i) => <div key={u._id} className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-secondary/30"><div className="text-sm"><span className="text-muted-foreground w-8 inline-block">#{i + 1}</span> {u.user_name || t('unknownUser')}</div><div className="text-sm"><span className="text-primary font-semibold">{t('levelAbbrev')} {u.level}</span> · {u.xp} XP</div></div>)}</div>}
          </Card>
        </div>
        <div className="space-y-6 xl:sticky xl:top-6">
          <Card className="p-5 bg-card/60">
            <div className="flex items-center justify-between mb-4"><div><div className="font-semibold">{tc('livePreview')}</div><div className="text-xs text-muted-foreground">{tc('updatesInstantly')}</div></div><Badge variant="outline">{t('previewBadge')}</Badge></div>
            <DiscordMessage>
              {messageFormat === 'plain' ? (
                <>
                  <DiscordText>{levelPreviewText}</DiscordText>
                  <DiscordButtons buttons={[{ label: 'Leaderboard', style: 'link' }]} />
                </>
              ) : messageFormat === 'embed' ? (
                <EmbedPreview
                  accentColor="#57F287"
                  title="🎉 Level up!"
                  description={levelPreviewText}
                  timestamp
                  imageUrl={levelEmbedPreviewImage || null}
                  imageAsThumbnail={levelImageMode !== 'custom'}
                  buttons={[{ label: 'Leaderboard', style: 'link' }]}
                />
              ) : (
                <EmbedPreview
                  accentColor={messageFormat === 'card' ? accentColor : '#57F287'}
                  title="🎉 Level up!"
                  description={levelPreviewText}
                  timestamp
                  buttons={[{ label: 'Leaderboard', style: 'link' }]}
                >
                  <div className="overflow-hidden rounded-[8px] max-w-[480px]">
                    {cardSize === 'aurora'
                      ? <AuroraCardPreview fontId={settings.level_card_font} gradient={cardGradient} backgroundUrl={backgroundUrl} previewBackgroundUrl={previewBackgroundUrl} overlayColor={overlayColor} overlayOpacity={overlayOpacity} textColor={textColor} accentColor={accentColor} ring={settings.level_card_avatar_ring !== false} avatarSrc={previewAvatar} />
                      : <LevelCardPreview fontId={settings.level_card_font} size={cardSize} overlayColor={overlayColor} overlayOpacity={overlayOpacity} backgroundUrl={backgroundUrl} previewBackgroundUrl={previewBackgroundUrl} textColor={textColor} accentColor={accentColor} ring={settings.level_card_avatar_ring !== false} bold={settings.level_card_font === 'bold' || Boolean(CARD_FONTS.find((f) => f.id === settings.level_card_font)?.bold)} avatarSrc={previewAvatar} rankText={t('previewRank')} progressText={t('previewProgress')} />}
                  </div>
                </EmbedPreview>
              )}
            </DiscordMessage>
          </Card>
        </div>
      </div>
    </div>
  );
}

function SuggestionsPanel({ guildId, meta }) {
  const t = useTranslations('guildSettings.suggestions');
  const [items, setItems] = useState(null);
  const { data: settings, setData: setSettings, save, saving, dirty, discard } = useModule(guildId, 'settings');
  useEffect(() => { safeJson(`/api/guilds/${guildId}/suggestions`, {}).then((d) => setItems(d.items || [])); }, [guildId]);
  if (!items || !settings) return <Skeleton />;
  return (
    <div className="space-y-6">
      <SectionHeader title={t('title')} description={t('description')} />
      <Card className="p-4 sm:p-6 space-y-5 bg-card/60">
        <FieldRow label={t('suggestionsChannel')}>
          <ChannelSelect value={settings.suggestion_channel_id} onChange={(v) => setSettings({ ...settings, suggestion_channel_id: v })} channels={meta.channels} />
        </FieldRow>
        <SaveBar saving={saving} dirty={dirty} onDiscard={discard} onSave={() => save({ suggestion_channel_id: settings.suggestion_channel_id })} />
      </Card>
      <Card className="p-6 bg-card/60">
        <div className="font-semibold mb-3">{t('recentSuggestions')}</div>
        {(() => {
          const valid = items.filter((s) => (s.content || s.text || '').trim());
          if (valid.length === 0) return <Empty text={t('noSuggestionsYet')} />;
          const statusLabels = { approved: t('statusApproved'), denied: t('statusDenied'), pending: t('statusPending') };
          return (
            <div className="space-y-2">
              {valid.map((s) => {
                const status = s.status || 'pending';
                const badge = status === 'approved'
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                  : status === 'denied'
                    ? 'bg-red-500/15 text-red-400 border-red-500/30'
                    : 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30';
                return (
                  <div key={s._id} className="rounded-lg border border-border/50 p-3 flex items-start justify-between gap-3">
                    <div className="text-sm">{s.content || s.text}</div>
                    <span className={`shrink-0 text-[10px] font-medium uppercase tracking-wide border rounded-full px-2 py-0.5 ${badge}`}>
                      {statusLabels[status] || status}
                    </span>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </Card>
    </div>
  );
}

function BackupsPanel({ guildId }) {
  const t = useTranslations('guildSettings.backups');
  const [data, setData] = useState(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    safeJson(`/api/guilds/${guildId}/backups`, {}).then(setData);
  }, [guildId]);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!data) return <Skeleton />;
  const backups = Array.isArray(data.backups) ? data.backups : [];

  const nextAllowed = data.next_allowed_at ? new Date(data.next_allowed_at) : null;
  const remainingMs = nextAllowed ? nextAllowed.getTime() - now : 0;
  const onCooldown = remainingMs > 0;

  function fmtRemaining(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const days = Math.floor(total / 86400);
    const hours = Math.floor((total % 86400) / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    return `${days}d ${hours}h ${minutes}m ${seconds}s`;
  }

  return (
    <div className="space-y-6">
      <SectionHeader title={t('title')} description={t('description')} />

      <Card className="p-6 bg-card/60">
        <div className="flex items-center gap-3 mb-2">
          <Archive className="w-5 h-5 text-[#e08a4e]" />
          <div className="font-semibold">{t('nextBackup')}</div>
        </div>
        {onCooldown ? (
          <div className="text-sm text-muted-foreground">
            {t.rich('onCooldown', {
              remaining: fmtRemaining(remainingMs),
              time: (chunks) => <span className="font-mono text-foreground">{chunks}</span>,
              code: (chunks) => <code>{chunks}</code>,
            })}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">
            {t.rich('availableNow', { code: (chunks) => <code>{chunks}</code> })}
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-3">
          {t.rich('backupsNote', { code: (chunks) => <code>{chunks}</code> })}
        </p>
      </Card>

      <Card className="p-6 bg-card/60">
        <div className="font-semibold mb-3">{t('recentBackups', { count: backups.length })}</div>
        {backups.length === 0 ? (
          <Empty text={t.rich('noBackupsYet', { code: (chunks) => <code>{chunks}</code> })} />
        ) : (
          <div className="space-y-2">
            {backups.map((b) => (
              <div key={b._id} className="rounded-lg border border-border/50 p-3 text-sm flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <span>{new Date(b.created_at).toLocaleString()}</span>
                <span className="text-xs text-muted-foreground">{t('byName', { name: b.created_by_name || b.created_by })}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

const ytFormat = (v) => (v === 'plain' ? 'plain' : 'embed');

function youtubeDraftFrom(settings) {
  const s = settings || {};
  const has = (k) => Object.prototype.hasOwnProperty.call(s, k);
  const video = {
    format: ytFormat(s.message_format),
    role: s.mention_role_id ? String(s.mention_role_id) : null,
    message: s.message ?? '',
  };
  return {
    channel_id: s.channel_id ? String(s.channel_id) : null,
    notify_videos: s.notify_videos !== false,
    notify_live: s.notify_live !== false,
    video,
    live: {
      format: has('live_message_format') ? ytFormat(s.live_message_format) : video.format,
      role: has('live_mention_role_id') ? (s.live_mention_role_id ? String(s.live_mention_role_id) : null) : video.role,
      message: has('live_message') ? (s.live_message ?? '') : video.message,
    },
  };
}

function ytCleanTitle(raw) {
  return String(raw || '')
    .replace(/(^|\s)#[^\s#]+/g, ' ')
    .replace(/\s*\|+\s*/g, '  ·  ')
    .replace(/\s*[\u2012\u2013\u2014\u2015\u2212]\s*/g, ' - ')
    .replace(/[*_~`>[\]\\]/g, '')
    .replace(/[ \t ]+/g, ' ')
    .trim();
}

function YoutubeNotificationPreview({ kind, cfg, roleName, channelTitle }) {
  const isLive = kind === 'live';
  const videoTitle = isLive ? 'Live Q&A with the community' : 'My best setup tour yet';
  const videoUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
  const lines = [];
  if (cfg.role) lines.push(`@${roleName || 'Role'}`);
  const custom = String(cfg.message || '')
    .replaceAll('{video_title}', ytCleanTitle(videoTitle))
    .replaceAll('{video_url}', '[▶️ Watch now](<https://youtu.be>)')
    .replaceAll('{channel_title}', channelTitle)
    .trim();
  if (custom) lines.push(custom);
  if (cfg.format === 'plain') {
    if (!custom) {
      lines.push(isLive
        ? `🔴 **${channelTitle}** is live now: **${ytCleanTitle(videoTitle)}**`
        : `📺 **${channelTitle}** uploaded a new video: **${ytCleanTitle(videoTitle)}**`);
    }
    lines.push(videoUrl);
    return (
      <DiscordMessage>
        <DiscordText>{lines.join('\n')}</DiscordText>
        <div className="pt-1"><YoutubeLinkUnfurl channelTitle={channelTitle} videoTitle={videoTitle} /></div>
      </DiscordMessage>
    );
  }
  const header = [
    isLive ? '-# 📺 YouTube  ·  🔴 LIVE now' : '-# 📺 YouTube  ·  🔴 New upload',
    `## ${isLive ? '🔴' : '🎬'} ${ytCleanTitle(videoTitle)}`,
    `👤 **${channelTitle}**  ·  🕒 <t:${Math.floor(Date.now() / 1000) - 120}:R>`,
  ].join('\n');
  return (
    <DiscordMessage>
      {lines.length ? <DiscordText>{lines.join('\n')}</DiscordText> : null}
      <V2Container accentColor="#ff0000">
        <DiscordText>{header}</DiscordText>
        <div className="relative aspect-video w-full overflow-hidden rounded-[8px] bg-gradient-to-br from-[#3a1010] via-[#1d1d1f] to-[#0f0f10]">
          <span className="absolute left-1/2 top-1/2 flex h-12 w-[68px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[14px] bg-[#ff0000]">
            <svg viewBox="0 0 24 24" className="ml-0.5 h-6 w-6 text-white" aria-hidden="true"><path fill="currentColor" d="M8 5v14l11-7z" /></svg>
          </span>
          {isLive ? <span className="absolute bottom-2 right-2 rounded bg-[#cc0000] px-1.5 py-0.5 text-[11px] font-bold text-white">LIVE</span> : <span className="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 text-[11px] font-medium text-white">12:48</span>}
        </div>
        <V2Separator />
        <DiscordText>-# 🔔 Wody · YouTube Notifications</DiscordText>
        <DiscordButtons buttons={[
          { label: isLive ? 'Watch live' : 'Watch on YouTube', emoji: '▶️', style: 'link' },
          { label: 'Open channel', emoji: '📺', style: 'link' },
        ]} />
      </V2Container>
    </DiscordMessage>
  );
}

function YoutubeNotifyPanel({ guildId, meta }) {
  const t = useTranslations('guildSettings.youtubeNotify');
  const tc = useTranslations('guildSettings.common');
  const [data, setData] = useState(null);
  const [saved, setSaved] = useState(null);
  const [draft, setDraft] = useState(null);
  const [savingChannel, setSavingChannel] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState(null);
  const [previewKind, setPreviewKind] = useState('video');

  function reload({ keepDraft = false } = {}) {
    return safeJson(`/api/guilds/${guildId}/youtube-notify`, null).then((d) => {
      setData(d);
      const fresh = youtubeDraftFrom(d?.settings);
      setSaved(fresh);
      if (!keepDraft) setDraft(fresh);
    });
  }
  useEffect(() => { reload(); }, [guildId]);

  const dirty = Boolean(draft && saved) && stableJson(draft) !== stableJson(saved);

  if (!data || !draft) return <Skeleton />;

  const premium = !!data.premium;
  const maxChannels = data.max_channels || 3;
  const channels = data.channels || [];
  const sampleChannel = channels[0]?.youtube_channel_title || 'Your Channel';
  const roleNameOf = (id) => (meta.roles || []).find((r) => String(r.id) === String(id))?.name;
  const setType = (kind, patch) => setDraft((d) => ({ ...d, [kind]: { ...d[kind], ...patch } }));

  async function saveSettings() {
    if (!draft.channel_id) { toast.error(t('pickChannelFirst')); return; }
    if (!draft.notify_videos && !draft.notify_live) { toast.error(t('errorNothingSelected')); return; }
    setSavingChannel(true);
    try {
      const res = await fetch(`/api/guilds/${guildId}/youtube-notify/discord-channel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel_id: draft.channel_id,
          notify_videos: draft.notify_videos,
          notify_live: draft.notify_live,
          message_format: draft.video.format,
          mention_role_id: draft.video.role,
          message: draft.video.message,
          live_message_format: draft.live.format,
          live_mention_role_id: draft.live.role,
          live_message: draft.live.message,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'save_failed');
      toast.success(t('channelSaved'));
      await reload();
    } catch (e) {
      toast.error(String(e?.message) === 'nothing_selected' ? t('errorNothingSelected') : t('couldNotSaveChannel'));
    } finally {
      setSavingChannel(false);
    }
  }

  async function removeDiscordChannel() {
    setSavingChannel(true);
    try {
      const res = await fetch(`/api/guilds/${guildId}/youtube-notify/discord-channel`, { method: 'DELETE' });
      if (!res.ok) throw new Error('failed');
      toast.success(t('channelRemovedAll'));
      await reload();
    } catch {
      toast.error(t('couldNotRemoveChannel'));
    } finally {
      setSavingChannel(false);
    }
  }

  async function addYoutubeChannel() {
    const url = newUrl.trim();
    if (!url) { toast.error(t('pasteUrlFirst')); return; }
    setAdding(true);
    try {
      const res = await fetch(`/api/guilds/${guildId}/youtube-notify/channels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const messages = {
          premium_required: t('errorPremiumRequired'),
          discord_channel_not_configured: t('errorSetChannelFirst'),
          channel_limit_reached: t('errorChannelLimit', { max: json.max || maxChannels }),
          already_watched: t('errorAlreadyWatched'),
          missing_url: t('pasteUrlFirst'),
          resolve_failed: json.message || t('errorResolveFailed'),
        };
        throw new Error(messages[json.error] || t('errorGeneric'));
      }
      if (json.warning) toast.warning(json.warning); else toast.success(t('channelAdded'));
      setNewUrl('');
      await reload({ keepDraft: true });
    } catch (e) {
      toast.error(String(e.message || e));
    } finally {
      setAdding(false);
    }
  }

  async function removeYoutubeChannel(id) {
    setRemovingId(id);
    try {
      const res = await fetch(`/api/guilds/${guildId}/youtube-notify/channels/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('failed');
      toast.success(t('channelRemoved'));
      await reload({ keepDraft: true });
    } catch {
      toast.error(t('couldNotRemoveThatChannel'));
    } finally {
      setRemovingId(null);
    }
  }

  const typeCard = (kind) => {
    const isLive = kind === 'live';
    const enabledKey = isLive ? 'notify_live' : 'notify_videos';
    const cfg = draft[kind];
    const savedCfg = saved?.[kind];
    const enabled = draft[enabledKey];
    return (
      <Card key={kind} className={`p-4 sm:p-6 space-y-5 bg-card/60 ${enabled ? '' : 'opacity-90'}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="font-semibold flex items-center gap-2">{isLive ? <Radio className="w-4 h-4 text-red-500" /> : <Youtube className="w-4 h-4 text-red-500" />}{isLive ? t('notifyLiveLabel') : t('notifyVideosLabel')}</div>
            <div className="text-xs text-muted-foreground mt-1">{isLive ? t('notifyLiveHint') : t('notifyVideosHint')}</div>
          </div>
          <Switch checked={enabled} onCheckedChange={(v) => setDraft((d) => ({ ...d, [enabledKey]: v }))} aria-label={isLive ? t('notifyLiveLabel') : t('notifyVideosLabel')} />
        </div>
        {enabled ? (
          <>
            <div>
              <div className="text-sm font-medium mb-2">{t('formatLabel')}</div>
              <MessageFormatSwitches
                mode={cfg.format}
                savedMode={saved?.[enabledKey] ? savedCfg?.format : null}
                onChange={(v) => setType(kind, { format: v })}
                options={[
                  { value: 'plain', label: t('formatPlainLabel'), desc: t('formatPlainDesc') },
                  { value: 'embed', label: t('formatEmbedLabel'), desc: t('formatEmbedDesc') },
                ]}
              />
            </div>
            <FieldRow label={t('mentionRoleLabel')} hint={t('mentionRoleHint')}>
              <RoleSelect value={cfg.role} onChange={(v) => setType(kind, { role: v })} roles={meta.roles} />
            </FieldRow>
            <div>
              <div className="flex items-center gap-1.5 mb-2"><Label className="mb-0">{t('customMessageLabel')}</Label><InfoHint>{t('customMessageHint')}</InfoHint></div>
              <Textarea
                rows={3}
                value={cfg.message}
                onChange={(e) => setType(kind, { message: e.target.value })}
                placeholder={isLive ? t('liveMessagePlaceholder') : t('customMessagePlaceholder')}
                maxLength={1800}
              />
              <div className="flex flex-wrap gap-2 mt-2">
                {['{video_title}', '{video_url}', '{channel_title}'].map((v) => (
                  <button key={v} type="button" onClick={() => setType(kind, { message: `${cfg.message || ''}${cfg.message ? ' ' : ''}${v}` })} className="rounded-full border border-border bg-secondary/50 px-2.5 py-1 text-xs font-mono hover:bg-secondary transition">{v}</button>
                ))}
              </div>
              {cfg.format === 'plain' && !String(cfg.message || '').trim() ? <p className="mt-2 text-xs text-muted-foreground">{t('defaultLineNote')}</p> : null}
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">{t('typeOffNote')}</p>
        )}
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <SectionHeader title={t('title')} description={t('description')} />

      {!premium ? (
        <Card className="p-6 bg-card/60 border-amber-500/30">
          <div className="flex items-center gap-3 mb-2">
            <Crown className="w-5 h-5 text-amber-400" />
            <div className="font-semibold">{t('premiumRequiredTitle')}</div>
          </div>
          <p className="text-sm text-muted-foreground">{t('premiumRequiredText')}</p>
        </Card>
      ) : (
        <div className="grid xl:grid-cols-[1.05fr_.95fr] gap-6 items-start">
          <div className="space-y-6 min-w-0">
            <Card className="p-4 sm:p-6 bg-card/60 space-y-4">
              <div>
                <div className="font-semibold">{t('notificationChannelTitle')}</div>
                <p className="text-xs text-muted-foreground mt-1">{t('notificationChannelNote')}</p>
              </div>
              <FieldRow label={t('discordChannelLabel')}>
                <ChannelSelect value={draft.channel_id} onChange={(v) => setDraft((d) => ({ ...d, channel_id: v }))} channels={meta.channels} />
              </FieldRow>
              {data.settings ? (
                <div className="flex justify-end">
                  <Button size="sm" variant="outline" onClick={removeDiscordChannel} disabled={savingChannel}>
                    <Trash2 className="w-4 h-4" /> {t('remove')}
                  </Button>
                </div>
              ) : null}
            </Card>

            {typeCard('video')}
            {typeCard('live')}
            {!draft.notify_videos && !draft.notify_live ? <p className="text-xs text-amber-400">{t('errorNothingSelected')}</p> : null}

            <SaveBar
              saving={savingChannel}
              dirty={dirty}
              onDiscard={() => setDraft(saved)}
              onSave={saveSettings}
              disabled={!draft.notify_videos && !draft.notify_live}
            />

            <Card className="p-4 sm:p-6 bg-card/60">
              <div className="flex items-center justify-between mb-3 gap-3">
                <div className="font-semibold">{t('watchedChannelsTitle')}</div>
                <Badge variant="outline">{channels.length} / {isUnlimited(maxChannels) ? '∞' : maxChannels}</Badge>
              </div>
              {!data.settings ? (
                <Empty text={t('setChannelFirst')} />
              ) : (
                <>
                  <div className="flex flex-col sm:flex-row gap-2 mb-4">
                    <Input
                      placeholder="https://www.youtube.com/@channel"
                      value={newUrl}
                      onChange={(e) => setNewUrl(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addYoutubeChannel(); } }}
                      disabled={adding || channels.length >= maxChannels}
                    />
                    <Button size="sm" className="h-10 sm:h-auto" onClick={addYoutubeChannel} disabled={adding || channels.length >= maxChannels}>
                      {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                      {t('add')}
                    </Button>
                  </div>
                  {channels.length === 0 ? (
                    <Empty text={t('noChannelsWatched')} />
                  ) : (
                    <div className="space-y-2">
                      {channels.map((c) => (
                        <div key={c._id} className="rounded-lg border border-border/50 p-3 text-sm flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <Youtube className="w-4 h-4 text-red-500 shrink-0" />
                            <a href={c.youtube_channel_url} target="_blank" rel="noopener noreferrer" className="truncate hover:underline">
                              {c.youtube_channel_title || c.youtube_channel_id}
                            </a>
                          </div>
                          <Button size="icon" variant="ghost" onClick={() => removeYoutubeChannel(c._id)} disabled={removingId === c._id} aria-label={t('remove')}>
                            {removingId === c._id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </Card>
          </div>

          <div className="space-y-4 xl:sticky xl:top-6 min-w-0">
            <Card className="p-4 sm:p-5 bg-card/60">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <div className="font-semibold">{tc('livePreview')}</div>
                  <div className="text-xs text-muted-foreground">{tc('updatesInstantly')}</div>
                </div>
                <div role="tablist" className="inline-flex rounded-lg border border-border bg-secondary/30 p-0.5 text-xs">
                  {['video', 'live'].map((k) => (
                    <button
                      key={k}
                      type="button"
                      role="tab"
                      aria-selected={previewKind === k}
                      onClick={() => setPreviewKind(k)}
                      className={`rounded-md px-3 py-1.5 font-medium transition ${previewKind === k ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                      {k === 'live' ? t('notifyLiveLabel') : t('notifyVideosLabel')}
                    </button>
                  ))}
                </div>
              </div>
              {draft[previewKind === 'live' ? 'notify_live' : 'notify_videos'] ? (
                <YoutubeNotificationPreview kind={previewKind} cfg={draft[previewKind]} roleName={roleNameOf(draft[previewKind].role)} channelTitle={sampleChannel} />
              ) : (
                <div className="rounded-2xl border border-dashed border-border/70 p-6 text-center text-xs text-muted-foreground">{t('typeOffNote')}</div>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

function TempVoicePanel({ guildId, meta }) {
  const t = useTranslations('guildSettings.tempVoice');
  const tc = useTranslations('guildSettings.common');
  const { data, setData, save, saving, dirty, discard } = useModule(guildId, 'settings');
  if (!data) return <Skeleton />;
  const limitValue = data.temp_voice_default_user_limit;
  return (
    <div className="space-y-6">
      <SectionHeader title={t('title')} description={t('description')} />
      <Card className="p-4 sm:p-6 space-y-5 bg-card/60">
        <FieldRow label={t('hubChannelLabel')} hint={t('hubChannelHint')}>
          <ChannelSelect value={data.temp_voice_hub_channel_id} onChange={(v) => setData({ ...data, temp_voice_hub_channel_id: v })} channels={meta.channels} types={[2]} />
        </FieldRow>
        <FieldRow label={t('categoryLabel')} hint={t('categoryHint')}>
          <ChannelSelect value={data.temp_voice_category_id} onChange={(v) => setData({ ...data, temp_voice_category_id: v })} channels={meta.channels} types={[4]} />
        </FieldRow>
        <div>
          <div className="flex items-center gap-1.5 mb-1"><Label className="mb-0">{t('nameTemplateLabel')}</Label><InfoHint>{t('nameTemplateHint')}</InfoHint></div>
          <Input value={data.temp_voice_name_template || ''} onChange={(e) => setData({ ...data, temp_voice_name_template: e.target.value || null })} placeholder="🔊 {user.name}'s channel" maxLength={100} />
        </div>
        <div>
          <div className="flex items-center gap-1.5 mb-1"><Label className="mb-0">{t('defaultLimitLabel')}</Label><InfoHint>{t('defaultLimitHint')}</InfoHint></div>
          <Input
            type="number" min={0} max={99}
            value={limitValue === null || limitValue === undefined ? '' : limitValue}
            onChange={(e) => setData({ ...data, temp_voice_default_user_limit: e.target.value === '' ? null : Number(e.target.value) })}
            placeholder={t('defaultLimitPlaceholder')}
          />
        </div>
        <SaveBar saving={saving} dirty={dirty} onDiscard={discard} onSave={() => save({
          temp_voice_hub_channel_id: data.temp_voice_hub_channel_id,
          temp_voice_category_id: data.temp_voice_category_id,
          temp_voice_name_template: data.temp_voice_name_template,
          temp_voice_default_user_limit: data.temp_voice_default_user_limit,
        })} />
      </Card>
    </div>
  );
}

const PREMIUM_LIMIT_KEYS = [
  'ticketPanels', 'reactionRolePanels', 'autoResponses', 'customCommands',
  'scheduledMessages', 'giveaways', 'forumAutomations', 'discoveryBumps',
];

function PremiumPanel({ guildId }) {
  const t = useTranslations('guildSettings.premium');
  const tc = useTranslations('guildSettings.common');
  const [data, setData] = useState(null);
  const [keyInput, setKeyInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [redeeming, setRedeeming] = useState(false);

  async function redeemVotes() {
    setRedeeming(true);
    const r = await fetch(`/api/guilds/${guildId}/premium/redeem-votes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    setRedeeming(false);
    const j = await r.json().catch(() => ({}));
    if (r.ok) {
      toast.success(t('voteDoneTitle'), { description: t('voteDoneDesc', { days: j.days }) });
      loadStatus();
      fireConfetti();
    } else if (j.error === 'premium_no_end') toast.error(t('voteNoEnd'));
    else if (j.error === 'not_enough_votes') toast.error(t('voteNotEnough', { min: j.min }));
    else toast.error(t('voteFailed'));
  }

  async function loadStatus() {
    const d = await safeJson(`/api/guilds/${guildId}/premium`, {});
    setData(d);
  }

  useEffect(() => { loadStatus(); }, [guildId]);

  async function activate() {
    if (!keyInput.trim()) { toast.error(t('enterKeyToast')); return; }
    setBusy(true);
    const r = await fetch(`/api/guilds/${guildId}/premium/activate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: keyInput.trim() }),
    });
    setBusy(false);
    const j = await r.json().catch(() => ({}));
    if (r.ok) {
      toast.success(t('activatedToastTitle'), { description: t('activatedToastDesc') });
      setKeyInput('');
      loadStatus();
      fireConfetti();
    }
    else toast.error(t('activationFailedTitle'), { description: j.error || t('unknownError') });
  }

  if (!data) return <Skeleton />;
  const p = data.premium;
  const active = p && p.active && !p.suspended && (!p.expires_at || new Date(p.expires_at) > new Date());

  return (
    <div className="space-y-6">
      <SectionHeader title={t('title')} description={t('description')} />

      <Card className="p-6 bg-gradient-to-br from-[#7c3010]/15 to-transparent border-[#a04820]/40">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#c46a2d]/20 text-[#f2c091] flex items-center justify-center shrink-0">
            <Crown className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-xl font-bold">{t('statusTitle')}</h3>
              {active ? (
                <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/40">{tc('active')}</Badge>
              ) : (
                <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">{t('statusFreePlan')}</Badge>
              )}
            </div>
            {active ? (
              <div className="text-sm text-muted-foreground space-y-1">
                <div>{t.rich('unlockedModulesLine', { b: (chunks) => <b className="text-foreground">{chunks}</b> })}</div>
                {p.expires_at && <div>{t.rich('expiresLine', { date: new Date(p.expires_at).toLocaleString(), b: (chunks) => <b className="text-foreground">{chunks}</b> })}</div>}
                <div>{t.rich('activatedByLine', { name: p.activated_by_name || t('unknownUser'), span: (chunks) => <span className="font-medium text-foreground">{chunks}</span> })}</div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                {t('inactiveDescription')}
              </div>
            )}
          </div>
        </div>
        <div className="mt-5 pt-5 border-t border-border/40">
          <div className="text-xs uppercase tracking-wide text-muted-foreground mb-3">
            {active ? t('limitsBoostedTitle') : t('limitsToRaiseTitle')}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {CONTENT.landing.premium.limits.map((l, i) => (
              <div key={l.title} className={`rounded-lg border p-3 ${active ? 'border-[#c46a2d]/50 bg-[#c46a2d]/10' : 'border-border/50 bg-secondary/10'}`}>
                <div className="text-xs text-muted-foreground truncate">{t(`limitTitles.${PREMIUM_LIMIT_KEYS[i]}`)}</div>
                <div className={`text-sm font-semibold mt-0.5 ${active ? 'text-[#f2c091]' : 'text-foreground'}`}>
                  {active ? l.boosted : `${l.standard} → ${l.boosted}`}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {data.votes ? (
        <Card className="relative overflow-hidden border-[#c46a2d]/40 bg-gradient-to-br from-[#c46a2d]/10 to-transparent p-6" data-vote-days>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="mb-1 flex items-center gap-2">
                <h3 className="text-lg font-bold">{t('voteTitle')}</h3>
                <Badge className="border-emerald-400/40 bg-emerald-400/15 text-[10px] font-black uppercase tracking-wider text-emerald-300">{t('newBadge')}</Badge>
              </div>
              <p className="max-w-xl text-sm text-muted-foreground">{t('voteDesc', { min: data.votes.min })}</p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-black tabular-nums text-[#f2c091]">{data.votes.days}</div>
              <div className="text-xs text-muted-foreground">{t('voteDaysLabel')}</div>
            </div>
          </div>
          <div className="mt-4">
            <div className="h-2 overflow-hidden rounded-full bg-secondary/40" role="progressbar" aria-valuemin={0} aria-valuemax={data.votes.min} aria-valuenow={Math.min(data.votes.days, data.votes.min)}>
              <div className="h-full rounded-full bg-gradient-to-r from-[#c46a2d] to-[#f2c091] transition-all" style={{ width: `${Math.min(100, (data.votes.days / data.votes.min) * 100)}%` }} />
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">{data.votes.days >= data.votes.min ? t('voteReady', { days: data.votes.days }) : t('voteProgress', { days: data.votes.days, min: data.votes.min })}</p>
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">{t('voteHow')}</p>
            <Button onClick={redeemVotes} disabled={redeeming || data.votes.days < data.votes.min} className="gradient-primary shrink-0 gap-2">
              {redeeming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crown className="h-4 w-4" />}{t('voteRedeem', { days: data.votes.days })}
            </Button>
          </div>
        </Card>
      ) : null}

      <Card className="p-6 bg-card/60">
        <div className="font-semibold mb-1 flex items-center gap-2"><Key className="w-4 h-4" /> {t('activateKeyTitle')}</div>
        <p className="text-xs text-muted-foreground mb-3">{t('activateKeyDesc')}</p>
        <div className="flex flex-col sm:flex-row gap-2">
          <Input placeholder="WODY-XXXX-XXXX-XXXX" value={keyInput} onChange={(e) => setKeyInput(e.target.value.toUpperCase())} className="font-mono" />
          <Button onClick={activate} disabled={busy} className="gradient-primary">
            {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Crown className="w-4 h-4 mr-2" />}
            {t('activateButton')}
          </Button>
        </div>
        <div className="mt-4 pt-4 border-t border-border/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">{t('noKeyText')}</p>
          <a href={COMMUNITY_INVITE} target="_blank" rel="noopener noreferrer" className="shrink-0">
            <Button variant="outline" size="sm" className="gap-1.5 w-full sm:w-auto">
              <Users className="w-4 h-4" /> {tc('community')}
            </Button>
          </a>
        </div>
      </Card>

    </div>
  );
}

function TagListTextarea({ rows, value, onChange, placeholder, disabled }) {
  const parse = (raw) => raw.split(',').map((x) => x.trim()).filter(Boolean);
  const [text, setText] = useState(() => (value || []).join(', '));
  const [focused, setFocused] = useState(false);
  useEffect(() => { if (!focused) setText((value || []).join(', ')); }, [focused, JSON.stringify(value || [])]);
  return (
    <Textarea
      rows={rows}
      placeholder={placeholder}
      value={text}
      disabled={disabled}
      onFocus={() => setFocused(true)}
      onChange={(e) => { setText(e.target.value); onChange(parse(e.target.value)); }}
      onBlur={() => { setFocused(false); setText(parse(text).join(', ')); }}
    />
  );
}
