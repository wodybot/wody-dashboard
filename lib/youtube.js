
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

  let m = path.match(/^(?:channel\/)?(UC[A-Za-z0-9_-]{22})$/);
  if (m) {
    return channelById(m[1]);
  }

  m = path.match(/^@([A-Za-z0-9._-]{2,30})$/) || raw.match(/^@([A-Za-z0-9._-]{2,30})$/);
  if (m) {
    return channelByHandle(m[1]);
  }

  m = path.match(/^user\/([A-Za-z0-9_-]+)$/);
  if (m) {
    const byUsername = await channelByLegacyUsername(m[1]);
    if (byUsername) return byUsername;
    return channelBySearch(m[1]);
  }

  m = path.match(/^c\/([A-Za-z0-9._-]+)$/);
  if (m) {
    try {
      return await channelByHandle(m[1]);
    } catch {
      return channelBySearch(m[1]);
    }
  }

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


const HUB_URL = process.env.WEBSUB_HUB_URL || 'https://pubsubhubbub.appspot.com/subscribe';

export function topicForChannel(channelId) {
  return `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
}

function callbackUrl(channelId, token) {
  const base = String(process.env.WEBSUB_CALLBACK_BASE_URL || '').replace(/\/+$/, '');
  if (!base) throw new Error('WEBSUB_CALLBACK_BASE_URL is not configured');
  if (!token) throw new Error('callback token is required to build a WebSub callback URL');
  return `${base}/websub/youtube/${channelId}/${token}`;
}

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

export function generateCallbackToken() {
  return generateSecret();
}

export function verifyCallbackToken(provided, expected) {
  if (!provided || !expected) return false;
  const a = Buffer.from(String(provided), 'utf8');
  const b = Buffer.from(String(expected), 'utf8');
  if (a.length !== b.length) return false;
  const crypto = require('crypto');
  return crypto.timingSafeEqual(a, b);
}

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
