// Delivery form of a Premium server. The owner defines a few fields (for example an in-game nickname), members fill it in
// after claiming a reward, and the owner delivers the benefit by hand and marks the entry as delivered.
//
// Only plain text is accepted. Answers are stored per member, shown to the server managers and to the member who wrote them,
// and can be deleted by either side. Nothing here touches XP, levels or reward claims.
export const FORM_LIMITS = {
  FIELDS: 10, TITLE: 80, INTRO: 400, SUCCESS: 200, LABEL: 60, PLACEHOLDER: 80, OPTIONS: 20, OPTION: 60,
  TEXT: 120, TEXTAREA: 800, NUMBER_MAX: 1_000_000_000, NOTE: 300, PAGE: 25,
};
export const FIELD_TYPES = ['text', 'textarea', 'number', 'select', 'checkbox'];
export const SUBMISSION_STATUSES = ['new', 'delivered', 'rejected'];
const FIELD_ID = /^[a-z][a-z0-9_]{0,23}$/;

/** Plain text: control characters and angle brackets removed, whitespace collapsed on one line unless `multiline`. */
export function plain(value, max, { multiline = false } = {}) {
  if (typeof value !== 'string') return '';
  let t = value.replace(/[\p{Cc}\p{Cf}]/gu, (c) => (multiline && (c === '\n') ? '\n' : ' ')).replace(/[<>]/g, '');
  t = multiline ? t.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n') : t.replace(/\s+/g, ' ');
  return [...t.trim()].slice(0, max).join('');
}

export const DEFAULT_FORM = {
  enabled: false, title: '', intro: '', success_text: '', fields: [
    { id: 'nickname', label: '', type: 'text', required: true, placeholder: '', max: 32, options: [] },
  ],
};

const fail = (errors, field, code, params) => errors.push({ field, code, ...(params ? { params } : {}) });

/** Validates the form the owner saves. Returns { errors, doc }. */
export function cleanForm(input) {
  const errors = [];
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { errors: [{ field: 'form', code: 'invalid' }], doc: null };
  const doc = {
    enabled: input.enabled === true,
    title: plain(input.title, FORM_LIMITS.TITLE), intro: plain(input.intro, FORM_LIMITS.INTRO, { multiline: true }),
    success_text: plain(input.success_text, FORM_LIMITS.SUCCESS), fields: [],
  };
  const raw = Array.isArray(input.fields) ? input.fields : null;
  if (!raw) fail(errors, 'fields', 'invalid');
  else if (raw.length > FORM_LIMITS.FIELDS) fail(errors, 'fields', 'too_many', { max: FORM_LIMITS.FIELDS });
  const seen = new Set();
  (raw || []).slice(0, FORM_LIMITS.FIELDS).forEach((f, i) => {
    const at = `fields.${i + 1}`;
    if (!f || typeof f !== 'object') { fail(errors, at, 'invalid'); return; }
    const id = String(f.id || '');
    if (!FIELD_ID.test(id)) fail(errors, `${at}.id`, 'invalid');
    if (seen.has(id)) fail(errors, `${at}.id`, 'duplicate');
    seen.add(id);
    const label = plain(f.label, FORM_LIMITS.LABEL);
    if (!label) fail(errors, `${at}.label`, 'required');
    const type = FIELD_TYPES.includes(f.type) ? f.type : null;
    if (!type) fail(errors, `${at}.type`, 'invalid_choice');
    const field = { id, label, type: type || 'text', required: f.required === true, placeholder: plain(f.placeholder, FORM_LIMITS.PLACEHOLDER), max: 0, options: [] };
    if (type === 'text' || type === 'textarea') {
      const cap = type === 'text' ? FORM_LIMITS.TEXT : FORM_LIMITS.TEXTAREA;
      const max = Number(f.max);
      field.max = Number.isInteger(max) && max >= 1 && max <= cap ? max : cap;
    }
    if (type === 'select') {
      const opts = Array.isArray(f.options) ? f.options.map((o) => plain(o, FORM_LIMITS.OPTION)).filter(Boolean) : [];
      const unique = [...new Set(opts)].slice(0, FORM_LIMITS.OPTIONS);
      if (unique.length < 2) fail(errors, `${at}.options`, 'required');
      field.options = unique;
    }
    doc.fields.push(field);
  });
  if (doc.enabled && !doc.fields.length) fail(errors, 'fields', 'required');
  return { errors, doc: errors.length ? null : doc };
}

/** Checks the answers a member sent against the form. Unknown fields are ignored. Returns { errors, answers }. */
export function cleanAnswers(form, input) {
  const errors = [];
  const answers = {};
  const given = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  for (const f of form.fields || []) {
    const raw = given[f.id];
    const at = `answers.${f.id}`;
    if (f.type === 'checkbox') {
      const v = raw === true;
      if (f.required && !v) fail(errors, at, 'required');
      answers[f.id] = v;
      continue;
    }
    if (f.type === 'number') {
      if (raw === undefined || raw === null || raw === '') { if (f.required) fail(errors, at, 'required'); answers[f.id] = null; continue; }
      const n = typeof raw === 'number' ? raw : Number(String(raw).trim());
      if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0 || n > FORM_LIMITS.NUMBER_MAX) { fail(errors, at, 'out_of_range', { min: 0, max: FORM_LIMITS.NUMBER_MAX }); continue; }
      answers[f.id] = n;
      continue;
    }
    if (f.type === 'select') {
      const v = typeof raw === 'string' ? raw : '';
      if (!v) { if (f.required) fail(errors, at, 'required'); answers[f.id] = ''; continue; }
      if (!f.options.includes(v)) { fail(errors, at, 'invalid_choice'); continue; }
      answers[f.id] = v;
      continue;
    }
    const v = plain(raw, f.max || FORM_LIMITS.TEXT, { multiline: f.type === 'textarea' });
    if (!v && f.required) fail(errors, at, 'required');
    if (typeof raw === 'string' && [...raw.trim()].length > (f.max || FORM_LIMITS.TEXT)) fail(errors, at, 'too_long', { max: f.max || FORM_LIMITS.TEXT });
    answers[f.id] = v;
  }
  return { errors, answers };
}

/** What a member may read about the form: the questions, never anything about other members. */
export function publicForm(doc) {
  if (!doc) return null;
  return { enabled: doc.enabled === true, title: doc.title || '', intro: doc.intro || '', success_text: doc.success_text || '', fields: doc.fields || [] };
}

export function submissionView(doc, { withUser = false } = {}) {
  return {
    id: String(doc._id), season_id: doc.season_id, reward_id: doc.reward_id || null, answers: doc.answers || {}, status: doc.status, note: doc.note || '',
    created_at: doc.created_at ? new Date(doc.created_at).toISOString() : null, updated_at: doc.updated_at ? new Date(doc.updated_at).toISOString() : null,
    handled_at: doc.handled_at ? new Date(doc.handled_at).toISOString() : null,
    ...(withUser ? { user_id: String(doc.user_id), handled_by: doc.handled_by ? String(doc.handled_by) : null } : {}),
  };
}
