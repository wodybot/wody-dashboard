import { economyGet, economyMutate } from '@/lib/modules/economy';
import { blackjackGet, blackjackMutate } from '@/lib/modules/blackjack';
import { birthdaysGet, birthdaysMutate } from '@/lib/modules/birthdays';
import { streamsGet, streamsMutate } from '@/lib/modules/streams';
import { invitesGet, invitesMutate } from '@/lib/modules/invites';
import { feedsGet, feedsMutate } from '@/lib/modules/feeds';
import { requestBot } from '@/lib/bridge';
import { json } from '@/lib/modules/http';

const PREFIX = /^(economy|blackjack|birthdays|invites|feeds|streams|modules\/diagnose)(\/|$)/;

export function isModuleRoute(sub) { return PREFIX.test(sub); }

function owner(sub) { return sub.match(PREFIX)?.[1]; }

export async function handleModuleGet(ctx) {
  const which = owner(ctx.sub);
  if (!which) return null;
  if (which === 'birthdays') return birthdaysGet(ctx);
  if (which === 'invites') return invitesGet(ctx);
  if (which === 'feeds') return feedsGet(ctx);
  if (which === 'modules/diagnose') {
    const module = ctx.url.searchParams.get('module');
    const kind = { birthdays: 'birthday_diagnose', invite_tracking: 'invite_diagnose' }[module];
    if (!kind) return json({ error: 'invalid_module' }, { status: 400 });
    const result = await requestBot({ kind, guildId: ctx.guildId, userId: ctx.session.user.id });
    return json(result, { status: result.error ? (result.error === 'rate_limited' ? 429 : 502) : 200 });
  }
  ctx.premium = await ctx.h.isGuildPremium(ctx.db, ctx.gidLong);
  if (which === 'economy') return economyGet(ctx);
  if (which === 'blackjack') return blackjackGet(ctx);
  return streamsGet(ctx);
}

export async function handleModuleMutation(ctx) {
  const which = owner(ctx.sub);
  if (!which) return null;
  if (which === 'birthdays') return birthdaysMutate(ctx);
  if (which === 'invites') return invitesMutate(ctx);
  if (which === 'feeds') return feedsMutate(ctx);
  if (which === 'modules/diagnose') return null;
  ctx.premium = await ctx.h.isGuildPremium(ctx.db, ctx.gidLong);
  if (which === 'economy') return economyMutate(ctx);
  if (which === 'blackjack') return blackjackMutate(ctx);
  return streamsMutate(ctx);
}
