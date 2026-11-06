

export const CLIENT_ID = '1514491897647861773';
export const OWNER_ID = process.env.NEXT_PUBLIC_DISCORD_OWNER_ID || '932582842351898644';
const SITE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://wody.online';
export const INVITE_REDIRECT_URI = `${SITE_URL}/invite/callback`;
export const INVITE_URL =
  `https://discord.com/oauth2/authorize?client_id=${CLIENT_ID}&scope=bot%20applications.commands&permissions=1100341439734&response_type=code&redirect_uri=${encodeURIComponent(INVITE_REDIRECT_URI)}`;

export const COMMUNITY_INVITE = 'https://discord.gg/z9Jvp2V7Eh';

export const TIKTOK_URL = 'https://www.tiktok.com/@wody.online';

export const YOUTUBE_URL = 'https://www.youtube.com/@wodybot';

export const CONTENT = {
  brand: {
    name: 'Wody',
    tagline: 'The complete Discord bot platform.',
    footer: '© 2026 Wody · All rights reserved.',
  },
  nav: {
    dashboard: 'Dashboard',
    invite: 'Invite Wody',
    login: 'Login with Discord',
    logout: 'Logout',
    openDashboard: 'Open Dashboard',
    community: 'Community',
  },
  landing: {
    liveBadge: 'Configure once. Changes apply instantly.',
    heroTitle: 'One bot.',
    heroBrand: 'Every feature.',
    heroSubtitle:
      'Wody is a Discord bot that contains moderation, tickets, giveaways, levels, welcome, reaction roles, automod, custom commands and more for growing communities. Configure everything from the web dashboard.',
    ctaPrimary: 'Continue with Discord',
    ctaSecondary: 'See all modules',

    stats: [
      { label: '15+', sub: 'modules included' },
      { label: 'FAST', sub: 'settings sync' },
      { label: '24/7', sub: 'uptime target' },
      { label: 'FREE', sub: 'free forever' },
    ],

    features: [
      { title: 'Instant sync', desc: 'Every change writes to the bot database in real time.' },
      { title: 'Verified access', desc: 'The server owner, or a member with Manage Server or Administrator permission, can change bot settings. Access is checked on the server for every request.' },
      { title: 'Zero tracking', desc: 'No analytics, no ads or third-party tracking. Strictly necessary authentication and consent cookies are used; the optional language preference is used only with consent.' },
      { title: 'Full moderation suite', desc: 'Ban, kick, timeout, warn, purge, slowmode, lock, mod-logs, warnings history.' },
      { title: 'Advanced automod', desc: 'Layered protection for spam, invites, links, raids, mentions, phishing, bad words, caps, duplicates and message floods.' },
      { title: 'Dark theme dashboard', desc: 'A dark, brown-toned dashboard that works on desktop and mobile.' },
    ],

    modulesTitle: 'What Wody can do',
    modulesDetail: [
      { key: 'welcome', title: 'Welcome & Auto Role', desc: 'Custom welcome messages, DMs and auto-role assignment on join. Embed or plain text with dynamic placeholders.' },
      { key: 'goodbye', title: 'Goodbye', desc: 'Send a farewell embed when a member leaves the server. Fully customizable.' },
      { key: 'moderation', title: 'Moderation', desc: 'All the essentials: /ban, /kick, /timeout, /warn, /purge, /slowmode, /lock, warnings history & mod-log persistence.' },
      { key: 'automod', title: 'Automod', desc: 'Layered protection for spam, invites, links, mentions, raids, scams, bad words, caps, duplicates and message floods with role whitelist.' },
      { key: 'tickets', title: 'Tickets', desc: 'Button panels, private channels per user, claim by staff, closable with automatic transcript export.' },
      { key: 'reaction_roles', title: 'Reaction Roles', desc: 'Four modes: normal, toggle, unique, verify covers self-assignable roles.' },
      { key: 'giveaways', title: 'Giveaways', desc: 'One-click entry, automatic ends and reroll winners. Free servers can run 1 active giveaway; Premium removes this limit.' },
      { key: 'levels', title: 'Levels & XP', desc: 'XP-per-message with cooldown, level-up messages in a dedicated channel, /rank and /leaderboard.' },
      { key: 'suggestions', title: 'Suggestions', desc: 'Members submit ideas, moderators approve or deny with buttons pretty embed history preserved.' },
      { key: 'auto_responses', title: 'Auto Responses', desc: 'Trigger-based automatic replies. Case-insensitive, with an exact-match option. Free servers can keep 5 responses; Premium removes this limit.' },
      { key: 'custom_commands', title: 'Custom Commands', desc: 'Simple prefix-based text commands. Perfect for !rules, !info, !partners and every FAQ answer.' },
      { key: 'embeds', title: 'Embed Builder', desc: 'Design and send rich embeds with a 30-second per-user cooldown to prevent message spam.' },
      { key: 'scheduled_messages', title: 'Scheduled Messages', desc: 'Send plain text or embeds at a set time, once or on a repeating interval. Free servers can keep 1 active schedule; Premium removes this limit.' },
      { key: 'forums', title: 'Forums', desc: 'Automatic tagging and a post cooldown applied to forum channels. Free servers can set this up on 1 forum channel; Premium removes this limit.' },
      { key: 'link', title: 'Wody Link', desc: 'Connect a channel in one of your servers with a channel in another server you own. Messages, replies, attachments, stickers, edits and deletes travel both ways, with optional translation and spam protection that never bans anyone. Only the real server owner can set it up. Free.' },
      { key: 'invite_tracking', title: 'Invite Tracking', desc: 'Find out who brought each member, with a 30-day statistics chart, leaderboards, join logs and welcome variables. /statistics shows it in Discord with buttons and selects. Never guesses. Free for every server.' },
      { key: 'logging', title: 'Full logging', desc: 'Message delete/edit, nickname changes, member join/leave, role changes and every mod action logged with timestamps.' },
    ],


    community: {
      badge: 'Official server',
      title: 'Join the Wody community',
      body:
        'Get support, request features, share your setup, meet other server owners, and be the first to know when new modules ship. This is also where premium is granted. Join and DM the developer.',
      cta: 'Join Discord server',
    },

    premium: {
      badge: 'Invitation only',
      title: 'Premium',
      subtitle: 'Never for sale. Always earned.',
      body:
        "Premium is Wody's way of rewarding the people actually growing the community: community leaders, content creators and server owners who promote Wody, plus anyone who reaches 100 votes. It unlocks Backups, Temporary Voice and YouTube Notifications, and removes the creation limits on seven core systems: with Premium they are unlimited.",
      limitsTitle: 'Higher limits on Premium servers',
      limits: [
        { title: 'Ticket panels', standard: 1, boosted: '∞' },
        { title: 'Reaction Role panels', standard: 1, boosted: '∞' },
        { title: 'Auto Responses', standard: 5, boosted: '∞' },
        { title: 'Custom Commands', standard: 5, boosted: '∞' },
        { title: 'Scheduled Messages', standard: 1, boosted: '∞' },
        { title: 'Giveaways', standard: 1, boosted: '∞' },
        { title: 'Forum automations', standard: 1, boosted: '∞' },
        { title: 'Discovery bumps', standard: '2 h', boosted: '30 min' },
      ],
      options: [
        {
          key: 'promote',
          title: 'Option A: Promote Wody',
          steps: [
            'Post about Wody on your Discord server or content.',
            'Join our community server (link below).',
            'DM the developer with proof of the promotion.',
            'If approved, you receive a key you can activate on any server you own.',
          ],
        },
        {
          key: 'vote',
          title: 'Option B: Vote 100 times',
          steps: [
            'Use the /vote command on your Discord account, in any server where Wody is present or in DM with the bot.',
            'Click the links Wody sends to cast your vote on the listed bot directories.',
            'Every vote counts toward your personal total, tracked automatically per Discord account.',
            'Once you reach 100 total votes, open a ticket in our community server to claim your key. It can then be activated on any server you own.',
          ],
        },
      ],
      how: [
        'Post about Wody on your Discord server or content.',
        'Join our community server (link below).',
        'DM the developer with proof of the promotion.',
        'If approved, you receive a key you can activate on any server you own.',
        'Or, alternatively: use /vote on your Discord account, reach 100 total votes, then open a ticket in the community server to claim your key.',
      ],
      value:
        "There's no price tag on Premium, because we'd rather reward the people actually growing the community. Every key stays tied to a single server, is rate limited, and gets revoked the moment a promotion turns out to be fake or votes get gamed.",
      cta: 'Apply in the community server',
    },

    faq: [
      {
        q: 'Do I need to host anything?',
        a: 'No. Wody runs on our infrastructure. You just invite the bot and configure it from the dashboard.',
      },
      {
        q: 'Do my settings really apply without restart?',
        a: 'Yes. Wody reads its config from the database on every event, so any change from the dashboard takes effect on the very next event on Discord.',
      },
      {
        q: 'How is my data handled?',
        a: 'We store the bot configuration and feature data needed to run Wody. Dashboard login uses two strictly necessary authentication cookies, while the corresponding session data is stored server side. We do not use analytics, advertising or third party tracking cookies. See the Privacy page for details.',
      },
      {
        q: 'Is premium really free?',
        a: 'Yes, for the right people. Premium is granted for free to community leaders and content creators who promote Wody, and it stays invitation only to keep quality high.',
      },
      {
        q: 'What limits does Premium increase?',
        a: 'With Premium there are no creation limits on seven systems: Ticket panels, Reaction Role panels, Auto Responses, Custom Commands, Scheduled Messages, active Giveaways and Forum automations are all unlimited (free servers keep 1, 1, 5, 5, 1, 1 and 1). It also unlocks Backups, Temporary Voice, YouTube Notifications, Economy, Games, Stream Notifications, Battle Pass and Theme Studio, none of which are part of the free plan.',
      },
      {
        q: 'How do I invite Wody to my server?',
        a: 'Use the Invite Wody button or open wody.online/invite. The invite link takes you directly to Discord so you can select your server and add Wody.',
      },
      {
        q: 'Where can I follow Wody?',
        a: 'Follow @wody.online on TikTok and @wodybot on YouTube for Wody content and updates, and join the official Wody community for support and announcements.',
      },
    ],
  },
  dashboardHome: {
    title: 'Your servers',
    subtitle: 'Servers where you are the owner.',
    empty: 'No manageable servers found. Make sure you own at least one Discord server.',
    botOnline: 'Wody is present',
    botMissing: 'Wody is not in this server',
    manage: 'Manage',
    inviteHere: 'Invite Wody',
    refresh: 'Refresh',
  },
  legal: {
    lastUpdated: 'Last updated: 8 October 2026',
    termsUpdated: 'Last updated: 6 November 2026',
    privacyUpdated: 'Last updated: 17 October 2026',
    guidelinesUpdated: 'Last updated: 15 October 2026',
    contact: 'For privacy, legal, or data protection questions, contact Păcurar Ancuța-Narcisa, the Operator, at privacy@wody.online.',
    email: 'privacy@wody.online',
    operator: 'Wody is developed and operated by Păcurar Ancuța-Narcisa, an individual based in Romania, European Union, Romania (the “Operator”). The Operator acts as the data controller for processing activities for which Wody determines the purposes and means of processing.',
  },
};

