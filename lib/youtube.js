// YouTube channel resolution (official YouTube Data API v3 only, no
// scraping) and WebSub (PubSubHubbub) subscribe/unsubscribe calls to the
// hub YouTube documents at
// https://developers.google.com/youtube/v3/guides/push_notifications.
//
// This module never touches a youtube.com *page*, only the documented
// Data API (googleapis.com) and the documented hub endpoint.

const YT_API = 'https://www.googleapis.com/youtube/v3';
const CHANNEL_ID_RE = /^UC[A-Za-z0-9_-]{22}$/;

function apiKey() {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error('YOUTUBE_API_KEY is not configured');
  return key;
}

async function ytFetch(path, params) {
  const url = new URL(`${YT_API}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set('key', apiKey());
  const res = await fetch(url.toString());
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || `YouTube API error (${res.status})`;
    throw new Error(msg);
  }
  return data;
}

/**
 * Resolve a pasted YouTube channel URL (or a bare channel ID / @handle) to
 * { channelId, title } using only the official YouTube Data API v3.
 * Supports: /channel/UC..., /@handle, /c/CustomName, /user/LegacyName,
 * a bare "UC..." id, or a bare "@handle".
 */
export async function resolveChannelId(input) {
  const raw = String(input || '').trim();
  if (!raw) throw new Error('Please enter a YouTube channel URL.');

  let path = raw;
  try {
    if (/^https?:\/\//i.test(raw)) {
      const u = new URL(raw);
      if (!/(^|\.)youtube\.com$/i.test(u.hostname) && !/(^|\.)youtu\.be$/i.test(u.hostname)) {
        throw new Error('That does not look like a youtube.com URL.');
      }
      path = u.pathname;
    }
  } catch {
    throw new Error('That does not look like a valid URL.');
  }

  path = path.replace(/^\/+|\/+$/g, '');

  // /channel/UCxxxxxxxx or a bare channel id
  let m = path.match(/^(?:channel\/)?(UC[A-Za-z0-9_-]{22})$/);
  if (m) {
    return channelById(m[1]);
  }

  // /@handle or a bare @handle
  m = path.match(/^@([A-Za-z0-9._-]{2,30})$/) || raw.match(/^@([A-Za-z0-9._-]{2,30})$/);
  if (m) {
    return channelByHandle(m[1]);
  }

  // Legacy /user/Username
  m = path.match(/^user\/([A-Za-z0-9_-]+)$/);
  if (m) {
    const byUsername = await channelByLegacyUsername(m[1]);
    if (byUsername) return byUsername;
    return channelBySearch(m[1]);
  }

  // /c/CustomName has no direct API lookup, try it as a handle first
  // (most /c/ links are also valid handles today), then fall back to
  // search.
  m = path.match(/^c\/([A-Za-z0-9._-]+)$/);
  if (m) {
    try {
      return await channelByHandle(m[1]);
    } catch {
      return channelBySearch(m[1]);
    }
  }

  // Anything else the user typed in, last resort, official search
  // endpoint (still the Data API, not scraping).
  return channelBySearch(raw);
}

async function channelById(channelId) {
  const data = await ytFetch('channels', { part: 'snippet', id: channelId });
  const item = data.items?.[0];
  if (!item) throw new Error('No YouTube channel found for that ID.');
  return { channelId: item.id, title: item.snippet?.title || '' };
}

async function channelByHandle(handle) {
  const data = await ytFetch('channels', { part: 'snippet', forHandle: handle });
  const item = data.items?.[0];
  if (!item) throw new Error(`No YouTube channel found for handle "@${handle}".`);
  return { channelId: item.id, title: item.snippet?.title || '' };
}

async function channelByLegacyUsername(username) {
  const data = await ytFetch('channels', { part: 'snippet', forUsername: username });
  const item = data.items?.[0];
  if (!item) return null;
  return { channelId: item.id, title: item.snippet?.title || '' };
}

async function channelBySearch(query) {
  const data = await ytFetch('search', { part: 'snippet', type: 'channel', q: query, maxResults: '1' });
  const item = data.items?.[0];
  if (!item) throw new Error('Could not find a YouTube channel matching that.');
  return { channelId: item.snippet.channelId, title: item.snippet?.title || '' };
}

export function isValidChannelId(id) {
  return CHANNEL_ID_RE.test(String(id || ''));
}

// -------- WebSub (PubSubHubbub) --------

const HUB_URL = process.env.WEBSUB_HUB_URL || 'https://pubsubhubbub.appspot.com/subscribe';

export function topicForChannel(channelId) {
  return `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
}

// The callback URL now embeds a random per-subscription token
// (`callback_token`), NOT just the YouTube channel ID. `channelId` alone
// is public and predictable (it's shown on the channel's own YouTube
// page), so anyone could previously guess a valid callback URL from it
// and submit hub.mode=unsubscribe (or subscribe, pointing elsewhere)
// requests straight to YouTube's public hub for that URL. The hub would
// then send its verification GET to our real, guessed callback, and our
// old handler trusted any such GET, so a guessed channelId was enough to
// silently kill another server's notifications. The signature check on
// POST already stopped forged *video* notifications, but did nothing for
// this GET-based (un)subscribe handshake.
//
// Requiring an unguessable token as part of the URL itself closes that
// gap: nobody can even reach our verification handler for a channel
// without already knowing this secret, so a guessed/public channelId is
// no longer enough to affect anyone's subscription.
function callbackUrl(channelId, token) {
  const base = String(process.env.WEBSUB_CALLBACK_BASE_URL || '').replace(/\/+$/, '');
  if (!base) throw new Error('WEBSUB_CALLBACK_BASE_URL is not configured');
  if (!token) throw new Error('callback token is required to build a WebSub callback URL');
  return `${base}/websub/youtube/${channelId}/${token}`;
}

/**
 * Ask YouTube's documented hub to (un)subscribe our bot's callback to a
 * channel's upload feed. Returns { ok, detail }. A true `ok` means the hub
 * *accepted* the request (HTTP 202/204), the subscription becomes active
 * only once the hub verifies it with a GET back to the dashboard callback
 * route at /websub/youtube/{channelId}/{token}, which answers the handshake.
 *
 * `callbackToken` is the per-subscription random secret embedded in the
 * callback URL path (see callbackUrl() above), required so the hub's
 * verification GET lands on an unguessable path.
 */
export async function subscribeToHub(channelId, secret, callbackToken, { mode = 'subscribe', leaseSeconds } = {}) {
  const topic = topicForChannel(channelId);
  const callback = callbackUrl(channelId, callbackToken);
  const body = new URLSearchParams({
    'hub.mode': mode,
    'hub.topic': topic,
    'hub.callback': callback,
    'hub.verify': 'async',
  });

  if (mode === 'subscribe') {
    body.set('hub.secret', secret);
    if (leaseSeconds) body.set('hub.lease_seconds', String(leaseSeconds));
  }

  // Do not log the secret or callback token. The callback URL is logged only
  // so deployment logs can confirm exactly where the hub was asked to deliver.
  console.info('[YouTube WebSub] Sending hub request', {
    mode,
    channelId,
    topic,
    callback,
    leaseSeconds: leaseSeconds || null,
  });

  try {
    const res = await fetch(HUB_URL, {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    });
    const text = await res.text().catch(() => '');

    console.info('[YouTube WebSub] Hub response', {
      mode,
      channelId,
      status: res.status,
      accepted: res.status === 202 || res.status === 204,
      response: text.slice(0, 300) || null,
    });

    if (res.status === 202 || res.status === 204) {
      return { ok: true, detail: `hub accepted (${res.status})` };
    }

    return { ok: false, detail: `hub returned ${res.status}: ${text.slice(0, 300)}` };
  } catch (e) {
    const detail = String(e?.message || e);
    console.error('[YouTube WebSub] Hub request failed', {
      mode,
      channelId,
      detail,
    });
    return { ok: false, detail };
  }
}

export function unsubscribeFromHub(channelId, secret, callbackToken) {
  return subscribeToHub(channelId, secret, callbackToken, { mode: 'unsubscribe' });
}

export function generateSecret() {
  const bytes = new Uint8Array(32);
  (globalThis.crypto || require('crypto').webcrypto).getRandomValues(bytes);
  return Buffer.from(bytes).toString('base64url');
}

// Separate random value from the HMAC secret on purpose: the secret signs
// notification bodies (hub.secret) and is never part of any URL; the token
// below only ever lives in the callback URL path to make it unguessable.
// Keeping them distinct means rotating one never affects the other.
export function generateCallbackToken() {
  return generateSecret();
}

/** Constant-time comparison for the callback token in the URL path. */
export function verifyCallbackToken(provided, expected) {
  if (!provided || !expected) return false;
  const a = Buffer.from(String(provided), 'utf8');
  const b = Buffer.from(String(expected), 'utf8');
  if (a.length !== b.length) return false;
  const crypto = require('crypto');
  return crypto.timingSafeEqual(a, b);
}

/**
 * Verify the hub's X-Hub-Signature header against our stored
 * per-subscription secret. Mirrors _verify_signature() in the bot's
 * cogs/youtube_notify.py byte-for-byte (same algorithm, same header
 * format: "sha1=<hex>" or "sha256=<hex>") so a notification is trusted
 * identically no matter which side ends up checking it. This is what
 * stops anyone who guesses a callback URL from injecting fake "new
 * video" notifications into the queue.
 *
 * `body` must be the *raw* request bytes (a Buffer/Uint8Array), not a
 * re-encoded string, since the signature is computed over the exact
 * bytes the hub sent.
 */
export function verifyWebSubSignature(body, secret, header) {
  if (!secret || !header || !header.includes('=')) return false;
  const [algo, sig] = header.split('=', 2);
  const nodeAlgo = { sha1: 'sha1', sha256: 'sha256' }[String(algo).toLowerCase()];
  if (!nodeAlgo) return false;
  const crypto = require('crypto');
  const mac = crypto.createHmac(nodeAlgo, secret).update(body).digest('hex');
  const a = Buffer.from(mac, 'utf8');
  const b = Buffer.from(String(sig || ''), 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
