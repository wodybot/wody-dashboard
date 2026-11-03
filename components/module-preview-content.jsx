'use client';

import DiscordAppTag from '@/components/discord-app-tag';
import {
  Bot, Check, ChevronDown, CornerDownRight, Clock3, FileText, Gift, Hash, Lock, BarChart3,
  MessageCircle, Package, Shield, Sparkles, Star, Terminal, TrendingUp, UserPlus,
  ShieldCheck, Cake, Link2, Search, Rss, Coins, Gamepad2, Camera, Radio, Compass, Archive, Mic2, Youtube, Rocket, ExternalLink,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

export const ICONS = {
  welcome: MessageCircle, goodbye: UserPlus, moderation: Shield, automod: Lock,
  tickets: Package, reaction_roles: Sparkles, giveaways: Gift, levels: TrendingUp,
  suggestions: Star, auto_responses: Bot, custom_commands: Terminal, pools: BarChart3,
  embeds: Sparkles, scheduled_messages: Clock3, forums: Hash, logging: FileText,
  captcha: ShieldCheck, birthdays: Cake, invite_tracking: Link2, lookups: Search, feeds: Rss, economy: Coins, blackjack: Gamepad2, stream_notifications: Radio,
  community: Compass, backups: Archive, temporary_voice: Mic2, youtube_notify: Youtube, bump: Rocket,
};

export const WODY_LOGO_URL = '/api/status/bot-avatar';

export const PREVIEWS = {
  birthdays: {
    channel: 'birthdays', color: '#f472b6', mention: '@Alex',
    title: '🎂 HAPPY BIRTHDAY!',
    text: 'Happy Birthday, @Alex! 🎉\n\nEveryone at Wody Community wishes you an amazing day!',
    thumb: 'avatar',
  },
  invite_tracking: {
    channel: 'invite-logs', color: '#c46a2d',
    title: 'Member joined',
    text: '@Member joined using `abc123` from @Inviter.\nValid invites of @Inviter: 12.\nType: Permanent invite. High certainty.',
  },
  lookups: {
    channel: 'lookups', color: '#c46a2d',
    title: '🎵 Last.fm · Now playing',
    text: '### Midnight City\nM83 · Hurry Up, We\'re Dreaming\nListening right now, 184 plays.',
    buttons: [{ label: 'Open on Last.fm', emoji: '🔗' }],
  },
  feeds: {
    channel: 'feeds', color: '#c46a2d',
    title: '📡 New release · wody/wody-bot',
    text: '### v2.4.0\nRadar, Pulse and invite statistics.\nPosted by Pulse, 3 minutes ago.',
    buttons: [{ label: 'Open release', emoji: '🔗' }],
  },
  economy: {
    channel: 'economy', color: '#c46a2d',
    title: '💰 Wody Economy',
    text: '### 👛 Wallet `$12,450`',
    fields: [{ label: '🏦 Bank', value: '$80,000' }, { label: '💼 Job', value: 'Developer · Lv 12' }],
    buttons: [{ label: 'Shop', emoji: '🛒' }, { label: 'Work', emoji: '💼', style: 'success' }, { label: 'Games', emoji: '🎲', style: 'danger' }],
  },
  blackjack: {
    channel: 'games', color: '#d83c3e',
    title: '🎲 WODY GAMES',
    text: '### 👛 Wallet `$12,450`\n### 🪙 `Coinflip`\nPick heads or tails. A win pays **2x**.\n### 🎰 `Slots`\nThree of a kind pays up to **30x**.\n🎟️ Bets: Slots `$10` to `$100,000`',
    buttons: [{ label: 'Coinflip', emoji: '🪙', style: 'danger' }, { label: 'Dice', emoji: '🎲', style: 'danger' }, { label: 'Slots', emoji: '🎰', style: 'danger' }, { label: 'Blackjack', emoji: '♠️', style: 'danger' }],
  },
  community: {
    channel: 'discover', color: '#57F287',
    author: 'Wody Community Discovery',
    title: '✅ Server approved',
    text: '**Pixel Plaza** was approved and is now live on Wody Community Discovery.',
    thumb: 'server', image: 'banner',
    after: '**Server** Pixel Plaza · `1029384756102938`\n**Category** Gaming · **Members** 5,400',
    buttons: [{ label: 'View community page', emoji: '🏠', style: 'link' }, { label: 'Join server', emoji: '📨', style: 'link' }],
  },
  bump: {
    channel: 'general', color: '#7C3010', reply: '/bump',
    title: '🚀 Bump done!',
    text: '**Pixel Plaza** is now at the top of **Recently bumped**. Check it out on [**DASHBOARD**](#).',
    image: 'bump',
    after: '👤 **Your bumps** `12`  ·  🏆 **Server bumps** `148`\n⏰ **Next bump** in 30 minutes',
    small: '⭐ **Premium server:** you can bump every **30 minutes**.',
    buttons: [{ label: 'View on Wody Discovery', emoji: '🌐', style: 'link' }],
  },
  backups: {
    channel: 'admin', color: '#57F287', reply: '/backup',
    title: '✅ Backup created',
    text: 'Backup created and stored securely for **Wody Community** only.\n\nRoles captured: **38** · Channels captured: **54**',
    stamp: true,
  },
  temporary_voice: {
    channel: 'Member\'s channel', color: '#7C3010',
    title: '🔊 Voice channel controls',
    text: 'Owner: @Member\nStatus: 🔓 Unlocked • 👁️ Visible\n\nOnly the owner can use these controls. If the owner isn\'t here anymore, anyone still in the channel can press **Claim** to take over.',
    stamp: true,
    buttons: [{ label: 'Lock', emoji: '🔒' }, { label: 'Hide', emoji: '🙈' }, { label: 'Claim', emoji: '🙋' }, { label: 'Rename', emoji: '✏️' }, { label: 'Limit', emoji: '👥' }, { label: 'Delete', emoji: '🗑️', style: 'danger' }],
  },
  youtube_notify: {
    channel: 'videos', color: '#FF0000', mention: '@Notifications',
    text: '-# 📺 YouTube  ·  🔴 New upload\n## 🎬 My best setup tour yet\n👤 **Your Channel**  ·  🕒 2 minutes ago',
    image: 'video',
    small: '🔔 Wody · YouTube Notifications', smallSeparator: true,
    buttons: [{ label: 'Watch on YouTube', emoji: '▶️', style: 'link' }, { label: 'Open channel', emoji: '📺', style: 'link' }],
  },
  stream_notifications: {
    channel: 'live', color: '#9146ff', mention: '@Live',
    title: '🔴 LIVE NOW',
    text: 'Streamer is now live!\n\n🎮 Valorant\n\nRanked grind with the community',
    thumb: 'avatar', image: 'stream',
    buttons: [{ label: 'Watch Stream', style: 'link' }],
  },
  welcome: {
    channel: 'welcome', color: '#57F287', mention: '@Member',
    author: 'Wody Community',
    image: 'welcome', stamp: true,
  },
  goodbye: {
    channel: 'goodbye', color: '#e08a4e',
    author: 'Wody Community',
    image: 'goodbye', stamp: true,
  },
  moderation: {
    channel: 'mod-log', color: '#FEE75C',
    title: '🛡️ Ban',
    fields: [{ label: 'Target', value: '@Raider (`8812…`)' }, { label: 'Moderator', value: '@Staff (`4410…`)' }, { label: 'Reason', value: 'Spam links' }],
    stamp: true,
  },
  automod: {
    channel: 'mod-log', color: '#ED4245', mention: '@Admin @Moderator',
    title: '🚨 Raid detected, raid mode is on',
    text: '**Trigger:** 14 joins in 60 seconds\n**Raid mode:** on for 10 minute(s), ends in 10 minutes\n**New and suspicious accounts:** kick on join\n**Verification level:** raised to High (restored automatically)\n-# Staff can review recent joins in the member list. Raid mode ends by itself.',
    stamp: true,
  },
  tickets: {
    channel: 'support', color: '#e08a4e',
    title: '🎫 Need help?',
    text: 'Pick a topic below to open a **private ticket** with our staff team.',
    select: 'Choose a ticket type…',
  },
  reaction_roles: {
    channel: 'roles', color: '#c46a2d',
    title: '🎭 Choose your roles',
    text: 'Tap a button to get or remove a role.',
    buttons: [{ label: 'Gamer', emoji: '🎮' }, { label: 'Music', emoji: '🎵' }, { label: 'News', emoji: '📢' }],
  },
  captcha: {
    channel: 'verify', color: '#e08a4e',
    title: '🛡️ Member verification',
    text: 'Click **Verify**, sign in with Discord on the page that opens and your role is granted automatically.',
    buttons: [{ label: 'Verify', emoji: '✅', style: 'link' }],
  },
  giveaways: {
    channel: 'giveaways', color: '#F1C40F',
    author: 'Wody Community', thumb: 'server',
    title: '🎉 Giveaway!',
    text: 'Prize: **Discord Nitro**\nWinners: **1**\nParticipants: **248**\nEnds: in 2 hours\n\nClick **Enter** to participate.',
    stamp: true,
    buttons: [{ label: 'Enter', emoji: '🎉', style: 'primary' }],
  },
  pools: {
    channel: 'polls', color: '#C46A2D',
    author: 'Wody Community', thumb: 'server',
    title: '🗳️ Which event should we host next?',
    text: '1️⃣ **Movie night**\n`██████░░░░░░` 48% · 30 votes\n\n2️⃣ **Game tournament**\n`████░░░░░░░░` 37% · 23 votes\n\n3️⃣ **Art contest**\n`██░░░░░░░░░░` 15% · 9 votes',
    footer: '62 participants · ends in 2 days', stamp: true,
    select: 'Vote…',
    buttons: [{ label: 'End poll', emoji: '🔒', style: 'secondary' }],
  },
  levels: {
    channel: 'levels', color: '#57F287',
    title: '🎉 Level up!',
    text: '🎉 @Member reached **level 12**!',
    image: 'aurora', stamp: true,
    buttons: [{ label: 'Leaderboard', style: 'link' }],
  },
  suggestions: {
    channel: 'suggestions', color: '#C46A2D',
    title: '💡 Suggestion',
    text: 'Add a dedicated music channel for sharing playlists and tracks.',
    stamp: true,
    buttons: [{ label: 'Approve', emoji: '✅', style: 'success' }, { label: 'Deny', emoji: '❌', style: 'danger' }],
  },
  auto_responses: {
    variant: 'plain', channel: 'general', reply: 'how do I get roles?',
    text: 'Head over to **#roles** and tap the buttons there. 🎭',
  },
  custom_commands: {
    variant: 'plain', channel: 'general', reply: '!rules',
    text: '📜 **Server rules**\n1. Be respectful\n2. No spam or self-promo\n3. Keep it safe for work',
  },
  embeds: {
    channel: 'announcements', color: '#c46a2d', mention: '@everyone',
    title: '📣 Server update',
    text: 'Season 3 starts this **Friday at 20:00**. New roles, new events and a giveaway!',
    image: 'banner',
    footer: 'Wody Team',
  },
  scheduled_messages: {
    channel: 'announcements', color: '#c46a2d',
    title: '⏰ Weekly reminder',
    text: 'Community game night starts tonight at **20:00 UTC**. See you there!',
  },
  forums: {
    variant: 'forum', channel: 'community', forumTag: 'Showcase',
    title: 'Share your setup',
    text: 'Show off your setup and start a discussion with the community.',
  },
  logging: {
    channel: 'server-logs', color: '#FEE75C',
    title: '✏️ Message edited',
    fields: [{ label: 'Before', value: 'see you at 8' }, { label: 'After', value: 'see you at 9' }, { label: 'Author', value: '@Member' }, { label: 'Channel', value: '#general' }],
    stamp: true,
    buttons: [{ label: 'Jump to message', style: 'link' }],
  },
};

export function renderRich(text) {
  if (!text) return null;
  return String(text).split('\n').map((line, li, arr) => {
    if (/^-#\s+/.test(line)) {
      return <span key={li} className="module-subtext">{renderRich(line.replace(/^-#\s+/, ''))}</span>;
    }
    if (/^##\s+/.test(line)) {
      return <span key={li} className="module-h2">{renderRich(line.replace(/^##\s+/, ''))}</span>;
    }
    const heading = /^###\s+/.test(line);
    const body = heading ? line.replace(/^###\s+/, '') : line;
    const parts = body.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]*\)|@[A-Za-z][\w ]*?(?=[\s.,!]|$)|#[a-z][\w-]*)/g).filter(Boolean).map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) return <strong key={i} className="font-semibold text-zinc-100">{part.slice(2, -2)}</strong>;
      if (part.startsWith('`') && part.endsWith('`')) return <code key={i} className="module-code">{part.slice(1, -1)}</code>;
      if (part.startsWith('[')) return <span key={i} className="module-link font-semibold">{part.slice(1, part.indexOf(']')).replace(/\*\*/g, '')}</span>;
      if (part.startsWith('@') || part.startsWith('#')) return <span key={i} className="module-mention">{part}</span>;
      return <span key={i}>{part}</span>;
    });
    return <span key={li} className={heading ? 'module-h3' : ''}>{parts}{li < arr.length - 1 && !heading ? <br /> : null}</span>;
  });
}

function PreviewImage({ kind, moduleName }) {
  if (kind === 'aurora') {
    return (
      <div className="module-img module-img-aurora">
        <span className="module-img-avatar"><Camera className="module-img-cam" aria-hidden="true" /></span>
        <div className="module-img-panel">
          <div className="flex items-center justify-between gap-1"><b>Member</b><i>RANK #3</i></div>
          <span className="module-img-level"><em>LEVEL</em> 12</span>
          <div className="module-img-xp"><span>32% to level 13</span><span>429 / 1.3K XP</span></div>
          <div className="module-img-bar"><span style={{ width: '32%' }} /></div>
        </div>
      </div>
    );
  }
  if (kind === 'bump') {
    return (
      <div className="module-img module-img-bump">
        <span className="module-img-lines"><i /><i /><i /></span>
        <span className="module-img-badge">W</span>
        <span className="module-img-bumptext">BUMP!<small>WODY DISCOVERY</small></span>
      </div>
    );
  }
  if (kind === 'welcome' || kind === 'goodbye') {
    return (
      <div className={`module-img module-img-member ${kind === 'goodbye' ? 'is-bye' : ''}`}>
        <span className="module-img-avatar"><Camera className="module-img-cam" aria-hidden="true" /></span>
        <b>{kind === 'goodbye' ? 'GOODBYE' : 'WELCOME'}</b>
        <span>Member</span>
        <small>{kind === 'goodbye' ? 'We now have 1,284 members' : 'You are member #1,285'}</small>
      </div>
    );
  }
  if (kind === 'banner') {
    return (
      <div className="module-img module-img-banner">
        <span className="module-img-custom">
          <Camera className="module-img-cam-lg" aria-hidden="true" />
          {moduleName ? <b>{moduleName}</b> : null}
        </span>
      </div>
    );
  }
  return <div className={`module-img module-img-${kind}`}><span className="module-img-play" /></div>;
}

export function PreviewAttachments({ preview }) {
  if (!preview.buttons && !preview.reactions && !preview.select) return null;
  return (
    <>
      {preview.reactions && (
        <div className="module-reactions">
          {preview.reactions.map((r) => (
            <span key={r.emoji} className="module-reaction"><span>{r.emoji}</span><span>{r.count}</span></span>
          ))}
        </div>
      )}
      {preview.select && (
        <div className="module-select">
          <span>{preview.select}</span>
          <ChevronDown className="module-select-chevron" />
        </div>
      )}
      {preview.buttons && (
        <div className="module-buttons">
          {preview.buttons.map((b) => (
            <span key={b.label} className={`module-discord-button is-${b.style || 'secondary'}`}>
              {b.emoji ? <span className="mr-1">{b.emoji}</span> : null}{b.label}
              {b.style === 'link' ? <ExternalLink className="ml-1 h-[0.85em] w-[0.85em] opacity-80" /> : null}
            </span>
          ))}
        </div>
      )}
    </>
  );
}

export function PreviewBody({ preview, moduleName = null }) {

  if (preview.variant === 'plain') {
    return (
      <>
        {preview.reply && (
          <div className="module-reply"><CornerDownRight className="w-2.5 h-2.5" /><span>{preview.reply}</span></div>
        )}
        <div className="module-text-preview text-[9px] leading-relaxed text-zinc-300">{renderRich(preview.text)}</div>
        {preview.caption && <div className="module-caption">{preview.caption}</div>}
        <PreviewAttachments preview={preview} />
      </>
    );
  }

  if (preview.variant === 'forum') {
    return (
      <>
        <span className="module-forum-tag">{preview.forumTag}</span>
        <div className="text-[10px] font-semibold text-zinc-100 mt-1.5 mb-1">{preview.title}</div>
        <div className="text-[8.5px] leading-relaxed text-zinc-400">{renderRich(preview.text)}</div>
      </>
    );
  }

  const head = [preview.author ? `-# ${preview.author}` : null, preview.title ? `## ${preview.title}` : null].filter(Boolean).join('\n');
  const textBlock = [head, preview.text].filter(Boolean).join('\n');
  const footerLine = preview.footer || preview.stamp;
  return (
    <>
      {preview.reply && (
        <div className="module-reply"><CornerDownRight className="w-2.5 h-2.5" /><span>{preview.reply}</span></div>
      )}
      {preview.mention && <div className="module-ping">{renderRich(preview.mention)}</div>}
      <div className="module-embed module-v2" style={{ '--accent': preview.color || '#c46a2d' }}>
        {textBlock ? (
          <div className={preview.thumb ? 'flex items-start gap-2' : ''}>
            <div className="module-v2-text min-w-0 flex-1">{renderRich(textBlock)}</div>
            {preview.thumb ? <span className="module-thumb" aria-hidden="true"><Camera className="module-img-cam" /></span> : null}
          </div>
        ) : null}
        {preview.fields && (
          <div className="module-fields-v2">
            {preview.fields.map((f) => (
              <div key={f.label} className="module-field">
                <div className="module-field-label">{f.label}</div>
                <div className="module-field-value">{renderRich(f.value)}</div>
              </div>
            ))}
          </div>
        )}
        {preview.image && <PreviewImage kind={preview.image} moduleName={moduleName} />}
        {preview.after ? <><div className="module-sep" /><div className="module-v2-text">{renderRich(preview.after)}</div></> : null}
        {preview.small && (preview.smallSeparator ? <div className="module-sep" /> : null)}
        {preview.small && <div className="module-small">{renderRich(preview.small)}</div>}
        {footerLine ? <><div className="module-sep" /><div className="module-footer">{preview.footer ? `${preview.footer} ` : ''}<PreviewDate /></div></> : null}
        <PreviewAttachments preview={preview} />
      </div>
    </>
  );
}

function PreviewDate() {
  const [text, setText] = useState('Today at 2:32 PM');
  useEffect(() => {
    try { setText(new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date())); } catch { }
  }, []);
  return <span>{text}</span>;
}


export function HomepageModulePreview({ moduleKey, previewLabel, className = '' }) {
  const tCard = useTranslations('moduleCard');
  const tModules = useTranslations('modules');
  const preview = PREVIEWS[moduleKey] || PREVIEWS.welcome;
  const resolvedPreviewLabel = previewLabel || tCard('preview');

  return (
    <div className={`module-discord relative p-3.5 ${className}`}>
      <div className="flex items-center gap-2 text-[8px] text-zinc-500 mb-3 border-b border-white/[0.045] pb-2.5">
        <Hash className="w-3 h-3" />
        <span>{preview.channel}</span>
        <span className="ml-auto module-live-pill"><span />{resolvedPreviewLabel}</span>
      </div>
      <div className="flex gap-2.5">
        <div className="module-avatar"><img src={WODY_LOGO_URL} alt="Wody" /><i /></div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold text-zinc-100 leading-none mb-2">
            Wody
            <DiscordAppTag size="xs" className="ml-1" />
            <span className="text-[7px] font-normal text-zinc-500 ml-1">Today at 14:32</span>
          </div>
          <PreviewBody preview={preview} moduleName={tModules.has(`${moduleKey}.title`) ? tModules(`${moduleKey}.title`) : null} />
        </div>
      </div>
    </div>
  );
}
