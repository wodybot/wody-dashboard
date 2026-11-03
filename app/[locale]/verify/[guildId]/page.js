'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ShieldCheck, CheckCircle2, Loader2, LogIn, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import HumanCheck from '@/components/human-check';
import { Card } from '@/components/ui/card';
import { TopNav, Footer } from '@/components/nav';

function formatCountdown(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

export default function VerifyPage() {
  const { guildId } = useParams();
  const t = useTranslations('verifyPage');
  const [state, setState] = useState({ loading: true });
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState(null);
  const [cooldown, setCooldown] = useState(0);
  const [pass, setPass] = useState('');
  const [checkKey, setCheckKey] = useState(0);
  const [website, setWebsite] = useState('');
  const [challengeError, setChallengeError] = useState(null);

  const fetchStatus = async () => {
    try {
      const r = await fetch(`/api/verify/${guildId}`, { cache: 'no-store' });
      const d = await r.json();
      setState({ loading: false, ...d });
      setCooldown(d?.cooldown_seconds > 0 ? d.cooldown_seconds : 0);
    } catch {
      setState({ loading: false, error: true });
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/verify/${guildId}`, { cache: 'no-store' });
        const d = await r.json();
        if (!cancelled) {
          setState({ loading: false, ...d });
          setCooldown(d?.cooldown_seconds > 0 ? d.cooldown_seconds : 0);
        }
      } catch {
        if (!cancelled) setState({ loading: false, error: true });
      }
    })();
    return () => { cancelled = true; };
  }, [guildId]);
  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          fetchStatus();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cooldown > 0]);

  const doVerify = async () => {
    setVerifying(true);
    setChallengeError(null);
    try {
      const r = await fetch(`/api/verify/${guildId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pass,
          website,
        }),
      });
      const d = await r.json();
      if (!r.ok) {
        const inline = ['challenge_failed', 'challenge_expired', 'too_fast', 'challenge_required'];
        if (inline.includes(d.error)) {
          setChallengeError({ error: d.error, attempts_left: d.attempts_left });
          setPass('');
          setCheckKey((k) => k + 1);
        } else {
          setResult({
            ok: false,
            error: d.error || 'unknown',
            retry_after: d.retry_after,
            required_days: d.required_days,
          });
          if (d.error === 'cooldown' && d.retry_after > 0) setCooldown(d.retry_after);
        }
      } else {
        setResult({ ok: true, already_verified: !!d.already_verified });
      }
    } catch {
      setResult({ ok: false, error: 'network' });
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <div className="absolute inset-0 pointer-events-none -z-10">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-[#7c3010]/20 blur-3xl" />
        <div className="absolute top-40 -right-40 w-[500px] h-[500px] rounded-full bg-[#c46a2d]/10 blur-3xl" />
      </div>
      <TopNav suppressLoginFlash />

      <main className="max-w-md mx-auto px-4 pt-24 pb-24">
        <Card className="p-6 sm:p-8 bg-card/60 text-center space-y-5">
          {state.loading ? (
            <div className="flex flex-col items-center gap-3 py-10 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin" />
              <p className="text-sm">{t('loading')}</p>
            </div>
          ) : state.error || state.enabled === false ? (
            <div className="py-6 space-y-2">
              <p className="font-semibold">{t('unavailableTitle')}</p>
              <p className="text-sm text-muted-foreground">{t('unavailableText')}</p>
            </div>
          ) : (
            <>
              <div className="mx-auto w-14 h-14 rounded-full bg-[#e08a4e]/15 flex items-center justify-center">
                <ShieldCheck className="w-7 h-7 text-[#e08a4e]" />
              </div>

              {state.guild_name && <p className="text-3xl sm:text-4xl font-extrabold leading-tight tracking-tight text-foreground break-words">{state.guild_name}</p>}
              <h1 className="text-lg font-semibold">{state.texts?.heading || 'Member Verification'}</h1>
              <p className="text-sm text-muted-foreground">{state.texts?.description}</p>

              {result?.ok ? (
                <div className="pt-2 space-y-2">
                  <div className="mx-auto w-12 h-12 rounded-full bg-emerald-500/15 flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                  </div>
                  <p className="font-semibold">{state.texts?.success_heading || 'You are verified'}</p>
                  <p className="text-sm text-muted-foreground">
                    {result.already_verified
                      ? (state.texts?.already_verified_message || 'You are already verified on this server.')
                      : (state.texts?.success_message || 'You can go back to Discord, your role has been granted.')}
                  </p>
                </div>
              ) : result && !result.ok ? (
                <div className="pt-2 space-y-3">
                  {result.error === 'cooldown' ? (
                    <>
                      <div className="mx-auto w-12 h-12 rounded-full bg-[#e08a4e]/15 flex items-center justify-center">
                        <Clock className="w-6 h-6 text-[#e08a4e]" />
                      </div>
                      <p className="text-sm text-muted-foreground">{t('cooldownMessage', { time: formatCountdown(cooldown) })}</p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-rose-400">
                        {result.error === 'not_member'
                          ? (state.texts?.not_member_message || 'You are not a member of this server.')
                          : result.error === 'rate_limited'
                            ? t('rateLimited')
                            : result.error === 'account_too_new'
                              ? t('accountTooNew', { days: result.required_days ?? 0 })
                              : t('genericError')}
                      </p>
                      {result.error !== 'account_too_new' ? (
                        <Button onClick={doVerify} disabled={verifying} className="gradient-primary w-full">
                          {verifying ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                          {t('tryAgain')}
                        </Button>
                      ) : null}
                    </>
                  )}
                </div>
              ) : !state.authenticated ? (
                <div className="pt-2">
                  <a href={`/api/auth/login?next=${encodeURIComponent(`/verify/${guildId}`)}`}>
                    <Button className="gradient-primary w-full">
                      <LogIn className="w-4 h-4 mr-2" />
                      {t('loginButton')}
                    </Button>
                  </a>
                </div>
              ) : cooldown > 0 ? (
                <div className="pt-2 space-y-2">
                  <div className="mx-auto w-12 h-12 rounded-full bg-[#e08a4e]/15 flex items-center justify-center">
                    <Clock className="w-6 h-6 text-[#e08a4e]" />
                  </div>
                  <p className="text-sm text-muted-foreground">{t('cooldownMessage', { time: formatCountdown(cooldown) })}</p>
                </div>
              ) : state.already_verified ? (
                <p className="text-sm text-muted-foreground pt-2">{state.texts?.already_verified_message}</p>
              ) : state.is_member === false ? (
                <p className="text-sm text-rose-400 pt-2">{state.texts?.not_member_message}</p>
              ) : (
                <div className="pt-2 space-y-4">
                  {challengeError ? (
                    <p className="text-sm text-rose-400">
                      {t('challengeExpired')}
                    </p>
                  ) : null}

                  <div className="flex justify-center">
                    <HumanCheck purpose="verify" ctx={state.check_ctx || ''} resetKey={checkKey} onPass={setPass} />
                  </div>

                  <div aria-hidden="true" className="absolute left-[-9999px] top-auto w-px h-px overflow-hidden">
                    <label htmlFor="wody-website">Website</label>
                    <input
                      id="wody-website"
                      name="website"
                      type="text"
                      tabIndex={-1}
                      autoComplete="off"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                    />
                  </div>

                  <Button
                    onClick={doVerify}
                    disabled={verifying || !pass}
                    className="gradient-primary w-full"
                  >
                    {verifying ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    {state.texts?.button_label || 'Verify'}
                  </Button>
                </div>
              )}
            </>
          )}
        </Card>
      </main>

      <Footer />
    </div>
  );
}
