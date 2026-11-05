import { state } from './state.mjs';
export async function getDb() { return state.db; }
export function toLong(v) { if (v === null || v === undefined || v === '') return null; try { return BigInt(String(v)); } catch { return null; } }
