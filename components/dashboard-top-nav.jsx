'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useParams } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { LogoutLink } from '@/components/logout-link';
import { Tip } from '@/components/tip';
import { ChevronDown, ChevronRight, Compass, Crown, Heart, Home, LogOut, RefreshCw, UserRound, Users } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import LanguageSwitcher from '@/components/language-switcher';
import NotificationBell from '@/components/notification-bell';
import { COMMUNITY_INVITE } from '@/lib/content';

const BTN =
  'inline-flex h-9 items-center gap-2 rounded-lg border border-border/60 bg-card/40 px-2.5 sm:px-3.5 text-sm font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_14px_-6px_rgba(230,205,140,0.35)] backdrop-blur-sm transition-colors hover:bg-card hover:border-border sm:h-10';
const ICON_BTN =
  'inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 bg-card/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_14px_-6px_rgba(230,205,140,0.35)] backdrop-blur-sm transition-colors hover:bg-card hover:border-border sm:h-10 sm:w-10';
const PREMIUM_BTN =
  'inline-flex h-9 items-center gap-2 rounded-lg px-2.5 sm:px-3.5 text-sm gradient-primary sm:h-10';

const DISCOVERY_BTN =
  'inline-flex h-9 items-center gap-2 rounded-lg border border-[#e6cd8c]/45 bg-[#e6cd8c]/10 px-2.5 xl:px-3.5 text-sm font-medium text-[#f0c08e] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_14px_-6px_rgba(230,205,140,0.35)] backdrop-blur-sm transition-colors hover:bg-[#e6cd8c]/20 hover:border-[#e6cd8c]/70 sm:h-10';

