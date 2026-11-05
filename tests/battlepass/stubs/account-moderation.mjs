import { state } from './state.mjs';
export async function isAccountBlocked(_db, id) { return state.blocked.has(String(id)); }
