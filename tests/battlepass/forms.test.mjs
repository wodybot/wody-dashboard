// Unit tests for the delivery form rules (lib/battlepass/forms.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanForm, cleanAnswers, plain, publicForm, FORM_LIMITS } from '../../lib/battlepass/forms.js';

const field = (o = {}) => ({ id: 'nick', label: 'Nickname', type: 'text', required: true, ...o });

test('plain text removes control characters and angle brackets and limits length', () => {
  assert.equal(plain('  a\u0000b <script>x</script>  ', 50), 'a b scriptx/script');
  assert.equal(plain('x'.repeat(500), 10).length, 10);
  assert.equal(plain(42, 10), '');
  assert.equal(plain('a\n\n\n\nb', 20, { multiline: true }), 'a\n\nb');
});

test('a valid form is cleaned and unknown field types are refused', () => {
  const ok = cleanForm({ enabled: true, title: 'T', fields: [field(), field({ id: 'pick', label: 'Pick', type: 'select', options: ['a', 'b', 'a'] })] });
  assert.deepEqual(ok.errors, []);
  assert.deepEqual(ok.doc.fields[1].options, ['a', 'b']);
  const bad = cleanForm({ enabled: false, fields: [field({ type: 'script' })] });
  assert.equal(bad.doc, null);
  assert.ok(bad.errors.some((e) => e.field === 'fields.1.type'));
});

test('field ids must be unique and well formed, and an enabled form needs fields', () => {
  const dup = cleanForm({ fields: [field(), field()] });
  assert.ok(dup.errors.some((e) => e.code === 'duplicate'));
  const badId = cleanForm({ fields: [field({ id: 'Bad Id' })] });
  assert.ok(badId.errors.some((e) => e.field === 'fields.1.id'));
  assert.ok(cleanForm({ enabled: true, fields: [] }).errors.some((e) => e.field === 'fields' && e.code === 'required'));
  assert.ok(cleanForm({ fields: Array.from({ length: FORM_LIMITS.FIELDS + 1 }, (_, i) => field({ id: `f${i}` })) }).errors.some((e) => e.code === 'too_many'));
});

test('a select field needs at least two distinct choices', () => {
  const r = cleanForm({ fields: [field({ type: 'select', options: ['only'] })] });
  assert.ok(r.errors.some((e) => e.field === 'fields.1.options'));
});

test('answers: required, type checks and limits', () => {
  const form = cleanForm({ fields: [
    field(), field({ id: 'lvl', label: 'Level', type: 'number', required: false }),
    field({ id: 'srv', label: 'Server', type: 'select', required: false, options: ['eu', 'us'] }),
    field({ id: 'ok', label: 'Agree', type: 'checkbox', required: true }),
  ] }).doc;
  const good = cleanAnswers(form, { nick: ' Wody ', lvl: '12', srv: 'eu', ok: true, extra: 'ignored' });
  assert.deepEqual(good.errors, []);
  assert.deepEqual(good.answers, { nick: 'Wody', lvl: 12, srv: 'eu', ok: true });
  const missing = cleanAnswers(form, {});
  assert.deepEqual(missing.errors.map((e) => e.field).sort(), ['answers.nick', 'answers.ok']);
  assert.ok(cleanAnswers(form, { nick: 'a', ok: true, lvl: '-3' }).errors.some((e) => e.code === 'out_of_range'));
  assert.ok(cleanAnswers(form, { nick: 'a', ok: true, lvl: '1.5' }).errors.some((e) => e.code === 'out_of_range'));
  assert.ok(cleanAnswers(form, { nick: 'a', ok: true, srv: 'asia' }).errors.some((e) => e.code === 'invalid_choice'));
  assert.ok(cleanAnswers(form, { nick: 'x'.repeat(500), ok: true }).errors.some((e) => e.code === 'too_long'));
  assert.ok(cleanAnswers(form, { nick: 'a', ok: 'true' }).errors.some((e) => e.field === 'answers.ok'));
});

test('the public form never exposes more than the questions', () => {
  const v = publicForm({ _id: '1', guild_id: 5, updated_by: 9, enabled: true, title: 'T', intro: '', success_text: '', fields: [] });
  assert.deepEqual(Object.keys(v).sort(), ['enabled', 'fields', 'intro', 'success_text', 'title']);
});
