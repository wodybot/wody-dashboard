import sharp from 'sharp';
import * as gifencNs from 'gifenc';

// gifenc is CommonJS in Node and ESM in the bundler: take the functions from whichever shape arrives.
const gifenc = gifencNs.GIFEncoder ? gifencNs : (gifencNs.default || gifencNs);
const { GIFEncoder, quantize, applyPalette } = gifenc;
import { GIF_MAX_DISCORD_BYTES } from './constants';

// Media processing: PNG frames in, one optimized GIF out. Identical neighbouring frames are merged into one longer frame, one
// shared palette keeps the colors stable, and when the result is above the target size the encoder retries with fewer colors,
// fewer frames per second and finally a smaller picture, reusing the frames already drawn.
async function decode(png, w, h) {
  const { data, info } = await sharp(png).resize(w, h, { fit: 'fill' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data: new Uint8Array(data.buffer, data.byteOffset, data.length), w: info.width, h: info.height };
}

export async function encodeGif(pngs, { width, height, fps, colors }, { onProgress, shouldCancel } = {}) {
  const stepMs = Math.round(1000 / fps);
  const decoded = [];
  for (let i = 0; i < pngs.length; i += 6) {
    if (shouldCancel && await shouldCancel()) return { cancelled: true };
    decoded.push(...await Promise.all(pngs.slice(i, i + 6).map((png) => decode(png, width, height))));
  }
  // One palette from a sample of pixels of every few frames.
  const step = Math.max(1, Math.floor(decoded.length / 12));
  const px = width * height;
  const sample = new Uint8Array(Math.ceil(decoded.length / step) * Math.ceil(px / 4) * 4);
  let o = 0;
  for (let i = 0; i < decoded.length; i += step) {
    const d = decoded[i].data;
    for (let j = 0; j < px; j += 4) { sample[o] = d[j * 4]; sample[o + 1] = d[j * 4 + 1]; sample[o + 2] = d[j * 4 + 2]; sample[o + 3] = 255; o += 4; }
  }
  const palette = quantize(sample.subarray(0, o), colors, { format: 'rgb444' });
  const gif = GIFEncoder();
  let prev = null; let prevIdx = null; let written = 0;
  const flush = (idx, delay, first) => gif.writeFrame(idx, width, height, { palette: first ? palette : undefined, first, delay, repeat: 0 });
  let pending = null;
  for (let i = 0; i < decoded.length; i += 1) {
    if (shouldCancel && i % 6 === 0 && await shouldCancel()) return { cancelled: true };
    const idx = applyPalette(decoded[i].data, palette, 'rgb444');
    if (prevIdx && Buffer.compare(Buffer.from(idx.buffer, idx.byteOffset, idx.length), Buffer.from(prevIdx.buffer, prevIdx.byteOffset, prevIdx.length)) === 0) {
      pending.delay += stepMs;
    } else {
      if (pending) { flush(pending.idx, pending.delay, written === 0); written += 1; }
      pending = { idx, delay: stepMs };
    }
    prevIdx = idx; prev = decoded[i];
    if (onProgress && i % 4 === 0) onProgress((i + 1) / decoded.length);
  }
  if (pending) { flush(pending.idx, pending.delay, written === 0); written += 1; }
  gif.finish();
  const buffer = Buffer.from(gif.bytes());
  return { buffer, frames: written, source_frames: decoded.length, width, height, fps, colors, bytes: buffer.length, palette_size: palette.length, _unused: prev ? 0 : 0 };
}

// Reduction plan used when the GIF is above the preset's target size. Each step is smaller than the one before.
export function optimizationSteps(base) {
  const steps = [];
  let { colors, fps, width, height } = base;
  for (let i = 0; i < 4; i += 1) {
    if (i === 0) colors = Math.max(32, Math.floor(colors * 0.75));
    if (i === 1) fps = Math.max(6, Math.floor(fps * 0.75));
    if (i === 2) { width = Math.round(width * 0.85 / 2) * 2; height = Math.round(height * 0.85 / 2) * 2; colors = Math.max(32, Math.floor(colors * 0.75)); }
    if (i === 3) { width = Math.round(width * 0.8 / 2) * 2; height = Math.round(height * 0.8 / 2) * 2; fps = Math.max(5, Math.floor(fps * 0.8)); colors = Math.max(24, Math.floor(colors * 0.75)); }
    steps.push({ colors, fps, width, height });
  }
  return steps;
}

// Real validation of a GIF buffer: signature, dimensions, frame count, loop and size. Used before anything is published.
export async function validateGif(buf, { maxBytes = GIF_MAX_DISCORD_BYTES } = {}) {
  if (!Buffer.isBuffer(buf) || buf.length < 32) return { ok: false, error: 'gif_invalid' };
  const sig = buf.toString('ascii', 0, 6);
  if (sig !== 'GIF89a' && sig !== 'GIF87a') return { ok: false, error: 'gif_invalid' };
  if (buf[buf.length - 1] !== 0x3b) return { ok: false, error: 'gif_truncated' };
  if (buf.length > maxBytes) return { ok: false, error: 'gif_too_large', bytes: buf.length };
  let meta;
  try { meta = await sharp(buf, { animated: true }).metadata(); } catch { return { ok: false, error: 'gif_invalid' }; }
  const frames = meta.pages || 1;
  const delays = meta.delay || [];
  return {
    ok: true, width: meta.width, height: meta.pageHeight || meta.height, frames, loop: meta.loop ?? 0,
    duration_ms: delays.reduce((a, d) => a + d, 0), bytes: buf.length, animated: frames > 1,
  };
}

export async function staticFallback(png) {
  return sharp(png).png({ compressionLevel: 9, palette: true, quality: 90 }).toBuffer();
}
