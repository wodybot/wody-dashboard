'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Cookie, Settings2, X } from 'lucide-react';
import { readCookieConsent, writeCookieConsent } from '@/components/cookie-consent';

export default function CookieNotice() {
  const [visible, setVisible] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const [preferences, setPreferences] = useState(false);

  useEffect(() => {
    if (window.location.pathname.includes('/servers/preview-frame')) return;
    const current = readCookieConsent();
    setPreferences(current?.preferences === true);
    setVisible(!current);
  }, []);

  function save(choice, enabled) {
    writeCookieConsent({ choice, preferences: enabled });
    setPreferences(enabled);
    setVisible(false);
    setCustomizing(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 inset-x-4 sm:inset-x-0 sm:flex sm:justify-center z-[100]" role="dialog" aria-modal="true" aria-labelledby="cookie-consent-title">
      <div className="sm:w-full sm:max-w-xl rounded-2xl border border-[#a04820]/40 bg-card/95 backdrop-blur shadow-2xl shadow-black/40 p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#7c3010]/30 text-[#e08a4e] flex items-center justify-center shrink-0"><Cookie className="w-5 h-5" /></div>
          <div className="flex-1 min-w-0">
            <h2 id="cookie-consent-title" className="text-base font-semibold mb-2">Your privacy choices</h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Wody uses strictly necessary technologies to provide secure Discord authentication and to remember your cookie choice. With your consent, we also use the <code className="text-[11px]">wody_language</code> preference cookie so the language you choose can be remembered. No analytics, advertising, profiling or third-party tracking cookies are used.
            </p>
            <p className="text-xs text-muted-foreground mt-2">You can accept, reject optional preferences, or choose your preferences. You can change or withdraw your choice at any time in our <Link prefetch={false} href="/cookies" className="text-[#e08a4e] hover:underline">Cookie Policy</Link>. You can also read our <Link prefetch={false} href="/terms" className="text-[#e08a4e] hover:underline">Terms and Conditions</Link> and <Link prefetch={false} href="/privacy" className="text-[#e08a4e] hover:underline">Privacy Policy</Link> for more information.</p>

            {customizing && (
              <div className="mt-4 rounded-xl border border-border/60 bg-background/30 p-3 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div><div className="text-sm font-medium">Strictly necessary</div><p className="text-xs text-muted-foreground mt-1">Authentication, security and saving your cookie choice. Always active because these functions are necessary to provide the requested service.</p></div>
                  <span className="text-xs font-medium text-muted-foreground shrink-0">Always active</span>
                </div>
                <label className="flex items-start justify-between gap-4 cursor-pointer">
                  <div><div className="text-sm font-medium">Preferences</div><p className="text-xs text-muted-foreground mt-1">Allows the language selector and the <code className="text-[11px]">wody_language</code> cookie to remember the language you choose.</p></div>
                  <input type="checkbox" checked={preferences} onChange={(e) => setPreferences(e.target.checked)} className="mt-1 h-4 w-4 accent-[#e08a4e]" />
                </label>
              </div>
            )}

            <div className="mt-4 flex flex-nowrap items-center gap-1.5 overflow-x-auto sm:overflow-visible">
              <button onClick={() => save('accepted', true)} className="shrink-0 rounded-md bg-[#7c3010] hover:bg-[#8f3a17] text-white px-2.5 sm:px-3 py-2 text-[11px] sm:text-xs font-medium transition whitespace-nowrap">Accept</button>
              <button onClick={() => save('rejected', false)} className="shrink-0 rounded-md bg-[#4a3325] hover:bg-[#59402f] text-white px-2.5 sm:px-3 py-2 text-[11px] sm:text-xs font-medium transition whitespace-nowrap">Reject</button>
              {!customizing ? <button onClick={() => setCustomizing(true)} className="shrink-0 rounded-md border border-border/70 hover:bg-background/60 px-2.5 sm:px-3 py-2 text-[11px] sm:text-xs font-medium transition inline-flex items-center gap-1.5 whitespace-nowrap"><Settings2 className="w-3.5 h-3.5 shrink-0" />Customize</button> : <button onClick={() => save('custom', preferences)} className="shrink-0 rounded-md border border-[#a04820]/50 hover:bg-background/60 px-2.5 sm:px-3 py-2 text-[11px] sm:text-xs font-medium transition whitespace-nowrap">Save choices</button>}
            </div>
          </div>
          <button onClick={() => save('rejected', false)} className="text-muted-foreground hover:text-foreground shrink-0" aria-label="Reject optional cookies"><X className="w-4 h-4" /></button>
        </div>
      </div>
    </div>
  );
}
