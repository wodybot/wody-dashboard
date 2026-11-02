// FILE: nav.jsx
// PUNE ÎN: components/nav.jsx
// (înlocuiește fișierul existent din proiectul wody-dashboard-main la această cale)

'use client';
import NotificationBell from '@/components/notification-bell';
import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { LogoutLink } from '@/components/logout-link';
import { Tip } from '@/components/tip';
import { Link, usePathname } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ChevronDown, Globe, LogOut, Users, Sparkles, Crown, HelpCircle, Menu, Mail, BriefcaseBusiness, Command, Megaphone, Youtube, BookOpen, Compass, MessageCircle, ShieldCheck, ChevronRight, Handshake, Heart, IdCard, Trophy, Flame, Briefcase, LayoutDashboard, UserRound, ScrollText, Video } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { INVITE_URL, COMMUNITY_INVITE, TIKTOK_URL, YOUTUBE_URL, OWNER_ID } from '@/lib/content';
import { discordCdnUrl } from '@/lib/utils';
import LanguageSwitcher, { useLanguageChoice } from '@/components/language-switcher';
import { LoginMenu } from '@/components/login-menu';
import SocialLinks from '@/components/profile/SocialLinks';

export function WodyLogo({ className = 'w-9 h-9', size = 'md' }) {
  const font = size === 'sm' ? 'text-sm' : 'text-lg';
  return (
    <div className={`rounded-xl bg-[#6B2E10] flex items-center justify-center brown-glow ${className}`}>
      <span className={`text-white font-black ${font} tracking-tight`} style={{ textShadow: '2px 2px 0 #000' }}>W</span>
    </div>
  );
}

