// Message namespaces that only server components read (with getTranslations). They are never needed in the browser, so the dashboard
// leaves them out of what it sends to the client. A namespace used by a client component must never be listed here; the dashboard test
// checks that.
export const SERVER_ONLY_NAMESPACES = Object.freeze([
  'meta', 'landing', 'careers', 'contact', 'cookies', 'help', 'privacy', 'terms', 'premiumPage', 'commands', 'modulesPage', 'updates',
  'blog', 'team', 'dashboard', 'partners', 'leaderboardPage', 'globalBoard', 'modulesHub', 'policies', 'report', 'miamiPage',
  'battlepassHelp', 'statisticsHelp', 'themesHelp',
]);

export function clientMessages(messages) {
  const out = { ...(messages || {}) };
  for (const ns of SERVER_ONLY_NAMESPACES) delete out[ns];
  return out;
}
