// Same validation as the bot: run the shared cases through lib/profile-card.js and compare.
import fs from 'node:fs';
import { applyPatch, normalizeConfig, PROFILE_CARD_DEFAULT } from '../lib/profile-card.js';

const cases = JSON.parse(fs.readFileSync(new URL('./profile-card-parity-cases.json', import.meta.url)));
let bad = 0;
const same = (a, b) => JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort());
for (const c of cases.patches) {
  let got;
  try { const r = applyPatch(PROFILE_CARD_DEFAULT, c.patch); got = { keys: r.keys, config: r.config }; } catch (e) { got = { error: e.message }; }
  const ok = c.error !== undefined ? got.error === c.error : (!got.error && same(got.keys, c.keys) && same(got.config, c.config));
  if (!ok) { bad++; console.log('DIFF', JSON.stringify(c.patch).slice(0, 80), JSON.stringify(got).slice(0, 120), c.error ?? ''); }
}
for (const c of cases.normalize) if (!same(normalizeConfig(c.stored), c.config)) { bad++; console.log('DIFF normalize', JSON.stringify(c.stored)); }
console.log(bad ? `${bad} differences` : `${cases.patches.length + cases.normalize.length}/${cases.patches.length + cases.normalize.length} cases agree`);
process.exit(bad ? 1 : 0);
