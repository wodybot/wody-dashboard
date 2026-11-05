export async function getDb() { throw new Error('no database in unit tests'); }
export function toLong(v) { return BigInt(v); }
