// Pure validation for requests and applications. The API is authoritative; the UI
// uses the same codes (translated in messages/*.json under "marketplace.err").
import { LIMITS, CATEGORY_RE, ID_RE, LOCALES } from './constants.js';
import { findPersonalContact, inspectUrl } from './guard.js';

const CTRL = /[\u0000-\u001f\u007f​-‏‪-‮⁦-⁩]/g;
export const cleanLine = (v, max) => String(v ?? '').replace(CTRL, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
export const cleanBlock = (v, max) => String(v ?? '').replace(/\r\n?/g, '\n')
  .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f​-‏‪-‮⁦-⁩]/g, '').replace(/\n{4,}/g, '\n\n\n').trim().slice(0, max);

const add = (errors, field, code, params) => errors.push({ field, code, ...(params ? { params } : {}) });

function lenCheck(errors, field, value, { min = 0, max }) {
  if (value.length < min) add(errors, field, 'too_short', { min });
  if (value.length > max) add(errors, field, 'too_long', { max });
}
function noContact(errors, field, value) {
  if (findPersonalContact(value).length) add(errors, field, 'personal_contact');
}

export function normalizeTag(t) {
  return cleanLine(t, LIMITS.tags.each).toLowerCase().replace(/[^\p{L}\p{N}+#. -]/gu, '').replace(/\s+/g, '-').replace(/^-+|-+$/g, '').slice(0, LIMITS.tags.each);
}

// Returns { content, errors }. `categories` is the set of enabled category slugs.
export function validateRequest(input, { categories }) {
  const errors = [];
  const b = input && typeof input === 'object' ? input : {};
  const title = cleanLine(b.title, 200);
  const description = cleanBlock(b.description, 20000);
  const outcome = cleanBlock(b.outcome, 5000);
  const requirements = cleanBlock(b.requirements, 5000);
  lenCheck(errors, 'title', title, LIMITS.title);
  lenCheck(errors, 'description', description, LIMITS.description);
  lenCheck(errors, 'outcome', outcome, { max: LIMITS.outcome.max });
  lenCheck(errors, 'requirements', requirements, { max: LIMITS.requirements.max });
  for (const [f, v] of [['title', title], ['description', description], ['outcome', outcome], ['requirements', requirements]]) if (v) noContact(errors, f, v);

  const category = String(b.category || '');
  if (!CATEGORY_RE.test(category) || !categories.has(category)) add(errors, 'category', 'invalid_category');

  const tagsIn = Array.isArray(b.tags) ? b.tags : [];
  const tags = [...new Set(tagsIn.map(normalizeTag).filter(Boolean))];
  if (tagsIn.length > LIMITS.tags.max || tags.length > LIMITS.tags.max) add(errors, 'tags', 'too_many', { max: LIMITS.tags.max });
  const tagsOut = tags.slice(0, LIMITS.tags.max);

  const linksIn = Array.isArray(b.links) ? b.links : [];
  if (linksIn.length > LIMITS.links.max) add(errors, 'links', 'too_many', { max: LIMITS.links.max });
  const links = [];
  linksIn.slice(0, LIMITS.links.max).forEach((raw, i) => {
    const s = cleanLine(raw, 300);
    if (!s) return;
    const r = inspectUrl(s);
    if (!r.ok) add(errors, `links.${i}`, `link_${r.reason}`);
    else if (!links.includes(r.url)) links.push(r.url);
  });

  const language = LOCALES.includes(b.language) ? b.language : 'en';

  let deadline = null;
  if (b.deadline) {
    const d = new Date(`${String(b.deadline).slice(0, 10)}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(b.deadline).slice(0, 10)) || Number.isNaN(d.getTime())) add(errors, 'deadline', 'invalid_date');
    else if (d.getTime() < Date.now() - 86_400_000) add(errors, 'deadline', 'past_date');
    else if (d.getTime() > Date.now() + LIMITS.deadlineDays * 86_400_000) add(errors, 'deadline', 'too_far');
    else deadline = d.toISOString().slice(0, 10);
  }

  const qIn = Array.isArray(b.questions) ? b.questions : [];
  if (qIn.length > LIMITS.questions.max) add(errors, 'questions', 'too_many', { max: LIMITS.questions.max });
  const questions = qIn.slice(0, LIMITS.questions.max).map((q) => cleanLine(q, LIMITS.questions.each)).filter(Boolean);
  questions.forEach((q, i) => noContact(errors, `questions.${i}`, q));

  const attachIn = Array.isArray(b.attachments) ? b.attachments : [];
  if (attachIn.length > LIMITS.attachments.max) add(errors, 'attachments', 'too_many', { max: LIMITS.attachments.max });
  const attachments = [...new Set(attachIn.filter((x) => ID_RE.test(String(x))).map(String))].slice(0, LIMITS.attachments.max);

  const contact_mode = b.contact_mode === 'discord' ? 'discord' : 'internal';
  const public_contact = Boolean(b.public_contact);
  const origin_guild_id = /^\d{15,25}$/.test(String(b.origin_guild_id || '')) ? String(b.origin_guild_id) : null;

  return {
    errors,
    content: {
      title, description, category, tags: tagsOut, outcome, requirements, links, language, deadline, questions, attachments,
      contact_mode, public_contact, origin_guild_id,
    },
  };
}

export function validateApplication(input, { questions = [] }) {
  const errors = [];
  const b = input && typeof input === 'object' ? input : {};
  const intro = cleanBlock(b.intro, 5000);
  const experience = cleanBlock(b.experience, 5000);
  const approach = cleanBlock(b.approach, 5000);
  const duration = cleanLine(b.duration, 200);
  lenCheck(errors, 'intro', intro, LIMITS.intro);
  lenCheck(errors, 'experience', experience, { max: LIMITS.experience.max });
  lenCheck(errors, 'approach', approach, { max: LIMITS.approach.max });
  lenCheck(errors, 'duration', duration, { max: LIMITS.duration.max });
  for (const [f, v] of [['intro', intro], ['experience', experience], ['approach', approach], ['duration', duration]]) if (v) noContact(errors, f, v);
  const skillsIn = Array.isArray(b.skills) ? b.skills : [];
  if (skillsIn.length > LIMITS.skills.max) add(errors, 'skills', 'too_many', { max: LIMITS.skills.max });
  const skills = [...new Set(skillsIn.map(normalizeTag).filter(Boolean))].slice(0, LIMITS.skills.max);
  const pIn = Array.isArray(b.portfolio) ? b.portfolio : [];
  if (pIn.length > LIMITS.portfolio.max) add(errors, 'portfolio', 'too_many', { max: LIMITS.portfolio.max });
  const portfolio = [];
  pIn.slice(0, LIMITS.portfolio.max).forEach((raw, i) => {
    const s = cleanLine(raw, 300); if (!s) return;
    const r = inspectUrl(s);
    if (!r.ok) add(errors, `portfolio.${i}`, `link_${r.reason}`); else portfolio.push(r.url);
  });
  const aIn = Array.isArray(b.answers) ? b.answers : [];
  const answers = questions.map((_, i) => cleanBlock(aIn[i], 2000).slice(0, LIMITS.answer.max));
  answers.forEach((a, i) => { if (!a) add(errors, `answers.${i}`, 'required'); else noContact(errors, `answers.${i}`, a); });
  return { errors, content: { intro, experience, approach, duration, skills, portfolio, answers } };
}

// Fields compared for "what changed" in the moderation view.
export const DIFF_FIELDS = ['title', 'description', 'outcome', 'requirements', 'category', 'tags', 'links', 'language', 'deadline', 'questions', 'attachments', 'contact_mode', 'public_contact'];
export function diffContent(a, b) {
  const out = [];
  for (const f of DIFF_FIELDS) {
    const x = JSON.stringify(a?.[f] ?? null); const y = JSON.stringify(b?.[f] ?? null);
    if (x !== y) out.push({ field: f, before: a?.[f] ?? null, after: b?.[f] ?? null });
  }
  return out;
}
