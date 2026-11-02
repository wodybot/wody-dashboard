'use client';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const STORAGE_KEY = 'wody:login:joinCommunity';

// Login dropdown with the "Join our Discord" checkbox. When ticked, the login
// request carries ?join=1, Discord's consent screen then also asks for the
// official "guilds.join" permission and, after the login, the bot adds the
// member to the Wody community server directly (no invite to accept).
// The checkbox always starts UNCHECKED: it is never pre-ticked for the
// visitor, only the visitor can turn it on. A tick the visitor made themselves
// on a previous visit is remembered in this browser; storage failures are ignored.
export function LoginMenu({ label, next, size = 'sm', variant, buttonClassName = '', align = 'end' }) {
  const t = useTranslations('nav');
  const [join, setJoin] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try { if (window.localStorage.getItem(STORAGE_KEY) === '1') setJoin(true); } catch { /* storage unavailable */ }
  }, []);

  function onJoinChange(v) {
    const on = v === true;
    setJoin(on);
    try { window.localStorage.setItem(STORAGE_KEY, on ? '1' : '0'); } catch { /* storage unavailable */ }
  }

  const params = new URLSearchParams();
  if (next) params.set('next', next);
  if (join) params.set('join', '1');
  const qs = params.toString();
  const href = `/api/auth/login${qs ? `?${qs}` : ''}`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size={size} variant={variant} className={`gap-1 ${buttonClassName}`}>
          {label || t('login')}
          <ChevronDown className="opacity-70 -mr-0.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align={align} className="w-64 space-y-3">
        <label className="flex items-center gap-2.5 text-sm cursor-pointer select-none">
          <Checkbox checked={join} onCheckedChange={onJoinChange} />
          <span>{t('joinDiscordCheckbox')}</span>
        </label>
        <a href={href} className="block">
          <Button className="gradient-primary w-full">{t('loginButton')}</Button>
        </a>
        {join && <p className="text-xs text-muted-foreground">{t('joinDiscordHint')}</p>}
      </PopoverContent>
    </Popover>
  );
}
