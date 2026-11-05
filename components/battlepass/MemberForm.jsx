'use client';
// Delivery form on the public Battle Pass page of a Premium server. Shown only to a signed-in member while the server's own
// season is running and the owner has enabled the form. Answers go to the server managers; the member can delete them.
import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { bp, useBpText, pathErrors } from './bp-kit';

const INPUT = { width: '100%', borderRadius: 10, border: '1px solid color-mix(in srgb,var(--bp-border) 30%,transparent)', background: 'rgba(0,0,0,.35)', color: 'var(--bp-text)', padding: '9px 12px', font: 'inherit', fontSize: '.9rem' };

export default function MemberForm({ guildId, viewer, ping, say }) {
  const t = useTranslations('battlepass.forms');
  const locale = useLocale();
  const text = useBpText();
  const [info, setInfo] = useState(null);
  const [reward, setReward] = useState('');
  const [answers, setAnswers] = useState({});
  const [errors, setErrors] = useState([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!viewer || !guildId) return;
    const r = await bp(`form?guild=${guildId}`);
    if (r.ok) setInfo(r.data);
  }, [viewer, guildId]);
  useEffect(() => { load(); }, [load]);

  const rewardKey = reward || null;
  const existing = info?.mine?.find((m) => (m.reward_id || null) === rewardKey);
  useEffect(() => { setAnswers(existing?.answers || {}); setErrors([]); }, [existing?.id, rewardKey]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!viewer || !info?.available) return null;
  const { form } = info;
  const locked = existing?.status === 'delivered';
  const set = (id, v) => setAnswers((a) => ({ ...a, [id]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErrors([]);
    const r = await bp('form', { method: 'POST', body: { guild: guildId, reward_id: rewardKey, answers } });
    setBusy(false);
    if (r.ok) { ping?.('claim'); say(form.success_text || t('member.sent')); load(); return; }
    ping?.('error');
    if (r.data?.errors) setErrors(r.data.errors); else say(text.api(r.data?.error));
  };
  const remove = async () => {
    const r = await bp(`form/${existing.id}`, { method: 'DELETE' });
    if (r.ok) { say(t('member.removed')); setAnswers({}); load(); } else say(text.api(r.data?.error));
  };

  return (
    <section className="bp-card bp-enter" aria-labelledby="bp-form">
      <div className="bp-section-title"><h2 id="bp-form">{form.title || t('member.title')}</h2></div>
      {form.intro ? <p className="bp-desc mb-3 whitespace-pre-wrap">{form.intro}</p> : null}
      <p className="bp-muted mb-3 text-xs">{t('member.privacy')}</p>
      <form onSubmit={submit} className="bp-list" noValidate>
        {info.rewards.length ? (
          <label className="bp-row">
            <span className="bp-name">{t('member.reward')}</span>
            <select style={INPUT} value={reward} onChange={(e) => setReward(e.target.value)}>
              <option value="">{t('member.general')}</option>
              {info.rewards.map((r) => <option key={r.id} value={r.id}>{r.i18n?.[locale]?.name || r.name}</option>)}
            </select>
          </label>
        ) : null}
        {form.fields.map((f) => {
          const bad = pathErrors(errors, `answers.${f.id}`);
          const common = { id: `bpf-${f.id}`, disabled: locked, 'aria-invalid': bad.length > 0, 'aria-describedby': bad.length ? `bpf-${f.id}-err` : undefined };
          return (
            <div key={f.id} className="bp-row">
              {f.type === 'checkbox' ? (
                <label className="flex items-center gap-2">
                  <input type="checkbox" {...common} checked={answers[f.id] === true} onChange={(e) => set(f.id, e.target.checked)} />
                  <span className="bp-name">{f.label}{f.required ? ' *' : ''}</span>
                </label>
              ) : (
                <>
                  <label htmlFor={common.id} className="bp-name">{f.label}{f.required ? ' *' : ''}</label>
                  {f.type === 'textarea' ? <textarea {...common} style={INPUT} rows={4} maxLength={f.max || 800} placeholder={f.placeholder} value={answers[f.id] ?? ''} onChange={(e) => set(f.id, e.target.value)} />
                    : f.type === 'select' ? (
                      <select {...common} style={INPUT} value={answers[f.id] ?? ''} onChange={(e) => set(f.id, e.target.value)}>
                        <option value="">{f.placeholder || t('member.choose')}</option>
                        {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : <input {...common} style={INPUT} type={f.type === 'number' ? 'number' : 'text'} inputMode={f.type === 'number' ? 'numeric' : undefined} min={f.type === 'number' ? 0 : undefined}
                      maxLength={f.type === 'text' ? f.max || 120 : undefined} placeholder={f.placeholder} value={answers[f.id] ?? ''} onChange={(e) => set(f.id, e.target.value)} />}
                </>
              )}
              {bad.length ? <div id={`bpf-${f.id}-err`} role="alert" className="text-xs" style={{ color: 'var(--bp-bad, #f87171)' }}>{bad.map((e, i) => <p key={i}>{text.field(e)}</p>)}</div> : null}
            </div>
          );
        })}
        {existing ? <p className="bp-muted text-xs">{t('member.mine')}: {t(`status.${existing.status}`)}{locked ? ` · ${t('member.locked')}` : ''}</p> : null}
        <div className="flex flex-wrap gap-2">
          <button type="submit" className="bp-btn" disabled={busy || locked}>{existing ? t('member.update') : t('member.submit')}</button>
          {existing && !locked ? <button type="button" className="bp-pill" onClick={remove}>{t('member.remove')}</button> : null}
        </div>
      </form>
    </section>
  );
}
