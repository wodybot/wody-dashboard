// Buyer profiles for the module pages, English. No em dashes on purpose (house style of the site copy).
// Built from a per-module study of what server owners search for, what they complain about in the tools they tried,
// and which limits of Discord itself push them to add a bot. Each entry has:
//   audience: who lands on this page (3 short lines)
//   pains: what goes wrong with the usual alternatives (3 to 4 lines)
//   faqMore: extra questions people really ask, appended to the page FAQ
// Only facts about Wody that the module really has are stated here. Competitor names and prices are left out on purpose.
export const PROFILES_EN = {
  tickets: {
    audience: [
      'Owners of support, gaming and store servers whose staff answer the same kinds of requests every day',
      'Small communities that want a ticket system without paying before they know it fits',
      'Growing servers where tickets must open every single time, even when the server is busiest',
    ],
    pains: [
      'Transcripts, analytics and ratings are often missing or sit behind a paid plan, so the record of a conversation is gone when the channel closes',
      'Staff step on each other: two moderators answer the same member because nobody can see who took the ticket',
      'Many ticket bots only do tickets, so a server that also needs verification or giveaways ends up running three or four bots',
      'Setup that feels like filling in a form from 2015, with commands to memorize before the first panel works',
    ],
    faqMore: [
      { q: 'Do I need a separate bot for tickets and the rest of my server?', a: 'No. Tickets are one module of Wody, next to moderation, automod, welcome and more, so one invite and one dashboard cover the whole server.' },
    ],
  },
  automod: {
    audience: [
      'Owners of public servers that grew faster than their moderator team',
      'Admins who already use the built in Discord AutoMod and want the layers it does not have',
      'Moderators who get raided at night and want the server to defend itself until someone is awake',
    ],
    pains: [
      'A keyword filter is not a raid defense: a wave of new accounts posting the same scam link in every channel can pass straight through it',
      'Strict thresholds punish real people, for example muting a member for two quick messages in a row',
      'Alerts land in one channel with no history, so a moderator cannot tell whether someone is on a first or a fifth offence',
      'Stacking several protection bots creates overlapping punishments and conflicting rules',
    ],
    faqMore: [
      { q: 'Do I still need the built in Discord AutoMod?', a: 'They can run side by side. Wody adds layers such as raid detection, duplicate message detection and a role whitelist for staff on top of what Discord filters natively.' },
      { q: 'Can the filters hit my own staff?', a: 'Not if you whitelist their roles. Whitelisted roles are skipped by every rule.' },
    ],
  },
  moderation: {
    audience: [
      'Server owners who need the whole staff team to use the same tools and leave the same trail',
      'Head moderators who judge appeals and need the history of a member in one place',
      'Communities moving off a large all in one bot and wanting the essential commands without a paywall',
    ],
    pains: [
      'Decisions become inconsistent when a moderator cannot see whether a member is on a first offence or a fifth',
      'Appeals are hard to judge fairly without a written record of what was done and why',
      'Actions done by hand or in a different bot leave no trace in your own server',
    ],
    faqMore: [
      { q: 'How do I check a member before deciding on a punishment?', a: 'Every warning is saved per member, so staff can read the full history before choosing between a warning, a timeout or a ban.' },
    ],
  },
  reaction_roles: {
    audience: [
      'Owners who let members pick pronouns, games, regions or notification roles',
      'Admins of servers with many roles who need a menu that stays tidy',
      'Anyone whose role menu stopped working and wants one that is easy to fix',
    ],
    pains: [
      'The most common failure is not the bot: Discord only lets a bot give roles that sit below its own highest role, and Administrator does not change that',
      'One message can hold at most 20 different emoji reactions, so large menus need to be split or moved to buttons',
      'Deleting the panel message breaks the setup, and an offline bot does nothing',
      'A role menu that cannot limit people to one choice turns a colour or team picker into a mess',
    ],
    faqMore: [
      { q: 'Why does the bot not give the role?', a: 'Almost always the role order. Move the Wody role above every role it has to give and check that it has the Manage Roles permission, also in the channel of the panel.' },
      { q: 'What if I need more than 20 choices?', a: 'Discord limits a message to 20 different emoji reactions. Use buttons or split the choices over several menus.' },
    ],
  },
  levels: {
    audience: [
      'Community owners who want active members to feel seen',
      'Admins who used a big leveling bot and do not want to pay a monthly fee per server for the basics',
      'Gaming and creator servers where a leaderboard keeps friendly competition going',
    ],
    pains: [
      'In the biggest leveling bot, features owners expect, such as custom level up messages, role rewards and multipliers, sit behind a monthly plan that is charged for each server',
      'XP can be farmed by spamming unless the bot has cooldowns, and in some tools those controls are paid too',
      'Moving to another bot means starting every member from zero, which owners fear',
    ],
    faqMore: [
      { q: 'Can members farm XP by spamming?', a: 'No. There is a short cooldown between messages that give XP, so a burst of messages does not inflate a level.' },
      { q: 'Do I have to pay for the leaderboard?', a: 'No. XP, level up announcements, /rank and /leaderboard are free on every server.' },
    ],
  },
  welcome: {
    audience: [
      'Owners who read about welcome cards and found them locked behind a premium plan',
      'Servers that want a DM and a starting role at the moment of joining',
      'Creators and gaming communities where the first minute decides if a newcomer stays',
    ],
    pains: [
      'The welcome image, the full set of variables and the card background are premium in several popular bots',
      'A plain message in a busy channel scrolls away before the newcomer reads it',
      'Welcome setups often fire for bots too, or show a member count that is a moment out of date',
      'Owners cannot preview the result, so they test by leaving and rejoining with an alt account',
    ],
    faqMore: [
      { q: 'Can I see the message before it goes live?', a: 'Yes. The dashboard shows a live preview of the message or card, so you do not need an alt account to test it.' },
    ],
  },
  goodbye: {
    audience: [
      'Owners who want leaving members to be acknowledged in the same style as arrivals',
      'Moderators who watch leaves to spot raids and quick leavers',
    ],
    pains: [
      'Adding a separate bot for a single message is exactly the tool sprawl owners complain about',
      'Join and leave messages that look like they come from two different servers',
    ],
    faqMore: [
      { q: 'Does the goodbye message need its own bot?', a: 'No. It is part of the same Wody module family as welcome, so both share a look and one dashboard.' },
    ],
  },
  captcha: {
    audience: [
      'Owners of public, giveaway and trading servers that attract automated accounts',
      'Admins who were raided once, usually in the middle of the night, and do not want it again',
      'Communities that want a gate in front of the channels without making newcomers jump through hoops',
    ],
    pains: [
      'Every extra verification step also removes some real people, so a hard gate costs growth',
      'Verification matters most during an attack, but its cost is paid every normal day',
      'Raids often arrive as a group of brand new accounts joining at the same moment',
      'Some members distrust third party verification, so the steps must be short and clearly explained',
    ],
    faqMore: [
      { q: 'Should I keep verification on all the time?', a: 'For a public server it is a sensible default. If you prefer less friction, combine it with the Automod raid mode so the stricter path is used when something looks wrong.' },
    ],
  },
  giveaways: {
    audience: [
      'Community managers who run prize draws to bring members back',
      'Streamers and creators who give away codes, subscriptions or merchandise',
      'Servers that want entries to be simple on mobile',
    ],
    pains: [
      'Reaction based giveaways are easy to bot and to abuse with alt accounts',
      'Entry requirements and scheduled draws are often paid features in the common giveaway bots',
      'When the winner never answers, the draw has no clean way to pick someone else',
      'Manual draws have no timer, so they end late or not at all',
    ],
    faqMore: [
      { q: 'How do I keep fake accounts out of a draw?', a: 'Use Captcha so automated accounts never get a role in the first place, and keep the giveaway in a channel that only verified members can see.' },
    ],
  },
  pools: {
    audience: [
      'Owners who let the community choose game nights, events and rules',
      'Staff who want to know what members think before a change',
    ],
    pains: [
      'Emoji reaction polls let one person vote for several options, so the result is not reliable',
      'A poll that nobody closes keeps collecting votes and nobody posts the result',
      'Results are scattered in a thread of reactions instead of one clear summary',
    ],
    faqMore: [
      { q: 'Can I run a poll with more than two answers?', a: 'Yes. A poll can have several answers, and you choose when it closes.' },
    ],
  },
  suggestions: {
    audience: [
      'Owners who want ideas from members to reach the staff instead of getting buried in general chat',
      'Game and product communities that keep a visible record of what was accepted',
    ],
    pains: [
      'The same idea is posted again and again because nobody can find the earlier one',
      'A denial with no visible status feels like being ignored, so members stop sending ideas',
      'Votes by plain reaction can be inflated with extra accounts',
      'The channel turns into a pile of half voted ideas that nobody reads',
    ],
    faqMore: [
      { q: 'How do members know what happened to their idea?', a: 'Every suggestion shows a clear status after a moderator approves or denies it with a button, and the embed stays in the channel as history.' },
    ],
  },
  auto_responses: {
    audience: [
      'Owners who answer the same question many times a day',
      'Admins who want a reply to a word without a prefix',
    ],
    pains: [
      'In some big bots automatic replies are a premium only feature',
      'Free tiers that allow only a handful of rules are hard to use for a real FAQ',
      'Tools built around code or templates scare off owners who just want a reply',
    ],
    faqMore: [
      { q: 'When should I use an auto response and when a custom command?', a: 'Use an auto response when the answer should appear as soon as someone writes a word. Use a custom command when the member should ask on purpose with a prefix such as !rules.' },
    ],
  },
  custom_commands: {
    audience: [
      'Owners who want !rules, !info, !partners and !ip style commands',
      'Staff who tire of pasting the same link into chat',
    ],
    pains: [
      'One popular bot allows only a few custom commands on its free tier, which is not enough for a real server',
      'Some alternatives need programming knowledge and give cryptic error messages',
      'Commands made in one bot cannot be shared with the next server you manage',
    ],
    faqMore: [
      { q: 'Do I pay per command?', a: 'No. Custom commands are free on every server and you make them from the dashboard, with no code.' },
    ],
  },
  embeds: {
    audience: [
      'Owners who build a rules, info or roles channel and want it to look professional',
      'Staff who announce updates and do not want to write JSON',
    ],
    pains: [
      'If the bot lacks Embed Links in a channel, the embed shows up as plain text and nobody sees an error',
      'A channel can deny Send Messages to the bot even when the server wide role allows it, so posts fail silently',
      'Webhook tools post exactly what they receive and stop working if the address is deleted or leaked',
    ],
    faqMore: [
      { q: 'Why did my embed appear as plain text?', a: 'The bot is missing the Embed Links permission in that channel. Allow it in the channel permissions and send again.' },
    ],
  },
  scheduled_messages: {
    audience: [
      'Owners with weekly events, reminders and recurring announcements',
      'Communities across time zones where the right hour matters',
    ],
    pains: [
      'A nine o clock post can land at the wrong hour when the time zone is wrong',
      'Daily check ins and weekly recaps are copied by hand until someone forgets',
      'A missing channel permission makes a scheduled post fail without any visible error',
    ],
    faqMore: [
      { q: 'What can a scheduled message contain?', a: 'Plain text or an embed, sent once or on a repeating interval.' },
    ],
  },
  forums: {
    audience: [
      'Owners of support and feedback servers that use forum channels',
      'Moderators who spend their evening tagging posts by hand',
    ],
    pains: [
      'Untagged and unanswered posts make a forum look abandoned, and then people stop posting',
      'The same questions come back as new posts when nobody can sort them',
      'Bug reports without a tag go unseen by the people who fix them',
    ],
    faqMore: [
      { q: 'Does it help with duplicate questions?', a: 'Automatic tagging and the cooldown between posts keep the forum sorted and calmer, so repeated questions are easier to spot and merge.' },
    ],
  },
  logging: {
    audience: [
      'Moderators who need to know what was said before a message was deleted',
      'Owners who settle disputes and want a record that does not depend on memory',
      'Admins who want to check role and nickname changes',
    ],
    pains: [
      'The Discord audit log keeps events for a limited time and does not store what a deleted or edited message said',
      'Without the record, a dispute between two members becomes one word against another',
      'Moderation actions done in different places leave no single history',
      'A log channel that everyone can read becomes a privacy problem',
    ],
    faqMore: [
      { q: 'Who should be able to see the log channel?', a: 'Only staff. Keep the log channel private to moderators and admins, because it can contain deleted messages.' },
    ],
  },
  birthdays: {
    audience: [
      'Friendly communities where members like to be remembered',
      'Large servers that want birthdays without the year being public',
    ],
    pains: [
      'Birthdays kept in a spreadsheet or in someone\'s head get forgotten',
      'Time zones make the celebration land on the wrong day for some members',
      'Members will not share their date if they fear the year is shown to everyone',
    ],
    faqMore: [
      { q: 'Can the whole server see my age?', a: 'Members control their own privacy, so they can hide their birthday details from the list.' },
    ],
  },
  invite_tracking: {
    audience: [
      'Owners who run a growth campaign and want to know which invite worked',
      'Creators who give invite rewards and need a fair count',
      'Moderators who watch for raids through quick leavers and brand new accounts',
    ],
    pains: [
      'Discord does not tell a bot which invite a member used at the moment of joining, so every tracker has to work it out',
      'When several people join in the same second, more than one invite count goes up and the answer is ambiguous',
      'Vanity links are not in the normal invite list, so many trackers miss them',
      'A tracker that guesses silently gives owners numbers they cannot trust',
    ],
    faqMore: [
      { q: 'Why do some joins show an unknown inviter?', a: 'Because Discord does not report the invite on join. When Wody cannot be sure, it says so instead of crediting the wrong person.' },
    ],
  },
  lookups: {
    audience: [
      'Gaming communities that ask for Minecraft server status or Steam and Roblox profiles every day',
      'Music, anime and tech servers where members share links and stats',
      'Owners who want useful commands without adding five single purpose bots',
    ],
    pains: [
      'Each service has its own bot, and every extra bot is another invite, role and dashboard',
      'Tiny single feature bots are often abandoned and silently stop answering',
      'Some lookups need an account or a key, which owners do not want to manage',
    ],
    faqMore: [
      { q: 'Do members need an account on those services?', a: 'No. Wody reads public information through official or openly documented interfaces and shows it in Discord.' },
    ],
  },
  feeds: {
    audience: [
      'Server owners who follow creators, subreddits, blogs and repositories and want the news in a channel',
      'Communities for streamers, music and developers',
      'Admins who tried several notification bots and were tired of late or missing alerts',
    ],
    pains: [
      'Alerts that arrive minutes late are nearly useless for a live stream',
      'Bots that ping everyone teach members to mute the channel',
      'APIs change, and an abandoned bot can silently stop posting without telling anyone',
      'A feed is easy to add but hard to fix when it breaks, because the bot never says why',
    ],
    faqMore: [
      { q: 'How do I find out that a feed has a problem?', a: 'The dashboard shows the status and the reason. A feed that keeps failing backs off and pauses itself instead of retrying forever.' },
    ],
  },
  community: {
    audience: [
      'Owners of new and small servers that need to be found',
      'Servers that want a public page with their own look',
    ],
    pains: [
      'Many listing sites rank by size, so a new server stays invisible',
      'Directories are full of inactive or badly managed servers, and visitors learn not to trust them',
      'A listing without a clear page makes visitors leave at once',
    ],
    faqMore: [
      { q: 'Why is my server reviewed before it is shown?', a: 'The Wody team checks every public profile so that visitors find real, active and safe communities.' },
    ],
  },
  bump: {
    audience: [
      'Owners who grow through server directories',
      'Small servers that cannot pay for ads',
    ],
    pains: [
      'Other directories reward whoever bumps most often, so a skipped day drops you down',
      'Bumping is easy to forget, and one missed day is enough to lose the top spot',
      'Automated bumping is against the rules of the biggest directory, so it is not a safe shortcut',
    ],
    faqMore: [
      { q: 'Is bumping the same as advertising?', a: 'No. A bump moves your server to the top of Recently bumped on Wody Discovery for a while. It helps people find you, but it does not replace a good public profile.' },
    ],
  },
  economy: {
    audience: [
      'Owners who want members to come back every day',
      'Roleplay, gaming and chat servers that like a shared virtual world',
    ],
    pains: [
      'An economy without limits inflates quickly and then nothing is worth anything',
      'Members farm coins with spam unless earning is controlled',
      'Owners worry about gambling features and about what happens when a dispute starts',
    ],
    faqMore: [
      { q: 'Can I see what happened if two members argue about coins?', a: 'Yes. Admin logs and reset tools let staff check the activity and fix a balance.' },
    ],
  },
  blackjack: {
    audience: [
      'Servers that like casino style games with friends',
      'Owners who want a use for the coins of the Economy module',
    ],
    pains: [
      'Uncapped gambling lets one lucky member end up with all the coins',
      'Owners worry about anything that looks like real gambling',
    ],
    faqMore: [
      { q: 'Can members lose real money?', a: 'No. Everything uses virtual currency only, and each game has its own bet limit.' },
    ],
  },
  backups: {
    audience: [
      'Owners who spent weeks on channels, roles and permissions',
      'Admins who want a safety net before a big change',
    ],
    pains: [
      'A server is usually nuked through a permissions mistake, such as a role that collected Manage Roles and Ban over time',
      'Without a backup there is no way to undelete channels, only to rebuild by hand',
      'The newest snapshot may already contain the damage, so a restore point from before matters',
      'No backup can bring back members who left, so the invite has to be shared again',
    ],
    faqMore: [
      { q: 'When should I make a backup?', a: 'Before any large change to roles or channels, and again once the new layout works.' },
    ],
  },
  temporary_voice: {
    audience: [
      'Gaming squads and study groups that want their own room on demand',
      'Social servers with a hub channel that creates a room per person',
    ],
    pains: [
      'A fixed list of voice channels is either too crowded or full of empty rooms',
      'Members want the same few controls: rename, lock the room, set a limit',
      'Several single feature bots each add a role, an invite and a possible outage',
    ],
    faqMore: [
      { q: 'What happens to the room when everyone leaves?', a: 'It is deleted automatically, so the channel list stays tidy.' },
    ],
  },
  youtube_notify: {
    audience: [
      'YouTube creators and fan servers that want every upload announced',
      'Owners who need the alert in the right channel',
    ],
    pains: [
      'An alert that comes late loses its value, and members miss the premiere',
      'Bots that ping everyone make members mute the channel',
      'API changes can stop an abandoned bot without any notice',
    ],
    faqMore: [
    ],
  },
  stream_notifications: {
    audience: [
      'Streamers and communities that want members in the room when the stream starts',
      'Servers that follow a creator on Twitch and TikTok',
    ],
    pains: [
      'An alert 5 minutes after the stream starts is nearly useless',
      'Alerts that ping everyone lead to muted channels, so an opt in role works better',
      'Platforms change their interfaces, and a bot that is not maintained stops posting without telling you',
    ],
    faqMore: [
    ],
  },
};
