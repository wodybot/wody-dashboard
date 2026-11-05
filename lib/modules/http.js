import { NextResponse } from 'next/server';

export function json(data, init = {}) {
  return NextResponse.json(data, { ...init, headers: { 'Cache-Control': 'no-store, private', ...(init.headers || {}) } });
}

export function validationError(errors) {
  return json({ error: 'validation_failed', errors }, { status: 400 });
}

export const premiumRequired = () => json({ error: 'premium_required' }, { status: 403 });
export const notFound = () => json({ error: 'not_found' }, { status: 404 });

export function clampPage(v) {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 && n < 100000 ? n : 0;
}
