'use client';

export const CONSENT_COOKIE = 'wody_cookie_consent';
export const CONSENT_EVENT = 'wody-cookie-consent-changed';
export const CONSENT_MAX_AGE = 60 * 60 * 24 * 180;

export function readCookieConsent() {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.split('; ').find((row) => row.startsWith(`${CONSENT_COOKIE}=`));
  if (!match) return null;
  try {
    const value = decodeURIComponent(match.slice(CONSENT_COOKIE.length + 1));
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || !['accepted', 'rejected', 'custom'].includes(parsed.choice)) return null;
    return { preferences: parsed.preferences === true, choice: parsed.choice, version: parsed.version || 1 };
  } catch {
    return null;
  }
}

export function writeCookieConsent({ preferences, choice }) {
  if (typeof document === 'undefined') return;
  const value = encodeURIComponent(JSON.stringify({ preferences: preferences === true, choice, version: 1 }));
  document.cookie = `${CONSENT_COOKIE}=${value}; Path=/; Max-Age=${CONSENT_MAX_AGE}; SameSite=Lax; Secure`;
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: { preferences: preferences === true, choice } }));
}
