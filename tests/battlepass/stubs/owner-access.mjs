import { state } from './state.mjs';
export const OWNER_ID = '1000000000000000001';
export async function getDelegate(_db, id) { return state.delegates.has(String(id)) ? { _id: String(id) } : null; }
export function trustedOrigin(request) { return request.headers.get('origin') === 'https://wody.test'; }