export const MODULE_INFO = {
  general: { title: 'General', description: 'Basic settings used by every command, like server language and role assignments.' },
  welcome: { title: 'Welcome messages', description: 'Sent when a new member joins. You can use {user.mention}, {user.name}, {user.tag}, {guild.name} and {member_count} in the message.' },
  goodbye: { title: 'Goodbye messages', description: 'Sent when a member leaves. Same placeholders as the welcome message.' },
  autorole: { title: 'Auto role', description: 'Gives every new member a role automatically as soon as they join.' },
  moderation: { title: 'Moderation', description: 'Choose which roles can run mod commands and where actions get logged. Covers /ban, /kick, /mute, /timeout, /warn, /purge, /slowmode and /lock.' },
  automod: { title: 'Automod', description: 'Layered protection for spam, invite links, other links, mass mentions, raids, phishing, bad words, caps, duplicates and message floods. Whitelisted roles skip every rule.' },
  logging: { title: 'Logging', description: 'Turn on the mod-log feed and pick where it posts. Reports message edits/deletes, nickname changes, member joins/leaves and role changes; off by default so Wody never watches for these unless you switch it on. Also sets the suggestion and level-up channels.' },
  tickets: { title: 'Tickets', description: 'Create panels with /ticket-panel. When a member clicks the button, Wody opens a private channel and posts a transcript once it\u2019s closed.' },
  verification: { title: 'Verification', description: 'A reaction role in verify mode that hands out a role when someone reacts. Handy for unlocking the server after a CAPTCHA.' },
  reaction_roles: { title: 'Reaction Roles', description: 'Members react to get or lose a role. Choose from normal, toggle, unique or verify mode.' },
  auto_responses: { title: 'Auto Responses', description: 'Wody replies automatically when it sees a trigger word. Not case sensitive, with an exact-match option if you only want it to fire on the whole message.' },
  custom_commands: { title: 'Custom Commands', description: 'Simple text commands starting with ! (or whatever your prefix is). Good for things like !rules, !partners or !faq.' },
  giveaways: { title: 'Giveaways', description: 'Start one with /giveaway. Free servers can run 1 active giveaway; Premium removes this limit.' },
  levels: { title: 'Levels', description: 'Members earn XP as they chat, with a cooldown between messages. Level up messages go to whichever channel you set.' },
  suggestions: { title: 'Suggestions', description: 'Members post ideas with /suggest, and moderators approve or deny them with a couple of buttons.' },
  backups: { title: 'Backups', description: "Back up this server's Wody settings straight from Discord with /backup. Limited to once every 7 days, and only visible to this server's own admins." },
  temporary_voice: { title: 'Temporary Voice', description: 'Join the hub channel to get your own private voice channel. It deletes itself once everyone leaves.' },
  youtube_notify: { title: 'YouTube Notifications', description: 'Post in a Discord channel automatically whenever a YouTube channel you pick uploads a new video, up to 3 channels, one target Discord channel.' },
  premium: { title: 'Premium', description: 'Enter a key here to unlock Backups, Temporary Voice, YouTube Notifications, Economy, Games, Stream Notifications, Battle Pass and Theme Studio for this server.' },
};
