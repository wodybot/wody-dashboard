import https from 'node:https';
import dns from 'node:dns';
import net from 'node:net';

const MAX_BYTES = 8 * 1024 * 1024;
const TIMEOUT_MS = 8000;
const MAX_REDIRECTS = 3;
const MAX_URL_LENGTH = 2048;
const MAX_ADDRESS_ATTEMPTS = 3;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const BLOCKED_TLDS = new Set(['localhost', 'local', 'internal', 'localdomain', 'lan', 'arpa']);

class ProxyError extends Error {
  constructor(status, message) {
    super(message || String(status));
    this.status = status;
  }
}



function parseTarget(input, base) {
  let u;
  try {
    u = new URL(input, base);
  } catch {
    throw new ProxyError(400, 'invalid url');
  }
  if (u.protocol !== 'https:') throw new ProxyError(400, 'https only');
  if (u.username || u.password) throw new ProxyError(400, 'credentials in url');
  if (u.port !== '') throw new ProxyError(400, 'port not allowed');

  const host = u.hostname.toLowerCase().replace(/\.$/, '');
  if (!host || host.length > 253) throw new ProxyError(400, 'invalid host');
  if (host.startsWith('[') || net.isIP(host)) throw new ProxyError(400, 'ip literal');
  if (!host.includes('.')) throw new ProxyError(400, 'host needs a dot');
  if (!/^[a-z0-9_.-]+$/.test(host)) throw new ProxyError(400, 'invalid host');
  const labels = host.split('.');
  if (labels.some((l) => !l || l.length > 63)) throw new ProxyError(400, 'invalid host');
  const tld = labels[labels.length - 1];
  if (/^\d+$/.test(tld) || BLOCKED_TLDS.has(tld)) throw new ProxyError(400, 'host not allowed');
  return { url: u, host };
}


function ipv4ToInt(ip) {
  const p = ip.split('.').map(Number);
  return ((p[0] << 24) | (p[1] << 16) | (p[2] << 8) | p[3]) >>> 0;
}

const BLOCKED_V4 = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
].map(([ip, bits]) => {
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return { net: (ipv4ToInt(ip) & mask) >>> 0, mask };
});

function isBlockedIPv4(ip) {
  const n = ipv4ToInt(ip);
  return BLOCKED_V4.some((r) => ((n & r.mask) >>> 0) === r.net);
}

function parseIPv6(input) {
  let s = String(input).split('%')[0].toLowerCase();
  if (s.includes('.')) {
    const i = s.lastIndexOf(':');
    const v4 = s.slice(i + 1);
    if (net.isIPv4(v4)) {
      const n = ipv4ToInt(v4);
      s = `${s.slice(0, i + 1)}${(n >>> 16).toString(16)}:${(n & 0xffff).toString(16)}`;
    } else {
      return null;
    }
  }
  const halves = s.split('::');
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(':') : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  let groups;
  if (halves.length === 2) {
    const missing = 8 - head.length - tail.length;
    if (missing < 1) return null;
    groups = [...head, ...Array(missing).fill('0'), ...tail];
  } else {
    groups = head;
  }
  if (groups.length !== 8) return null;
  const out = groups.map((g) => (/^[0-9a-f]{1,4}$/.test(g) ? parseInt(g, 16) : NaN));
  return out.some(Number.isNaN) ? null : out;
}

function isBlockedIPv6(ip) {
  const g = parseIPv6(ip);
  if (!g) return true;
  if ((g[0] & 0xe000) !== 0x2000) return true;
  if (g[0] === 0x2001 && g[1] === 0x0000) return true;
  if (g[0] === 0x2001 && g[1] === 0x0db8) return true;
  if (g[0] === 0x2002) return true;
  if (g[0] === 0x3fff && (g[1] & 0xf000) === 0) return true;
  return false;
}

function isBlockedIp(ip) {
  const family = net.isIP(ip);
  if (family === 4) return isBlockedIPv4(ip);
  if (family === 6) return isBlockedIPv6(ip);
  return true;
}


function createContext() {
  const ctx = { timedOut: false, active: null, timer: null, deadline: Date.now() + TIMEOUT_MS };
  ctx.expired = new Promise((_, reject) => {
    ctx.timer = setTimeout(() => {
      ctx.timedOut = true;
      if (ctx.active) ctx.active.destroy();
      reject(new ProxyError(504, 'timeout'));
    }, TIMEOUT_MS);
  });
  ctx.expired.catch(() => {});
  return ctx;
}

function remaining(ctx) {
  return Math.max(1, ctx.deadline - Date.now());
}

