'use client';

import DiscordAppTag from '@/components/discord-app-tag';
import {
  Bot, Check, ChevronDown, CornerDownRight, Clock3, FileText, Gift, Hash, Lock, BarChart3,
  MessageCircle, Package, Shield, Sparkles, Star, Terminal, TrendingUp, UserPlus,
  ShieldCheck, Cake, Link2, Search, Rss, Coins, Gamepad2, Camera, Radio, Compass, Archive, Mic2, Youtube, Rocket, ExternalLink, ArrowLeftRight, ListOrdered, Medal, Wand2,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import IconText, { Icon } from '@/components/icon-text';

export const ICONS = {
  welcome: MessageCircle, goodbye: UserPlus, moderation: Shield, automod: Lock,
  tickets: Package, reaction_roles: Sparkles, giveaways: Gift, levels: TrendingUp,
  suggestions: Star, auto_responses: Bot, custom_commands: Terminal, pools: BarChart3,
  embeds: Sparkles, scheduled_messages: Clock3, forums: Hash, logging: FileText,
  captcha: ShieldCheck, birthdays: Cake, invite_tracking: Link2, link: ArrowLeftRight, lookups: Search, feeds: Rss, economy: Coins, blackjack: Gamepad2, stream_notifications: Radio,
  community: Compass, backups: Archive, temporary_voice: Mic2, youtube_notify: Youtube, bump: Rocket,
  counting: ListOrdered, statistics: BarChart3, battlepass: Medal, theme_studio: Wand2,
};

export const WODY_LOGO_URL = '/api/status/bot-avatar';

export const PREVIEWS = {
  birthdays: {
    channel: 'birthdays', color: '#f472b6', mention: '@Alex',
    title: '{wy:birthday} HAPPY BIRTHDAY!',
    text: 'Happy Birthday, @Alex! {wy:giveaway}\n\nEveryone at Wody Community wishes you an amazing day!',
    thumb: 'avatar',
  },
  invite_tracking: {
    channel: 'invite-logs', color: '#c46a2d',
    title: 'Member joined',
    text: '@Member joined using `abc123` from @Inviter.\nValid invites of @Inviter: 12.\nType: Permanent invite. High certainty.',
  },
  link: {
    channel: 'link-general', color: '#c46a2d',
    title: 'Wody Link',
    text: '**Alex** · Community Hub\nAnyone up for the event tonight?\n\n**Mara** · Partner Server\nCount me in! See you there.',
  },
  lookups: {
    channel: 'lookups', color: '#c46a2d',
    title: '{wy:speaker} Last.fm · Now playing',
    text: '### Midnight City\nM83 · Hurry Up, We\'re Dreaming\nListening right now, 184 plays.',
    buttons: [{ label: 'Open on Last.fm', emoji: '{wy:link}' }],
  },
  feeds: {
    channel: 'feeds', color: '#c46a2d',
    title: '{wy:broadcast} New release · wody/wody-bot',
    text: '### v2.4.0\nRadar, Pulse and invite statistics.\nPosted by Pulse, 3 minutes ago.',
    buttons: [{ label: 'Open release', emoji: '{wy:link}' }],
  },
  economy: {
    channel: 'economy', color: '#c46a2d',
    title: '{wy:cash} Wody Economy',
    text: '### {wy:wallet} Wallet `$12,450`',
    fields: [{ label: '{wy:bank} Bank', value: '$80,000' }, { label: '{wy:eco_briefcase} Job', value: 'Developer · Lv 12' }],
    buttons: [{ label: 'Shop', emoji: '{wy:shop}' }, { label: 'Work', emoji: '{wy:eco_briefcase}', style: 'success' }, { label: 'Games', emoji: '{wy:dice}', style: 'danger' }],
  },
  blackjack: {
    channel: 'games', color: '#d83c3e',
    title: '{wy:dice} WODY GAMES',
    text: '### {wy:wallet} Wallet `$12,450`\n### {wy:coins} `Coinflip`\nPick heads or tails. A win pays **2x**.\n### {wy:jackpot} `Slots`\nThree of a kind pays up to **30x**.\n{wy:ticket} Bets: Slots `$10` to `$100,000`',
    buttons: [{ label: 'Coinflip', emoji: '{wy:coins}', style: 'danger' }, { label: 'Dice', emoji: '{wy:dice}', style: 'danger' }, { label: 'Slots', emoji: '{wy:jackpot}', style: 'danger' }, { label: 'Blackjack', emoji: '{wy:blackjack}', style: 'danger' }],
  },
  community: {
    channel: 'discover', color: '#57F287',
    author: 'Wody Community Discovery',
    title: '{wy:success} Server approved',
    text: '**Pixel Plaza** was approved and is now live on Wody Community Discovery.',
    thumb: 'server', image: 'banner',
    after: '**Server** Pixel Plaza · `1029384756102938`\n**Category** Gaming · **Members** 5,400',
    buttons: [{ label: 'View community page', emoji: '{wy:home}', style: 'link' }, { label: 'Join server', emoji: '{wy:contact}', style: 'link' }],
  },
  bump: {
    channel: 'general', color: '#7C3010', reply: '/bump',
    title: '{wy:growth} Bump done!',
    text: '**Pixel Plaza** is now at the top of **Recently bumped**. Check it out on [**DASHBOARD**](#).',
    image: 'bump',
    after: '{wy:member} **Your bumps** `12`  ·  {wy:winner} **Server bumps** `148`\n{wy:reminder} **Next bump** in 30 minutes',
    small: '{wy:star} **Premium server:** you can bump every **30 minutes**.',
    buttons: [{ label: 'View on Wody Discovery', emoji: '{wy:website}', style: 'link' }],
  },
  backups: {
    channel: 'admin', color: '#57F287', reply: '/backup',
    title: '{wy:success} Backup created',
    text: 'Backup created and stored securely for **Wody Community** only.\n\nRoles captured: **38** · Channels captured: **54**',
    stamp: true,
  },
  temporary_voice: {
    channel: 'Member\'s channel', color: '#7C3010',
    title: '{wy:speaker} Voice channel controls',
    text: 'Owner: @Member\nStatus: {wy:unlock} Unlocked • {wy:search} Visible\n\nOnly the owner can use these controls. If the owner isn\'t here anymore, anyone still in the channel can press **Claim** to take over.',
    stamp: true,
    buttons: [{ label: 'Lock', emoji: '{wy:lock}' }, { label: 'Hide', emoji: '{wy:privacy}' }, { label: 'Claim', emoji: '{wy:support}' }, { label: 'Rename', emoji: '{wy:edit}' }, { label: 'Limit', emoji: '{wy:users}' }, { label: 'Delete', emoji: '{wy:delete}', style: 'danger' }],
  },
  youtube_notify: {
    channel: 'videos', color: '#FF0000', mention: '@Notifications',
    text: '-# {wy:video} YouTube  ·  {wy:offline} New upload\n## {wy:video} My best setup tour yet\n{wy:member} **Your Channel**  ·  {wy:time} 2 minutes ago',
    image: 'video',
    small: '{wy:notification} Wody · YouTube Notifications', smallSeparator: true,
    buttons: [{ label: 'Watch on YouTube', emoji: '{wy:next}', style: 'link' }, { label: 'Open channel', emoji: '{wy:video}', style: 'link' }],
  },
  counting: {
    channel: 'counting', color: '#E5484D', mention: '@Alex',
    title: '{wy:counter} Mistake',
    text: '@Alex made a mistake: wrong number. Next was **58**.\nThe count went from 57 back to 0. Next number: **1**.',
  },
  statistics: {
    channel: 'staff', color: '#2FB67C',
    title: '{wy:stats} Weekly activity',
    text: '**Messages** 12,480 (+14%)\n**Active members** 312\n**Busiest channel** #general\n-# Aggregate counters only, no message content.',
  },
  battlepass: {
    channel: 'general', color: '#e6cd8c', mention: '@Alex',
    title: '{wy:medal} Level 12 reached',
    text: '@Alex reached level 12 in the Autumn Season and unlocked **Golden Frame**.',
    buttons: [{ label: 'Open the pass', style: 'link' }],
  },
  theme_studio: {
    channel: 'announcements', color: '#c084fc',
    title: '{wy:colors} New look published',
    text: 'Your server pages now use **Aurora** with soft lights and your own colors.\nBattle Pass, leaderboard and server page are updated.',
  },
  stream_notifications: {
    channel: 'live', color: '#9146ff', mention: '@Live',
    title: '{wy:offline} LIVE NOW',
    text: 'Streamer is now live!\n\n{wy:game} Valorant\n\nRanked grind with the community',
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
    title: '{wy:moderation} Ban',
    fields: [{ label: 'Target', value: '@Raider (`8812…`)' }, { label: 'Moderator', value: '@Staff (`4410…`)' }, { label: 'Reason', value: 'Spam links' }],
    stamp: true,
  },
  automod: {
    channel: 'mod-log', color: '#ED4245', mention: '@Admin @Moderator',
    title: '{wy:warning} Raid detected, raid mode is on',
    text: '**Trigger:** 14 joins in 60 seconds\n**Raid mode:** on for 10 minute(s), ends in 10 minutes\n**New and suspicious accounts:** kick on join\n**Verification level:** raised to High (restored automatically)\n-# Staff can review recent joins in the member list. Raid mode ends by itself.',
    stamp: true,
  },
  tickets: {
    channel: 'support', color: '#e08a4e',
    title: '{wy:ticket} Need help?',
    text: 'Pick a topic below to open a **private ticket** with our staff team.',
    select: 'Choose a ticket type…',
  },
  reaction_roles: {
    channel: 'roles', color: '#c46a2d',
    title: '{wy:roles} Choose your roles',
    text: 'Tap a button to get or remove a role.',
    buttons: [{ label: 'Gamer', emoji: '{wy:game}' }, { label: 'Music', emoji: '{wy:speaker}' }, { label: 'News', emoji: '{wy:announcement}' }],
  },
  captcha: {
    channel: 'verify', color: '#e08a4e',
    title: '{wy:moderation} Member verification',
    text: 'Click **Verify**, sign in with Discord on the page that opens and your role is granted automatically.',
    buttons: [{ label: 'Verify', emoji: '{wy:success}', style: 'link' }],
  },
  giveaways: {
    channel: 'giveaways', color: '#F1C40F',
    author: 'Wody Community', thumb: 'server',
    title: '{wy:giveaway} Giveaway!',
    text: 'Prize: **Discord Nitro**\nWinners: **1**\nParticipants: **248**\nEnds: in 2 hours\n\nClick **Enter** to participate.',
    stamp: true,
    buttons: [{ label: 'Enter', emoji: '{wy:giveaway}', style: 'primary' }],
  },
  pools: {
    channel: 'polls', color: '#C46A2D',
    author: 'Wody Community', thumb: 'server',
    title: '{wy:feedback} Which event should we host next?',
    text: '{wy:place_1} **Movie night**\n`██████░░░░░░` 48% · 30 votes\n\n{wy:place_2} **Game tournament**\n`████░░░░░░░░` 37% · 23 votes\n\n{wy:place_3} **Art contest**\n`██░░░░░░░░░░` 15% · 9 votes',
    footer: '62 participants · ends in 2 days', stamp: true,
    select: 'Vote…',
    buttons: [{ label: 'End poll', emoji: '{wy:lock}', style: 'secondary' }],
  },
  levels: {
    channel: 'levels', color: '#57F287',
    title: 'Level up!',
    text: '@Member reached **level 12**!',
    image: 'aurora', stamp: true,
    buttons: [{ label: 'Leaderboard', style: 'link' }],
  },
  suggestions: {
    channel: 'suggestions', color: '#C46A2D',
    title: '{wy:suggestion} Suggestion',
    text: 'Add a dedicated music channel for sharing playlists and tracks.',
    stamp: true,
    buttons: [{ label: 'Approve', emoji: '{wy:success}', style: 'success' }, { label: 'Deny', emoji: '{wy:error}', style: 'danger' }],
  },
  auto_responses: {
    variant: 'plain', channel: 'general', reply: 'how do I get roles?',
    text: 'Head over to **#roles** and tap the buttons there. {wy:roles}',
  },
  custom_commands: {
    variant: 'plain', channel: 'general', reply: '!rules',
    text: '{wy:docs} **Server rules**\n1. Be respectful\n2. No spam or self-promo\n3. Keep it safe for work',
  },
  embeds: {
    channel: 'announcements', color: '#c46a2d', mention: '@everyone',
    title: '{wy:announcement} Server update',
    text: 'Season 3 starts this **Friday at 20:00**. New roles, new events and a giveaway!',
    image: 'banner',
    footer: 'Wody Team',
  },
  scheduled_messages: {
    channel: 'announcements', color: '#c46a2d',
    title: '{wy:reminder} Weekly reminder',
    text: 'Community game night starts tonight at **20:00 UTC**. See you there!',
  },
  forums: {
    variant: 'forum', channel: 'community', forumTag: 'Showcase',
    title: 'Share your setup',
    text: 'Show off your setup and start a discussion with the community.',
  },
  logging: {
    channel: 'server-logs', color: '#FEE75C',
    title: '{wy:edit} Message edited',
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
      if (part.startsWith('**') && part.endsWith('**')) return <strong key={i} className="font-semibold text-zinc-100"><IconText text={part.slice(2, -2)} size={12} /></strong>;
      if (part.startsWith('`') && part.endsWith('`')) return <code key={i} className="module-code">{part.slice(1, -1)}</code>;
      if (part.startsWith('[')) return <span key={i} className="module-link font-semibold"><IconText text={part.slice(1, part.indexOf(']')).replace(/\*\*/g, '')} size={12} /></span>;
      if (part.startsWith('@') || part.startsWith('#')) return <span key={i} className="module-mention">{part}</span>;
      return <span key={i}><IconText text={part} size={12} /></span>;
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
            <span key={r.emoji} className="module-reaction"><span><IconText text={r.emoji} size={16} /></span><span>{r.count}</span></span>
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
              {b.emoji ? <span className="mr-1"><IconText text={b.emoji} size={16} /></span> : null}{b.label}
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
        <div className="text-[10px] font-semibold text-zinc-100 mt-1.5 mb-1"><IconText text={preview.title} size={12} /></div>
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
                <div className="module-field-label"><IconText text={f.label} size={12} /></div>
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