// Small label next to a link that deserves attention: "new" for something that
// just shipped, "trending" for what members are using the most right now.
export function NavTag({ kind, label }) {
  if (kind === 'trending') {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full border border-orange-400/40 bg-orange-500/15 px-1.5 py-px text-[9px] font-bold uppercase leading-4 tracking-wider text-orange-300 align-middle">
        <Flame className="h-2.5 w-2.5" aria-hidden="true" />{label}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-gradient-to-r from-[#e6c36a] to-[#c9a24a] px-1.5 py-px text-[9px] font-extrabold uppercase leading-4 tracking-wider text-[#1a1206] align-middle">{label}</span>
  );
}

export function InviteButton({ variant = 'premium', size = 'sm', className = '' }) {
  const t = useTranslations('nav');
  const isPremium = variant === 'premium';
  return (
    <a href={INVITE_URL} target="_blank" rel="noopener noreferrer">
      <Button
        variant={isPremium ? 'default' : variant}
        size={size}
        className={`${isPremium ? 'btn-premium gap-1.5' : ''} ${className}`}
      >
        {isPremium && <Sparkles className="w-4 h-4" />}
        {t('invite')}
      </Button>
    </a>
  );
}

export function CommunityButton({ variant = 'ghost', size = 'sm', className = '', anchorClassName = '' }) {
  const t = useTranslations('nav');
  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <a href={COMMUNITY_INVITE} target="_blank" rel="noopener noreferrer" aria-label={t('joinCommunity')} className={anchorClassName || undefined}>
            <Button
              variant={variant}
              size={size}
              className={`${className} px-2.5 border border-border/60 bg-card/40 hover:bg-card/80 hover:border-border transition-colors`}
            >
              <Users className="h-4 w-4" aria-hidden="true" />
            </Button>
          </a>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs font-medium">{t('joinCommunity')}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function TopNav({ user: userProp, showDashboardLink = true, className = '', compactDashboardHeader = false, edgeToEdge = false, fixedDashboardHeader = false, suppressLoginFlash = false, hideOwnerPanelLink = false }) {
  const t = useTranslations('nav');
  const pathname = usePathname();
  // Pages that don't need the session for anything else (most marketing
  // pages) simply don't pass `user` at all, so this fetches it client-side
  // instead, that keeps those pages static/cacheable (no cookies() read,
  // no getSession()/Mongo call on every request) at the cost of the nav's
  // login badge popping in a moment after first paint instead of being in
  // the initial HTML. Pages that already need the session for something
  // else (home, premium, dashboard) keep passing `user` explicitly (even
  // `null`), which skips this fetch entirely and behaves exactly as before.
  const lang = useLanguageChoice();
  const [langOpen, setLangOpen] = useState(false);
  const [fetchedUser, setFetchedUser] = useState(null);
  const [authResolved, setAuthResolved] = useState(userProp !== undefined);
  // Pages that already know the user pass it in. A page that says "signed out" (null) is double checked once
  // in the browser, so a cached page or a short server hiccup can never make a signed in person look signed out.
  const shouldFetchUser = userProp === undefined || userProp === null;
  useEffect(() => {
    if (!shouldFetchUser) return;
    let cancelled = false;
    const check = () => fetch('/api/auth/me', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled) { setFetchedUser(d?.user || null); setAuthResolved(true); } })
      .catch(() => { if (!cancelled) setAuthResolved(true); });
    check();
    // Coming back to a page kept by the browser (back button, app switcher): ask again.
    const onShow = (e) => { if (e.persisted) check(); };
    window.addEventListener('pageshow', onShow);
    return () => { cancelled = true; window.removeEventListener('pageshow', onShow); };
  }, [shouldFetchUser]);
  const user = userProp || fetchedUser;
  // Tracks which Resources item was actually clicked, so the highlight
  // persists after the click (through the dropdown's own closing
  // animation and until the next page takes over) instead of relying on
  // CSS :active, which only lasts while the mouse/finger is physically
  // held down, too brief to register as "yes, that registered".
  const [pressedHref, setPressedHref] = useState(null);
  // Tracks which Resources item the cursor is currently over. Hover used to
  // rely purely on the CSS `hover:` utility below, but that highlight
  // (bg-secondary/70) is subtle enough next to the popover background that
  // it read as "nothing happens on hover, only on click". Driving it from
  // state instead lets hover reuse the same strong highlight as a press, so
  // the reaction is visible the moment the cursor lands on the item.
  const [hoveredHref, setHoveredHref] = useState(null);
  // Desktop: the Resources menu is non-modal, so the page behind it still scrolls.
  // Phones keep the modal behaviour: the page stays fixed and only the menu moves.
  const [desktopMenu, setDesktopMenu] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const update = () => setDesktopMenu(mq.matches);
    update();
    mq.addEventListener?.('change', update);
    return () => mq.removeEventListener?.('change', update);
  }, []);
  // Latest blog posts for the "Spotlight" side of the Resources menu, loaded
  // the first time the menu is opened (never on page load, so it costs nothing
  // for visitors who don't open it). null = not loaded yet.
  const [spotlight, setSpotlight] = useState(null);
  const spotlightRequested = useRef(false);
  const loadSpotlight = () => {
    if (spotlightRequested.current) return;
    spotlightRequested.current = true;
    fetch('/api/blog/latest')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) { spotlightRequested.current = false; setSpotlight((prev) => prev ?? []); return; } // failed: ask again next time the menu opens
        const items = Array.isArray(d?.items) ? d.items : [];
        // Warm the cover images too, so the menu shows them the moment it opens.
        setSpotlight(items);
      })
      .catch(() => { spotlightRequested.current = false; setSpotlight((prev) => prev ?? []); });
  };
  // Loaded in the background shortly after the page is ready (not on first paint),
  // so the articles are already there when the Resources menu is opened.
  useEffect(() => {
    const run = () => loadSpotlight();
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(run, { timeout: 2500 });
      return () => window.cancelIdleCallback?.(id);
    }
    const id = window.setTimeout(run, 1200);
    return () => window.clearTimeout(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Order here only controls the mobile Resources dropdown (Help and
  // Premium each have their own dedicated header button on desktop, so
  // desktop position is set by the JSX below, not by this array). Premium
  // is listed first so it's the top item members see when opening
  // Resources on mobile.
  const RESOURCE_LINKS = [
    { href: '/premium', key: 'premium', Icon: Crown },
    { href: '/servers', key: 'servers', Icon: Compass, tag: 'new' },
    { href: '/collab', key: 'collab', Icon: Briefcase, tag: 'new' },
    { href: '/blog', key: 'blog', Icon: BookOpen },
    { href: '/team', key: 'team', Icon: Users },
    { href: '/help', key: 'help', Icon: HelpCircle },
    { href: '/contact', key: 'contact', Icon: Mail },
    { href: '/careers', key: 'careers', Icon: BriefcaseBusiness },
    { href: '/commands', key: 'commands', Icon: Command },
    { href: '/updates', key: 'updates', Icon: Megaphone },
    { href: '/partners', key: 'partners', Icon: Handshake },
    { href: '/servers/guidelines', key: 'guidelines', Icon: ScrollText },
    { href: '/#passport', key: 'passport', Icon: IdCard, tag: 'new' },
    { href: '/leaderboard', key: 'leaderboard', Icon: Trophy },
    { href: '/tiktok', key: 'tiktok', Icon: Video, tag: 'new' },
  ];
  const linkOf = (key) => RESOURCE_LINKS.find((l) => l.key === key);
  // The Resources menu: four clear categories, two per column on desktop, stacked
  // as centred cards on phones. The Owner Panel entry is only shown to the bot owner
  // (same rule as the header button).
  // On phones the groups read Product, Communities, Support, Company; on desktop the two columns balance.
  const GROUP_ORDER = { product: 'order-1 md:order-none', communities: 'order-2 md:order-none', support: 'order-3 md:order-none', company: 'order-4 md:order-none' };
  const RESOURCE_GROUPS = [
    [
      { key: 'product', items: [linkOf('premium'), linkOf('commands'), linkOf('passport'), linkOf('updates'), linkOf('blog')] },
      { key: 'company', items: [linkOf('team'), linkOf('careers'), linkOf('tiktok'), { href: '/dashboard/panel', key: 'ownerPanel', Icon: ShieldCheck, ownerOnly: true }] },
    ],
    [
      { key: 'communities', items: [linkOf('servers'), linkOf('collab'), linkOf('leaderboard'), linkOf('guidelines'), linkOf('partners')] },
      { key: 'support', items: [linkOf('help'), { href: COMMUNITY_INVITE, key: 'discord', Icon: MessageCircle, external: true }, linkOf('contact')] },
    ],
  ];

  // A function, so it is only evaluated when a signed in user exists.
  const renderProfileMenu = () => (
    <>
                  <div className="flex items-center gap-3 px-2 pb-2 pt-1">
                    <img
                      src={discordCdnUrl(user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=64` : `https://cdn.discordapp.com/embed/avatars/0.png`)}
                      alt="" className="h-9 w-9 rounded-full"
                    />
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">{user.global_name || user.username}</span>
                    <DropdownMenuItem asChild className="p-0 focus:bg-transparent">
                      <Link href="/servers/favorites" aria-label={t('resourceLinks.favorites.label')} title={t('resourceLinks.favorites.label')} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-card/40 transition-colors hover:bg-card/80 hover:border-border active:bg-card/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                        <Heart className="h-4 w-4" aria-hidden="true" />
                      </Link>
                    </DropdownMenuItem>
                    {lang.allowed && (
                      <button type="button" aria-label={t('language')} aria-expanded={langOpen} onClick={() => setLangOpen((v) => !v)} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-border/60 bg-card/40 px-2.5 text-xs font-semibold uppercase transition-colors hover:border-border active:bg-card/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                        <Globe className="h-4 w-4" aria-hidden="true" />{lang.locale}
                      </button>
                    )}
                  </div>
                  {lang.allowed && langOpen && (
                    <div role="radiogroup" aria-label={t('language')} className="grid grid-cols-2 gap-1 pb-2">
                      {lang.locales.map((l) => (
                        <button key={l} type="button" role="radio" aria-checked={l === lang.locale} onClick={() => lang.select(l)} className={`rounded-lg border px-2.5 py-2 text-left text-[13px] transition-colors ${l === lang.locale ? 'border-[#e6cd8c]/50 bg-[#e6cd8c]/10 font-semibold text-[#e6cd8c]' : 'border-border/60 hover:border-border active:bg-card/80'}`}>{lang.labels[l]}</button>
                      ))}
                    </div>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild className="p-0 focus:bg-transparent">
                    <Link href="/profile" className="mt-1 flex w-full items-center gap-3 rounded-lg border border-[#e6cd8c]/40 bg-[#e6cd8c]/10 px-3 py-3 text-sm font-semibold text-[#f3e1b0] active:bg-[#e6cd8c]/25">
                      <UserRound className="h-4 w-4 shrink-0 text-[#e6cd8c]" aria-hidden="true" />{t('profile')}
                    </Link>
                  </DropdownMenuItem>
                  {showDashboardLink && (
                    <DropdownMenuItem asChild className="p-0 focus:bg-transparent">
                      <Link href="/dashboard" className="mt-1 flex w-full items-center gap-3 rounded-lg border border-[#e6cd8c]/40 bg-[#e6cd8c]/10 px-3 py-3 text-sm font-semibold text-[#f3e1b0] active:bg-[#e6cd8c]/25">
                        <LayoutDashboard className="h-4 w-4 shrink-0 text-[#e6cd8c]" aria-hidden="true" />{t('dashboard')}
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem asChild className="p-0 focus:bg-transparent">
                    <a href={COMMUNITY_INVITE} target="_blank" rel="noopener noreferrer" className="mt-1 flex w-full items-center gap-3 rounded-lg border border-[#5865F2]/45 bg-[#5865F2]/15 px-3 py-3 text-sm font-semibold text-[#c9d0ff] active:bg-[#5865F2]/30">
                      <DiscordIcon className="h-4 w-4 shrink-0 text-[#8a9cff]" />{t('joinDiscord')}
                    </a>
                  </DropdownMenuItem>
                  {/* Phones only (this menu is only reachable on phones): TikTok link right before sign out. */}
                  <DropdownMenuItem asChild className="p-0 focus:bg-transparent md:hidden">
                    <Link href="/tiktok" className="mt-1 flex w-full items-center gap-3 rounded-lg border border-border/60 bg-card/40 px-3 py-3 text-sm font-semibold active:bg-card/80">
                      <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4 shrink-0" aria-hidden="true"><path d="M9 0h1.98c.144.715.54 1.617 1.235 2.512C12.895 3.389 13.797 4 15 4v2c-1.753 0-3.07-.814-4-1.829V11a5 5 0 1 1-5-5v2a3 3 0 1 0 3 3z" /></svg>{t('resourceLinks.tiktok.label')}
                    </Link>
                  </DropdownMenuItem>
                  <LogoutLink
                    label={t('logout')}
                    confirmLabel={t('logoutConfirm')}
                    className="mt-1 flex w-full items-center gap-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-3 text-sm font-semibold text-red-200 transition-colors active:bg-red-500/25"
                    inline
                  >
                    {({ armed }) => (
                      <>
                        <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
                        <span>{armed ? t('logoutYes') : t('logout')}</span>
                      </>
                    )}
                  </LogoutLink>
    </>
  );

  return (
    <nav className={`${fixedDashboardHeader ? 'dashboard-fixed-header' : 'sticky top-0'} z-50 border-b border-border/60 bg-background/75 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60 ${fixedDashboardHeader ? 'shadow-[0_12px_28px_-16px_rgba(0,0,0,0.7)]' : 'shadow-sm'} ${className}`}>
      <div className={`${edgeToEdge ? 'w-full px-4 sm:px-6 lg:px-8' : 'max-w-7xl xl:max-w-[88rem] mx-auto px-4 md:px-6'} py-3 flex items-center justify-between gap-2 sm:gap-3 min-h-16`}>
        <Link prefetch={false} href="/" className="flex items-center gap-2 shrink-0">
          <WodyLogo className="w-9 h-9" />
          <span className="font-bold text-lg max-[359px]:hidden">Wody</span>
        </Link>
        <div className="flex min-w-0 items-center gap-1 sm:gap-2">
          {!compactDashboardHeader && <>
          <DropdownMenu modal={!desktopMenu} onOpenChange={(open) => { if (open) { setPressedHref(null); loadSpotlight(); } setHoveredHref(null); }}>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                aria-label={t('resources')}
                className="order-4 sm:order-none h-10 rounded-lg px-3.5 text-sm font-semibold gap-1.5 border border-border/60 bg-card/40 hover:bg-card/80 hover:border-border transition-colors px-2.5 sm:px-3.5"
              >
                <Menu className="w-4 h-4" />
                <span className="hidden sm:inline">{t('resources')}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className={`${spotlight?.length ? 'w-[min(96vw,62rem)]' : 'w-[min(94vw,42rem)]'} max-h-[85vh] overflow-y-auto p-0`}>
              <div className="flex flex-col md:flex-row">
              {/* Two columns on desktop (one on phones), each group with its own title,
                  like a classic site "Resources" menu. Help is always listed here too. */}
              <div className="grid flex-1 content-start gap-x-5 gap-y-3 p-3 md:grid-cols-2 md:p-4">
                {RESOURCE_GROUPS.map((column, colIdx) => (
                  <div key={colIdx} className="contents min-w-0 md:block md:space-y-3">
                    {column.map((group) => {
                      const items = group.items.filter((item) => !item.ownerOnly || (!hideOwnerPanelLink && user?.id === OWNER_ID));
                      if (!items.length) return null;
                      return (
                        <div key={group.key} className={`${GROUP_ORDER[group.key]} rounded-2xl border border-border/50 bg-card/30 p-2 md:rounded-none md:border-0 md:bg-transparent md:p-0`}>
                          <DropdownMenuLabel className="flex items-center gap-3 px-2 pb-2 pt-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground md:px-3 md:pt-1">
                            <span className="h-px flex-1 bg-border/60 md:hidden" aria-hidden="true" />
                            <span>{t(`resourceGroups.${group.key}`)}</span>
                            <span className="h-px flex-1 bg-border/60" aria-hidden="true" />
                          </DropdownMenuLabel>
                          <div className="grid grid-cols-2 gap-1.5 md:block md:space-y-0 [&>*:last-child:nth-child(odd)]:col-span-2 md:[&>*:last-child:nth-child(odd)]:col-span-1">
                          {items.map(({ href, key, Icon, external, ownerOnly, tag }) => {
                            const label = ownerOnly ? t('ownerPanel') : t(`resourceLinks.${key}.label`);
                            const desc = t(`resourceLinks.${key}.desc`);
                            const itemClass = `flex w-full flex-col items-center gap-1.5 rounded-xl px-2 py-3 text-center transition-colors duration-150 md:flex-row md:items-start md:gap-3 md:rounded-lg md:px-3 md:py-2.5 md:text-left ${
                              pressedHref === href || hoveredHref === href ? 'bg-primary/20 ring-1 ring-primary/40' : 'active:bg-primary/15'
                            }`;
                            const handlers = {
                              onClick: () => setPressedHref(href),
                              onMouseEnter: () => setHoveredHref(href),
                              onMouseLeave: () => setHoveredHref((h) => (h === href ? null : h)),
                              onFocus: () => setHoveredHref(href),
                              onBlur: () => setHoveredHref((h) => (h === href ? null : h)),
                            };
                            const body = (
                              <>
                                <Icon className={`h-5 w-5 shrink-0 md:mt-0.5 md:h-4 md:w-4 ${ownerOnly ? 'text-[#f2c091]' : 'text-primary'}`} />
                                <span className="min-w-0">
                                  <span className={`block text-sm font-semibold md:text-base md:font-medium ${ownerOnly ? 'text-[#f2c091]' : ''}`}>{label}{tag && <>{' '}<NavTag kind={tag} label={t(`tags.${tag}`)} /></>}</span>
                                  <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground md:text-xs">{desc}</span>
                                </span>
                              </>
                            );
                            return (
                              <DropdownMenuItem key={href} asChild className="p-0 focus:bg-transparent">
                                {external
                                  ? <a href={href} target="_blank" rel="noopener noreferrer" className={itemClass} {...handlers}>{body}</a>
                                  : <Link href={href} aria-current={pathname === href ? 'page' : undefined} className={itemClass} {...handlers}>{body}</Link>}
                              </DropdownMenuItem>
                            );
                          })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
              {/* Spotlight: the newest articles from the blog, next to the links. */}
              {spotlight?.length ? (
                <div className="border-t border-border/60 bg-black/25 p-4 md:w-[21rem] md:shrink-0 md:border-l md:border-t-0">
                  <DropdownMenuLabel className="flex items-center gap-1.5 px-1 pb-3 pt-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#f2c091]"><Sparkles className="h-3.5 w-3.5" aria-hidden="true" />{t('spotlight')}</DropdownMenuLabel>
                  <div className="space-y-2.5">
                    {spotlight.map((post) => {
                      const href = `/blog/${post.slug}`;
                      return (
                        <DropdownMenuItem key={post.slug} asChild className="p-0 focus:bg-transparent">
                          <Link
                            href={href}
                            onClick={() => setPressedHref(href)}
                            onMouseEnter={() => setHoveredHref(href)}
                            onMouseLeave={() => setHoveredHref((h) => (h === href ? null : h))}
                            className={`group flex w-full items-start gap-3 rounded-xl border p-3 transition-colors duration-150 ${pressedHref === href || hoveredHref === href ? 'border-primary/40 bg-primary/15' : 'border-white/[0.06] bg-white/[0.02]'}`}
                          >
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#c46a2d]/40 bg-gradient-to-br from-[#c46a2d]/25 to-[#7c3010]/10 text-[#f2c091] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                              <BookOpen className="h-4 w-4" aria-hidden="true" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="line-clamp-2 text-sm font-semibold leading-snug">{post.title}</span>
                              {post.excerpt ? <span className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{post.excerpt}</span> : null}
                              <span className="mt-1 inline-flex items-center gap-0.5 text-xs font-medium text-primary">{t('readArticle')}<ChevronRight className="h-3 w-3" /></span>
                            </span>
                          </Link>
                        </DropdownMenuItem>
                      );
                    })}
                  </div>
                  <DropdownMenuItem asChild className="mt-2 p-0 focus:bg-transparent">
                    <Link href="/blog" className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-sm font-medium text-primary hover:underline underline-offset-4">
                      {t('allArticles')} <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  </DropdownMenuItem>
                </div>
              ) : null}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
          {/* Order: Help, Resources, then Discover. */}
          <Link href="/servers" className="hidden sm:inline-flex" aria-current={pathname?.startsWith('/servers') ? 'page' : undefined}>
            <Button size="sm" variant="ghost" className="h-10 rounded-lg px-3.5 text-sm font-semibold gap-1.5 border border-border/60 bg-card/40 hover:bg-card/80 hover:border-border transition-colors">
              <Compass className="w-4 h-4 text-primary" />
              {t('discover')}
            </Button>
          </Link>

          {/* PC only: Collab sits right after Discover, same style (phones keep it in the Resources menu). */}
          <Link href="/collab" className="hidden xl:inline-flex" aria-current={pathname?.startsWith('/collab') ? 'page' : undefined}>
            <Button size="sm" variant="ghost" className="h-10 rounded-lg px-3.5 text-sm font-semibold gap-1.5 border border-border/60 bg-card/40 hover:bg-card/80 hover:border-border transition-colors">
              <Briefcase className="w-4 h-4 text-primary" />
              {t('resourceLinks.collab.label')}
            </Button>
          </Link>

          <Link href="/premium" className="hidden sm:inline-flex">
            <Button
              size="sm"
              variant="ghost"
              className="h-10 rounded-lg px-3.5 text-sm font-semibold gap-1.5 border border-[#c46a2d]/50 bg-[#c46a2d]/10 hover:bg-[#e6cd8c] hover:border-[#e6cd8c] text-[#f2c091] hover:text-[#1a1208] transition-colors"
            >
              <Crown className="w-4 h-4" />
              {t('premium')}
            </Button>
          </Link>

          <InviteButton className="hidden sm:inline-flex h-10 rounded-lg px-3.5 text-sm font-semibold" />
          </>}
          {user ? (
            <>
              {/* Client-side hint only, shown purely so the owner has a
                  visible shortcut, every premium API route independently
                  re-verifies the session's Discord user id server-side, so
                  this button existing/not existing never grants or denies
                  access on its own. */}
              {!compactDashboardHeader && showDashboardLink && (
                // Phones open the dashboard from the profile menu instead, so the header stays light.
                <Link href="/dashboard" className="hidden md:inline-flex ml-0.5">
                  <Button size="sm" className="gradient-primary h-10 rounded-lg px-3.5 text-sm font-semibold gap-1.5">
                    {t('dashboard')}
                  </Button>
                </Link>
              )}
              {/* PC: bell, language, then sign out at the far right (flex order), phones keep the bell next to the avatar. */}
              <NotificationBell className="order-3 shrink-0 sm:order-none md:order-[98]" />
              {/* PC: the picture and name go straight to the profile page (no extra menu; Discord and favorites have their own buttons). */}
              <Tip label={t('profileAria')}>
              <Link href="/profile" aria-label={t('profileAria')} className="hidden md:flex items-center gap-2 pl-2 rounded-lg hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e6cd8c]">
                <img
                  src={discordCdnUrl(user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=64` : `https://cdn.discordapp.com/embed/avatars/0.png`)}
                  alt="" className="w-7 h-7 rounded-full"
                />
                <span className="text-sm text-muted-foreground max-w-[120px] truncate">{user.global_name || user.username}</span>
              </Link>
              </Tip>
              {/* Phones: one round avatar button. It opens a small menu with the name, the dashboard and a
                  full-width sign out row, so sign out is big and clear instead of a tiny icon in the bar.
                  The row keeps the two-tap safety: the first tap arms it, the second one signs out. */}
              <DropdownMenu onOpenChange={(open) => { if (!open) setLangOpen(false); }}>
                <DropdownMenuTrigger asChild>
                  <button type="button" aria-label={user.global_name || user.username} className="group order-2 md:hidden inline-flex h-10 shrink-0 items-center gap-0.5 rounded-full border border-border/60 bg-card/40 p-0.5 pr-1.5 transition-colors hover:border-border focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                    <img
                      src={discordCdnUrl(user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=64` : `https://cdn.discordapp.com/embed/avatars/0.png`)}
                      alt="" className="h-8 w-8 rounded-full object-cover"
                    />
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform group-data-[state=open]:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[min(88vw,18rem)] p-2">
                  {renderProfileMenu()}
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : !authResolved && suppressLoginFlash ? (
            // Reserve roughly the width the signed-in cluster (Dashboard
            // button + avatar chip + logout icon) will take once the
            // client-side auth check resolves, so those buttons popping in
            // don't shove everything before them sideways a moment after
            // the page paints, the classic "bar keeps moving" glitch.
            <div className="h-9 w-9 sm:w-28 md:w-56 rounded-md opacity-0 pointer-events-none" aria-hidden="true" />
          ) : (
            <LoginMenu buttonClassName="gradient-primary h-10 rounded-lg px-3.5 text-sm font-semibold" />
          )}

          {/* Language is a set-once-and-forget preference, not a primary
              action, it used to sit wedged between the Premium and Invite
              buttons, in the middle of the CTA cluster, and always showed
              its "EN"/"RO" text even on the smallest screens (unlike every
              other header button, which collapses to icon-only on mobile).
              Moving it to the trailing edge, after auth state, groups it
              with the other "about you" controls (avatar, logout) instead
              of competing with Invite/Dashboard for attention, and hiding
              its label below sm matches the Resources button's treatment
              so it no longer forces extra width on narrow phones. */}
          {user && (
            // Desktop: the favorites shortcut sits right next to the language switch (phones have it in the profile menu).
            <Tip label={t('resourceLinks.favorites.label')}>
            <Link
              href="/servers/favorites"
              aria-label={t('resourceLinks.favorites.label')}
              className="hidden md:inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-card/40 transition-colors hover:bg-card/80 hover:border-border active:bg-card/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <Heart className="h-4 w-4" aria-hidden="true" />
            </Link>
            </Tip>
          )}
          <LanguageSwitcher labelClassName="hidden sm:inline" className={`order-5 sm:order-none ml-0 h-9 w-9 shrink-0 rounded-lg !px-0 sm:ml-0.5 sm:h-10 sm:w-auto sm:!px-3 ${user ? 'max-sm:hidden md:order-[99]' : ''}`} />
          <CommunityButton className="hidden sm:inline-flex h-10 w-10 rounded-lg" anchorClassName={user ? 'md:order-[98]' : ''} />
          {/* PC: sign out is the last button on the right, after language and the community server. */}
          {user && (
            <LogoutLink
              label={t('logout')}
              confirmLabel={t('logoutConfirm')}
              className="hidden md:inline-flex md:order-[100] h-10 w-10 items-center justify-center rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </LogoutLink>
          )}
        </div>
      </div>
    </nav>
  );
}

// Simple, monochrome Discord "clyde" mark (MIT-licensed glyph, Bootstrap Icons
// bi-discord). Rendered with currentColor so it inherits the surrounding
// text/hover color instead of needing its own theming.
function DiscordIcon({ className = 'w-4 h-4' }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className={className} aria-hidden="true">
      <path d="M13.545 2.907a13.2 13.2 0 0 0-3.257-1.011.05.05 0 0 0-.052.025c-.141.25-.297.577-.406.833a12.2 12.2 0 0 0-3.658 0 8 8 0 0 0-.412-.833.05.05 0 0 0-.052-.025c-1.125.194-2.22.534-3.257 1.011a.04.04 0 0 0-.021.018C.356 6.024-.213 9.047.066 12.032q.003.022.021.037a13.3 13.3 0 0 0 3.995 2.02.05.05 0 0 0 .056-.019q.463-.63.818-1.329a.05.05 0 0 0-.01-.059l-.018-.011a9 9 0 0 1-1.248-.595.05.05 0 0 1-.02-.066l.015-.019q.127-.095.248-.195a.05.05 0 0 1 .051-.007c2.619 1.196 5.454 1.196 8.041 0a.05.05 0 0 1 .053.007q.121.1.248.195a.05.05 0 0 1-.004.085 8 8 0 0 1-1.249.594.05.05 0 0 0-.03.03.05.05 0 0 0 .003.041c.24.465.515.909.817 1.329a.05.05 0 0 0 .056.019 13.2 13.2 0 0 0 4.001-2.02.05.05 0 0 0 .021-.037c.334-3.451-.559-6.449-2.366-9.106a.03.03 0 0 0-.02-.019m-8.198 7.307c-.789 0-1.438-.724-1.438-1.612s.637-1.613 1.438-1.613c.807 0 1.45.73 1.438 1.613 0 .888-.637 1.612-1.438 1.612m5.316 0c-.788 0-1.438-.724-1.438-1.612s.637-1.613 1.438-1.613c.807 0 1.451.73 1.438 1.613 0 .888-.631 1.612-1.438 1.612" />
    </svg>
  );
}

// Simple, monochrome TikTok "note" mark (MIT-licensed glyph, Bootstrap Icons
// bi-tiktok), same treatment as DiscordIcon above.
function TikTokIcon({ className = 'w-4 h-4' }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className={className} aria-hidden="true">
      <path d="M9 0h1.98c.144.715.54 1.617 1.235 2.512C12.895 3.389 13.797 4 15 4v2c-1.753 0-3.07-.814-4-1.829V11a5 5 0 1 1-5-5v2a3 3 0 1 0 3 3z" />
    </svg>
  );
}

// Every page from the header (TopNav's Resources menu) plus the two bot
// invite links and the three legal pages, grouped the same way the header
// groups them: Product, Resources, Legal. The order of items *within* each
// column follows the header's actual left-to-right / dropdown order:
// Community -> Help -> Contact -> Careers -> Commands -> Updates -> Premium
// -> Invite -> Dashboard. Keep this in sync with RESOURCE_LINKS above if a
// page is added, renamed or removed there.
function useFooterColumns(t, tn) {
  // Every public page, grouped like the Resources menu: Product, Features (the
  // module pages), Communities, Support, Company, Legal. `tag` adds the small
  // New / Trending label.
  const label = (key) => tn(`resourceLinks.${key}.label`);
  const f = (key) => t(`columns.features.${key}`);
  return [
    {
      key: 'product',
      title: tn('resourceGroups.product'),
      links: [
        { href: INVITE_URL, label: t('columns.wody.invite'), internal: false },
        { href: '/dashboard', label: t('columns.wody.dashboard'), internal: true },
        { href: '/premium', label: label('premium'), internal: true },
        { href: '/commands', label: label('commands'), internal: true },
        { href: '/updates', label: label('updates'), internal: true },
        { href: '/blog', label: label('blog'), internal: true },
      ],
    },
    {
      key: 'features',
      title: f('title'),
      links: [
        { href: '/modules/tickets', label: f('tickets'), internal: true },
        { href: '/modules/automod', label: f('automod'), internal: true },
        { href: '/modules/moderation', label: f('moderation'), internal: true },
        { href: '/modules/reaction_roles', label: f('reactionRoles'), internal: true },
        { href: '/modules/levels', label: f('levels'), internal: true },
        { href: '/leaderboard', label: label('leaderboard'), internal: true },
        { href: '/#passport', label: label('passport'), internal: true, tag: 'new' },
      ],
    },
    {
      key: 'communities',
      title: tn('resourceGroups.communities'),
      links: [
        { href: '/servers', label: label('servers'), internal: true, tag: 'new' },
        { href: '/collab', label: label('collab'), internal: true, tag: 'new' },
        { href: '/servers/favorites', label: label('favorites'), internal: true },
        { href: '/partners', label: label('partners'), internal: true },
        { href: '/dashboard/community', label: t('columns.wody.listYours'), internal: true },
      ],
    },
    {
      key: 'support',
      title: tn('resourceGroups.support'),
      links: [
        { href: '/help', label: label('help'), internal: true },
        { href: COMMUNITY_INVITE, label: label('discord'), internal: false },
        { href: '/contact', label: label('contact'), internal: true },
        { href: '/servers/guidelines', label: t('columns.wody.guidelines'), internal: true },
      ],
    },
    {
      key: 'company',
      title: tn('resourceGroups.company'),
      links: [
        { href: '/team', label: label('team'), internal: true },
        { href: '/careers', label: label('careers'), internal: true },
        { href: '/tiktok', label: label('tiktok'), internal: true },
      ],
    },
    {
      key: 'legal',
      title: t('columns.legal.title'),
      links: [
        { href: '/terms', label: t('columns.legal.terms'), internal: true },
        { href: '/privacy', label: t('columns.legal.privacy'), internal: true },
        { href: '/cookies', label: t('columns.legal.cookies'), internal: true },
      ],
    },
  ];
}

// The footer's social buttons are edited in the owner panel. They start as the built-in set (so the first paint is
// the same for everyone and nothing waits), then the saved list is read once per page load and kept in memory
// (no cookie, no storage); a change made in the panel shows within a minute.
const DEFAULT_FOOTER_LINKS = { discord: COMMUNITY_INVITE, tiktok: TIKTOK_URL, youtube: YOUTUBE_URL };
let footerLinksCache = null;
function useFooterLinks() {
  const [links, setLinks] = useState(footerLinksCache || DEFAULT_FOOTER_LINKS);
  useEffect(() => {
    if (footerLinksCache) { setLinks(footerLinksCache); return undefined; }
    let alive = true;
    const run = () => fetch('/api/site/footer-socials')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.links && typeof d.links === 'object') { footerLinksCache = d.links; if (alive) setLinks(d.links); } })
      .catch(() => {});
    const id = typeof window.requestIdleCallback === 'function' ? window.requestIdleCallback(run, { timeout: 3000 }) : window.setTimeout(run, 800);
    return () => { alive = false; if (typeof window.cancelIdleCallback === 'function' && typeof id === 'number') window.cancelIdleCallback(id); };
  }, []);
  return links;
}

export function Footer() {
  const t = useTranslations('footer');
  const footerLinks = useFooterLinks();
  const tBrand = useTranslations('brand');
  const tn = useTranslations('nav');
  const FOOTER_COLUMNS = useFooterColumns(t, tn);

  return (
    <footer className="border-t border-border/50 mt-0 shrink-0">
      <div className="max-w-7xl mx-auto px-6 md:px-8 py-12 lg:py-14">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-10 lg:gap-16">
          {/* Brand + get in touch */}
          <div className="max-w-xs shrink-0 space-y-5 mx-auto text-center lg:mx-0 lg:text-left">
            <Link prefetch={false} href="/" className="w-fit mx-auto lg:mx-0 block">
              <WodyLogo className="w-14 h-14" />
            </Link>
            <p className="text-sm text-muted-foreground">{tBrand('tagline')}</p>
            <div>
              <div className="text-xs font-semibold tracking-wider text-muted-foreground uppercase mb-3">{t('joinCommunity')}</div>
              <SocialLinks
                variant="footer"
                socials={footerLinks}
                label={t('joinCommunity')}
                extra={(
                  <a
                    href={`mailto:${t('email')}`}
                    aria-label={t('emailAria')}
                    title={t('email')}
                    className="w-10 h-10 rounded-full bg-secondary/60 border border-border/60 flex items-center justify-center text-muted-foreground hover:text-primary-foreground hover:bg-primary hover:border-primary transition-colors"
                >
                    <Mail className="w-4 h-4" />
                </a>
                )}
              />
            </div>
            <p className="text-xs text-muted-foreground">{tBrand('footer')}</p>
          </div>

          {/* Link categories, one column per group, links stacked one under
              another. 2 columns on phones (so 4 groups read as a tidy 2x2
              grid instead of one long single-column stack), all 4 side by
              side from sm up once there's room. */}
          <div className="grid w-full max-w-md mx-auto grid-cols-2 gap-3 sm:max-w-none sm:grid-cols-3 sm:gap-x-8 sm:gap-y-8 lg:mx-0 lg:max-w-5xl lg:flex-1 lg:grid-cols-3 xl:grid-cols-6">
            {FOOTER_COLUMNS.map((col) => (
              <div key={col.key} className="rounded-2xl border border-border/50 bg-card/30 p-4 text-center sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0 sm:text-left [&:last-child:nth-child(odd)]:col-span-2 sm:[&:last-child:nth-child(odd)]:col-span-1">
                <div className="mb-3 flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:mb-4 sm:justify-start">{col.title}</div>
                <ul className="space-y-2.5 sm:space-y-3">
                  {col.links.map((l) => (
                    <li key={l.label}>
                      {l.internal ? (
                        <Link prefetch={false} href={l.href} className="text-sm font-medium text-foreground/90 hover:text-primary transition-colors">
                          {l.label}{l.tag && <>{' '}<NavTag kind={l.tag} label={tn(`tags.${l.tag}`)} /></>}
                        </Link>
                      ) : (
                        <a
                          href={l.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-foreground/90 hover:text-primary transition-colors"
                        >
                          {l.label}
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