async function resolvePublic(host, ctx, hop) {
  let list;
  try {
    list = await Promise.race([dns.promises.lookup(host, { all: true, verbatim: true }), ctx.expired]);
  } catch (e) {
    if (e instanceof ProxyError) throw e;
    throw new ProxyError(502, 'dns failure');
  }
  if (!Array.isArray(list) || list.length === 0) throw new ProxyError(502, 'no address');
  if (list.some((a) => isBlockedIp(a.address))) {
    throw new ProxyError(hop === 0 ? 400 : 502, 'blocked address');
  }
  return [...list].sort((a, b) => a.family - b.family).slice(0, MAX_ADDRESS_ATTEMPTS);
}

function requestOnce(url, host, addr, ctx) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        protocol: 'https:',
        hostname: host,
        port: 443,
        path: `${url.pathname}${url.search}`,
        method: 'GET',
        agent: false,
        timeout: remaining(ctx),
        lookup: (_hostname, options, cb) => {
          if (options && options.all) cb(null, [{ address: addr.address, family: addr.family }]);
          else cb(null, addr.address, addr.family);
        },
        headers: {
          Accept: 'image/avif,image/webp,image/png,image/jpeg,image/gif;q=0.9,*/*;q=0.1',
          'Accept-Encoding': 'identity',
          'User-Agent': 'WodyImageProxy/1.0',
        },
      },
      resolve
    );
    ctx.active = req;
    req.on('timeout', () => req.destroy(new Error('socket timeout')));
    req.on('error', reject);
    req.end();
  });
}

async function requestWithFallback(url, host, addrs, ctx) {
  let lastError;
  for (const addr of addrs) {
    if (ctx.timedOut) throw new ProxyError(504, 'timeout');
    try {
      return await requestOnce(url, host, addr, ctx);
    } catch (e) {
      lastError = e;
      if (ctx.timedOut) throw new ProxyError(504, 'timeout');
    }
  }
  throw new ProxyError(502, lastError ? `connect failed: ${lastError.code || lastError.message}` : 'connect failed');
}

function readBody(res, ctx, maxBytes = MAX_BYTES) {
  return new Promise((resolve, reject) => {
    ctx.active = res;
    const chunks = [];
    let total = 0;
    let done = false;
    const finish = (fn, value) => {
      if (done) return;
      done = true;
      fn(value);
    };
    res.on('data', (chunk) => {
      total += chunk.length;
      if (total > maxBytes) {
        res.destroy();
        finish(reject, new ProxyError(413, 'too large'));
        return;
      }
      chunks.push(chunk);
    });
    res.on('end', () => finish(resolve, Buffer.concat(chunks, total)));
    res.on('error', (e) => finish(reject, ctx.timedOut ? new ProxyError(504, 'timeout') : new ProxyError(502, e.message)));
    res.on('close', () => {
      if (!res.complete) finish(reject, ctx.timedOut ? new ProxyError(504, 'timeout') : new ProxyError(502, 'connection closed'));
    });
  });
}


export async function fetchPublicImage(raw, maxBytes = MAX_BYTES) {
  if (!raw || String(raw).length > MAX_URL_LENGTH) throw new ProxyError(400, 'invalid url');
  const ctx = createContext();
  try {
    let { url, host } = parseTarget(String(raw));
    let res = null;
    for (let hop = 0; ; hop++) {
      const addrs = await resolvePublic(host, ctx, hop);
      res = await Promise.race([requestWithFallback(url, host, addrs, ctx), ctx.expired]);
      if (REDIRECT_STATUSES.has(res.statusCode)) {
        const location = res.headers.location;
        res.resume();
        if (!location) throw new ProxyError(502, 'redirect without location');
        if (hop >= MAX_REDIRECTS) throw new ProxyError(502, 'too many redirects');
        try { ({ url, host } = parseTarget(location, url)); } catch { throw new ProxyError(502, 'redirect target not allowed'); }
        continue;
      }
      break;
    }
    if (res.statusCode !== 200) { res.destroy(); throw new ProxyError(502, 'upstream status ' + res.statusCode); }
    const declaredLength = Number(res.headers['content-length']);
    if (Number.isFinite(declaredLength) && declaredLength > maxBytes) { res.destroy(); throw new ProxyError(413, 'too large'); }
    const body = await Promise.race([readBody(res, ctx, maxBytes), ctx.expired]);
    if (body.length === 0) throw new ProxyError(502, 'empty body');
    return body;
  } finally {
    clearTimeout(ctx.timer);
    if (ctx.active && !ctx.active.destroyed) ctx.active.destroy();
  }
}

export { ProxyError };
