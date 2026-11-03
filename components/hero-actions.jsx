'use client';
import { useTranslations } from 'next-intl';
import { Bot, Server } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { InviteButton } from '@/components/nav';
import { LoginMenu } from '@/components/login-menu';
import { INVITE_URL } from '@/lib/content';
import { useSessionUser } from '@/components/use-session-user';

export function HeroActions({ user: serverUser, primaryLabel, moreLabel }) {
  const tNav = useTranslations('nav');
  const user = useSessionUser(serverUser);
  return (
    <>
      {user ? (
        <>
          <Link href="/dashboard">
            <Button size="lg" className="gradient-primary text-base">
              <Server className="w-4 h-4 mr-2" /> {tNav('openDashboard')}
            </Button>
          </Link>
          <InviteButton variant="premium" size="lg" className="text-base" />
        </>
      ) : (
        <>
          <a href={INVITE_URL} target="_blank" rel="noopener noreferrer" className="order-1">
            <Button size="lg" className="gradient-primary text-base">
              <Bot className="w-4 h-4 mr-2" /> {tNav('invite')}
            </Button>
          </a>
          <div className="order-2">
            <LoginMenu size="lg" variant="outline" label={primaryLabel} align="center" buttonClassName="text-base" />
          </div>
        </>
      )}
      <a href="#modules" className="order-3">
        <Button size="lg" variant="ghost" className="text-base">{moreLabel}</Button>
      </a>
    </>
  );
}
