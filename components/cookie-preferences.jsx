'use client';

import { useEffect, useState } from 'react';
import { readCookieConsent, writeCookieConsent } from '@/components/cookie-consent';

export default function CookiePreferences() {
  const [loaded, setLoaded] = useState(false);
  const [preferences, setPreferences] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => { const c=readCookieConsent(); setPreferences(c?.preferences === true); setLoaded(true); }, []);
  function save(enabled) {
    writeCookieConsent({ preferences: enabled, choice: enabled ? 'custom' : 'rejected' });
    if (!enabled) document.cookie='wody_language=; Path=/; Max-Age=0; SameSite=Lax; Secure';
    setPreferences(enabled); setMessage('Your cookie preferences have been updated.');
  }
  if (!loaded) return null;
  return <div className="mt-4 rounded-2xl border border-[#a04820]/40 bg-card/60 p-5 text-foreground">
    <h3 className="text-base font-semibold">Manage your cookie preferences</h3>
    <p className="text-sm text-muted-foreground mt-2">Strictly necessary cookies remain active because they are needed for security, authentication and remembering your privacy choice. You can control the optional language preference below.</p>
    <label className="mt-4 flex items-start gap-3 cursor-pointer"><input type="checkbox" checked={preferences} onChange={(e)=>setPreferences(e.target.checked)} className="mt-1 h-4 w-4 accent-[#e08a4e]" /><span><span className="font-medium">Preferences</span><span className="block text-sm text-muted-foreground mt-1">Allow the language selector and the <code>wody_language</code> cookie to remember the language you choose.</span></span></label>
    <button onClick={()=>save(preferences)} className="mt-4 rounded-md bg-[#7c3010] hover:bg-[#8f3a17] text-white px-4 py-2 text-sm font-medium transition">Save preferences</button>
    {message && <p className="mt-3 text-sm text-muted-foreground" role="status">{message}</p>}
  </div>;
}
