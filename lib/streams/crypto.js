import crypto from 'crypto';

function key() {
  const raw = (process.env.STREAMS_TOKEN_KEY || '').trim();
  if (!raw) throw new Error('STREAMS_TOKEN_KEY is not set');
  let buf = null;
  if (/^[0-9a-fA-F]{64}$/.test(raw)) buf = Buffer.from(raw, 'hex');
  else {
    try { buf = Buffer.from(raw, 'base64'); } catch { buf = null; }
  }
  if (!buf || buf.length !== 32) throw new Error('STREAMS_TOKEN_KEY must be 32 bytes (64 hex characters)');
  return buf;
}

export function tokenCryptoConfigured() {
  try { key(); return true; } catch { return false; }
}

export function encryptToken(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  return `v1:${Buffer.concat([iv, enc, cipher.getAuthTag()]).toString('base64')}`;
}

export function decryptToken(blob) {
  if (!blob || !String(blob).startsWith('v1:')) throw new Error('unknown token format');
  const raw = Buffer.from(String(blob).slice(3), 'base64');
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(raw.length - 16);
  const body = raw.subarray(12, raw.length - 16);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8');
}