export default function DashboardTopNav() {
  const t = useTranslations('nav');
  const params = useParams();
  const guildId = params?.guildId;
  const [showPremium, setShowPremium] = useState(false);
  const [target, setTarget] = useState(null);
  const [rowTarget, setRowTarget] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setTarget(null);
    setRowTarget(null);
    const desiredId = guildId ? 'dashboard-guild-actions' : 'dashboard-home-actions';
    const tryFind = () => {
      const el = document.getElementById(desiredId);
      if (el) { if (!cancelled) { setTarget(el); setRowTarget(guildId ? document.getElementById('dashboard-guild-premium-row') : null); } return true; }
      return false;
    };
    if (tryFind()) return () => { cancelled = true; };
    const interval = window.setInterval(() => {
      if (cancelled) return;
      if (tryFind()) window.clearInterval(interval);
    }, 100);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, [guildId]);

  useEffect(() => {
    let cancelled = false;
    if (!guildId) {
      setShowPremium(false);
      return;
    }
    (async () => {
      try {
        const res = await fetch(`/api/guilds/${guildId}/premium`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        const premium = data?.premium;
        const active = Boolean(premium?.active && !premium?.suspended && (!premium?.expires_at || new Date(premium.expires_at) > new Date()));
        if (!cancelled) setShowPremium(!active);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [guildId]);

  if (!target) return null;

  const handleRefresh = () => window.dispatchEvent(new Event('wody:refresh'));
  const openDiscovery = () => window.dispatchEvent(new CustomEvent('wody:open-module', { detail: 'community' }));
  const LABEL = guildId ? 'hidden xl:inline' : 'hidden sm:inline';

  const premiumRow = guildId && showPremium && rowTarget ? createPortal(
    <Link
      href="/premium"
      className="group mb-3 flex h-10 items-center gap-2.5 rounded-lg px-3 text-sm font-semibold gradient-primary"
    >
      <Crown className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate">{t('getPremium')}</span>
      <ChevronRight className="h-4 w-4 shrink-0 opacity-80 transition-transform group-active:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
    </Link>,
    rowTarget
  ) : null;

  return (<>
  {premiumRow}
  {createPortal(
    <div className="flex items-center gap-2 shrink-0">
      {showPremium && (
        <Link href="/premium" className={`${PREMIUM_BTN}${guildId ? ' max-sm:hidden' : ''}`}>
          <Crown className="w-4 h-4" />
          <span className={LABEL}>{t('getPremium')}</span>
        </Link>
      )}
      {!guildId && (
        <Tip label={t('refresh')}><button type="button" onClick={handleRefresh} aria-label={t('refresh')} className={BTN}>
          <RefreshCw className="w-4 h-4" />
          <span className="hidden sm:inline">{t('refresh')}</span>
        </button></Tip>
      )}
      {guildId && (
        <Tip label={t('discoverServer')}><button type="button" onClick={openDiscovery} aria-label={t('discoverServer')} className={DISCOVERY_BTN}>
          <Compass className="w-4 h-4" />
          <span className="hidden xl:inline whitespace-nowrap">{t('discoverServer')}</span>
          <span className="hidden sm:inline xl:hidden whitespace-nowrap">{t('discover')}</span>
        </button></Tip>
      )}
      <Tip label={t('home')}><Link href="/" className={guildId ? `${BTN} justify-center xl:!w-10 xl:!px-0` : BTN} aria-label={t('home')}>
        <Home className="w-4 h-4" />
        {!guildId && <span className={LABEL}>{t('home')}</span>}
      </Link></Tip>
      {(
        <TooltipProvider delayDuration={100}>
          {[
            { key: 'profile', href: '/profile', Icon: UserRound, label: t('profile') },
            { key: 'fav', href: '/servers/favorites', Icon: Heart, label: t('resourceLinks.favorites.label') },
          ].filter((x) => guildId || x.key === 'profile').map(({ key, href, Icon, label, cls }) => (
            <Tooltip key={key}>
              <TooltipTrigger asChild>
                <Link href={href} aria-label={label} className={`${ICON_BTN} ${guildId ? 'hidden sm:inline-flex' : 'hidden lg:inline-flex'}`}><Icon className={`w-4 h-4 ${cls || ''}`} /></Link>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs font-medium">{label}</TooltipContent>
            </Tooltip>
          ))}
        </TooltipProvider>
      )}
      <NotificationBell className="relative" buttonClassName={`!h-9 !w-9 sm:!h-10 sm:!w-10 !rounded-lg ${'shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_14px_-6px_rgba(230,205,140,0.35)]'}`} />
      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger asChild>
            <a href={COMMUNITY_INVITE} target="_blank" rel="noopener noreferrer" aria-label={t('joinCommunity')} className={`${ICON_BTN} ${guildId ? 'hidden sm:inline-flex' : 'hidden lg:inline-flex'}`}>
              <Users className="w-4 h-4" />
            </a>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs font-medium">{t('joinCommunity')}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <LanguageSwitcher labelClassName={LABEL} className={`h-9 w-9 shrink-0 !rounded-lg !px-0 sm:h-10 sm:w-10 xl:w-auto xl:!px-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_14px_-6px_rgba(230,205,140,0.35)]`} />
      {guildId && (
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <button type="button" aria-label={t('joinCommunity')} title={t('joinCommunity')} className={`${ICON_BTN} group sm:hidden`}>
              <ChevronDown className="h-5 w-5 transition-transform group-data-[state=open]:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[min(88vw,18rem)] p-2">
            <DropdownMenuItem asChild className="p-0 focus:bg-transparent">
              <Link href="/profile" className="mt-1 flex w-full items-center gap-3 rounded-lg border border-[#e6cd8c]/40 bg-[#e6cd8c]/10 text-[#f3e1b0] active:bg-[#e6cd8c]/25 px-3 py-3 text-sm font-semibold">
                <UserRound className="h-4 w-4 shrink-0 text-[#e6cd8c]" aria-hidden="true" />{t('profile')}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="p-0 focus:bg-transparent">
              <Link href="/servers/favorites" className="mt-1 flex w-full items-center gap-3 rounded-lg border border-rose-400/40 bg-rose-500/10 text-rose-200 active:bg-rose-500/25 px-3 py-3 text-sm font-semibold">
                <Heart className="h-4 w-4 shrink-0 fill-current text-rose-300" aria-hidden="true" />{t('resourceLinks.favorites.label')}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="p-0 focus:bg-transparent">
              <a href={COMMUNITY_INVITE} target="_blank" rel="noopener noreferrer" className="mt-1 flex w-full items-center gap-3 rounded-lg border border-[#5865F2]/45 bg-[#5865F2]/15 text-[#c9d0ff] active:bg-[#5865F2]/30 px-3 py-3 text-sm font-semibold">
                <Users className="h-4 w-4 shrink-0 text-[#8a9cff]" aria-hidden="true" />{t('joinCommunity')}
              </a>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <LogoutLink label={t('logout')} confirmLabel={t('logoutConfirm')} className={`${ICON_BTN} !border-red-500/30 !bg-red-500/10 text-red-300 hover:!bg-red-500/20`}>
        <LogOut className="w-4 h-4" />
      </LogoutLink>
    </div>,
    target
  )}</>);
}
