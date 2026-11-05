// GIF Preview Studio constants. A GIF item is one animated preview of a real Wody module (Profile page, Passport, Collab)
// or of the latest real features. Nothing here is invented: the copy lives in messages/<locale>.json (gifStudio.content).
export const GIF_STATUSES = Object.freeze(['draft', 'generating', 'ready', 'published', 'scheduled', 'archived', 'failed']);
export const GIF_KINDS = Object.freeze(['module', 'latest', 'custom']);
export const GIF_MODULES = Object.freeze(['trio', 'profile', 'passport', 'collab', 'link', 'battlepass', 'counting', 'statistics', 'themes']);
export const PREVIEW_SOURCES = Object.freeze(['image', 'gif', 'module', 'latest', 'custom']);
export const TIMELINE_PHASES = Object.freeze(['intro', 'reveal', 'features', 'latest', 'final']);
export const PALETTES = Object.freeze({
  wody: { bg1: '#150c07', bg2: '#2a1509', accent: '#e08a4e', text: '#ffffff', soft: '#f1e7db' },
  gold: { bg1: '#0d0a02', bg2: '#3a2a06', accent: '#facc15', text: '#ffffff', soft: '#f5ecc8' },
  night: { bg1: '#07060f', bg2: '#241a55', accent: '#a78bfa', text: '#ffffff', soft: '#e6e0ff' },
  aurora: { bg1: '#04110f', bg2: '#12385a', accent: '#5eead4', text: '#ffffff', soft: '#d9fbf3' },
});
// Discord shows a linked image up to 10 MB; the targets stay below that so the preview always loads.
export const PRESETS = Object.freeze({
  standard: { width: 600, height: 315, fps: 10, colors: 128, maxBytes: 5 * 1024 * 1024 },
  high_quality: { width: 800, height: 420, fps: 14, colors: 256, maxBytes: 8 * 1024 * 1024 },
  discord: { width: 600, height: 315, fps: 10, colors: 96, maxBytes: 3 * 1024 * 1024 },
  cinematic: { width: 960, height: 504, fps: 16, colors: 256, maxBytes: 9 * 1024 * 1024 },
  custom: { width: 600, height: 315, fps: 10, colors: 128, maxBytes: 5 * 1024 * 1024 },
});
export const LIMITS = Object.freeze({
  name: 60, title: 40, subtitle: 80, feature: 70, cta: 40, features: 4,
  width: [320, 1200], height: [168, 630], fps: [4, 20], colors: [16, 256], maxMb: [1, 9],
  phaseMs: [600, 5000], totalMs: [3000, 20000], versions: 30, history: 100, items: 100,
});
export const RENDERER_VERSION = 4;
export const GIF_PUBLIC_PATH = '/api/gif-preview';
export const GIF_MAX_DISCORD_BYTES = 10 * 1024 * 1024;
