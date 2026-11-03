export const HOWTO = {
  tickets: { guide: 'tickets', cmds: ['/ticket-panel'] },
  automod: { guide: 'automod', cmds: [] },
  moderation: { guide: 'moderation', cmds: ['/warn', '/warnings', '/timeout', '/kick', '/ban', '/purge'] },
  reaction_roles: { guide: 'reaction_roles', cmds: ['/reactionrole'] },
  levels: { guide: 'levels', cmds: ['/rank', '/leaderboard', '/setxp'] },
  welcome: { guide: 'welcome', cmds: [] },
  goodbye: { guide: 'goodbye', cmds: [] },
  captcha: { guide: 'captcha', cmds: [] },
  giveaways: { guide: 'giveaways', cmds: ['/giveaway', '/giveaway-end', '/giveaway-reroll'] },
  pools: { custom: 'pools', cmds: ['/pool create', '/pool end', '/pool results', '/pool list', '/pool delete'] },
  suggestions: { guide: 'suggestions', cmds: ['/suggest'] },
  auto_responses: { guide: 'auto_responses', cmds: ['/autoresponse add', '/autoresponse list', '/autoresponse remove'] },
  custom_commands: { guide: 'custom_commands', cmds: ['/customcommand add', '/customcommand list', '/customcommand remove'] },
  embeds: { guide: 'embeds', cmds: [] },
  scheduled_messages: { guide: 'scheduled_messages', cmds: [] },
  forums: { guide: 'forums', cmds: [] },
  logging: { guide: 'logging', cmds: [] },
  birthdays: { guide: 'birthdays', cmds: ['/birthday', '/birthdays'], quick: true },
  invite_tracking: { guide: 'invite_tracking', cmds: ['/invites', '/inviteleaderboard', '/statistics', '/inviteconfig'] },
  lookups: { guide: 'lookups', cmds: ['/radar steam', '/radar nowplaying', '/radar github', '/radar crypto'] },
  feeds: { guide: 'feeds', cmds: ['/pulse add', '/pulse list', '/pulse sources'] },
  community: { guide: 'community', cmds: ['/myserver'] },
  bump: { custom: 'bump', cmds: ['/bump'] },
  economy: { guide: 'economy', cmds: ['/economy', '/eco', '/globalleaderboard'], premium: true, quick: true },
  blackjack: { guide: 'blackjack', cmds: ['/blackjack', '/daily', '/slots', '/coin', '/dice'], premium: true, quick: true },
  backups: { guide: 'backups', cmds: ['/backup', '/backups', '/restore'], premium: true },
  temporary_voice: { guide: 'temporary_voice', cmds: ['/tempvoice-setup', '/voice-rename', '/voice-limit', '/voice-lock'], premium: true },
  youtube_notify: { guide: 'youtube_notify', cmds: [] },
  stream_notifications: { guide: 'stream_notifications', cmds: [] },
};

export function buildHowTo(slug, moduleTitle, th, tg) {
  const spec = HOWTO[slug];
  if (!spec) return [];
  const m = { module: moduleTitle };
  const steps = [{ title: th('s1t'), text: th('s1d') }];
  if (spec.custom) {
    steps.push({ title: th(`${spec.custom}.at`), text: th(`${spec.custom}.ad`) });
    steps.push({ title: th(`${spec.custom}.bt`), text: th(`${spec.custom}.bd`), cmds: spec.cmds });
  } else {
    steps.push({ title: th('s2t', m), text: th('s2d', m) + (spec.premium ? ` ${th('premium', m)}` : '') });
    const list = tg.raw(`items.${spec.guide}.customize`);
    steps.push({
      title: th('s3t'),
      text: th('s3d') + (spec.quick ? ` ${th('quick')}` : ''),
      list: Array.isArray(list) ? list : [],
    });
    if (spec.cmds.length) steps.push({ title: th('s4t'), text: th('s4d'), cmds: spec.cmds });
  }
  steps.push({ title: th('s5t'), text: th('s5d') });
  return steps;
}
