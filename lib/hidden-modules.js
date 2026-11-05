export const HIDDEN_MODULES = new Set([]);
export const isVisibleModule = (key) => !HIDDEN_MODULES.has(key);
