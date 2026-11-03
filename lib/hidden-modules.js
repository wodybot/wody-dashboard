export const HIDDEN_MODULES = new Set(['lookups', 'feeds']);
export const isVisibleModule = (key) => !HIDDEN_MODULES.has(key);
