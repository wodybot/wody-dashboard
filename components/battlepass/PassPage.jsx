'use client';
// The public Battle Pass page. It is built like a member profile page: no site header, no footer, a full-screen backdrop and
// sections the owner can order, hide and restyle completely (lib/battlepass/page-theme.js). Rewards are claimed through
// /api/battlepass/claim, which asks the bot's engine; nothing on this page can change XP or levels.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowLeft, Volume2, VolumeX, Lock, Check, Gift, LogIn } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { themeModel, themeClasses } from '@/lib/battlepass/theme-style.js';
import { THEME_SECTIONS } from '@/lib/battlepass/page-theme.js';
import { playSound } from '@/lib/battlepass/sounds.js';
import { PASS_CSS } from './pass-css';
import Backdrop from './Backdrop';
import MemberForm from './MemberForm';
import { bp } from './bp-kit';
import { proxiedImageUrl } from '@/lib/utils';
import BadgeMark from './BadgeMark';
import WodyIcon from '@/components/wody-icon';

const cssUrl = (raw) => String(proxiedImageUrl(raw) || '').replace(/["')\\\s]/g, (c) => encodeURIComponent(c));

const RARITY_COLOR = { common: '#a1a1aa', uncommon: '#4ade80', rare: '#38bdf8', epic: '#a78bfa', legendary: '#fbbf24', mythic: '#fb7185', limited: '#f0abfc' };
// Reward type -> Wody custom emoji (lib/wody-icons.js). Unknown types use the reward emoji, never a Unicode symbol.
const TYPE_ICON = { badge: 'medal', achievement: 'trophy', decoration: 'sparkles', frame: 'photo', background: 'image', accent: 'colors', title: 'rank', collection_item: 'inventory', avatar_decoration: 'star', seasonal_item: 'calendar', collectible: 'gem', showcase_item: 'preview', custom: 'gift' };
const store = {
  get(k) { try { return window.localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { window.localStorage.setItem(k, v); } catch { /* storage can be blocked */ } },
};

function useTimeLeft(target, enabled) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled || !target) return undefined;
    const tick = () => setNow(Date.now());
    const id = setInterval(() => { if (!document.hidden) tick(); }, 1000);
    return () => clearInterval(id);
  }, [enabled, target]);
  if (!target) return null;
  const ms = new Date(target).getTime() - now;
  if (!Number.isFinite(ms) || ms <= 0) return { done: true, d: 0, h: 0, m: 0, s: 0 };
  const s = Math.floor(ms / 1000);
  return { done: false, d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}

function Progress({ style, state, t }) {
  const pct = state.need == null ? 100 : Math.max(0, Math.min(100, Math.round((state.into / (state.into + state.need)) * 100)));
  if (style === 'ring') return <div className="bp-ring" style={{ '--p': pct }} role="img" aria-label={`${pct}%`}><span>{pct}%</span></div>;
  if (style === 'orb') return <div className="bp-orb" style={{ '--p': pct }} role="img" aria-label={`${pct}%`}><span>{state.level}</span></div>;
  if (style === 'segments') {
    const total = 20; const on = Math.round((pct / 100) * total);
    return <div className="bp-segments" role="img" aria-label={`${pct}%`}>{Array.from({ length: total }, (_, i) => <i key={i} className={i < on ? 'on' : ''} />)}</div>;
  }
  return <div className="bp-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={t('progress.label')}><i style={{ width: `${pct}%` }} /></div>;
}

export default function PassPage({ season, initialState, viewer, guildName, backHref = '/', loginHref, leaderboard = [], theme: rawTheme, studio = null }) {
  const t = useTranslations('battlepass');
  const locale = useLocale();
  const model = useMemo(() => themeModel(rawTheme || season.page), [rawTheme, season.page]);
  const th = model.theme;
  const [state, setState] = useState(initialState);
  const [sound, setSound] = useState(false);
  const [fx, setFx] = useState([]);
  const [toast, setToast] = useState('');
  const [busy, setBusy] = useState('');
  const [inventory, setInventory] = useState(null);
  const ambient = useRef(null);
  const fxId = useRef(0);

  const loc = useCallback((item, key = 'name') => item?.i18n?.[locale]?.[key] || item?.[key] || '', [locale]);
  const say = useCallback((text) => { setToast(text); setTimeout(() => setToast(''), 3600); }, []);
  const ping = useCallback((event) => { if (sound && th.sound_pack !== 'none') playSound(th.sound_pack, event, th.volume); }, [sound, th.sound_pack, th.volume]);

  // Visual effects: short-lived elements in a fixed layer, removed after the animation.
  const effect = useCallback((kind) => {
    if (!kind || kind === 'none') return;
    const id = ++fxId.current;
    const parts = kind === 'confetti' || kind === 'burst' || kind === 'fireworks'
      ? Array.from({ length: kind === 'fireworks' ? 70 : 42 }, (_, i) => {
        const a = (i / 42) * Math.PI * 2 + Math.random();
        const d = 120 + Math.random() * (kind === 'fireworks' ? 320 : 220);
        return { dx: Math.cos(a) * d, dy: Math.sin(a) * d - 60, r: `${Math.round(Math.random() * 720 - 360)}deg`, c: kind === 'confetti' ? `hsl(${Math.round(Math.random() * 360)} 85% 62%)` : i % 2 ? 'var(--bp-accent)' : 'var(--bp-accent2)' };
      }) : [];
    setFx((list) => [...list, { id, kind, parts }]);
    setTimeout(() => setFx((list) => list.filter((f) => f.id !== id)), 1800);
  }, []);

  // Sound switch: remembered per browser, ambient audio starts only after the visitor turned sound on.
  useEffect(() => { if (th.sound_enabled && store.get('bp:sound') === '1') setSound(true); }, [th.sound_enabled]);
  useEffect(() => {
    const el = ambient.current;
    if (!el) return;
    el.volume = Math.min(1, (th.ambient_volume / 100));
    if (sound && th.ambient) {
      if (!el.getAttribute('src')) el.setAttribute('src', th.ambient);   // the external audio file is requested only after the visitor turned sound on
      el.play().catch(() => {});
    } else el.pause();
  }, [sound, th.ambient, th.ambient_volume]);
  const toggleSound = () => { const next = !sound; setSound(next); store.set('bp:sound', next ? '1' : '0'); if (next && th.sound_pack !== 'none') playSound(th.sound_pack, 'open', th.volume); };

  // A new level since the last visit is celebrated once.
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current || !viewer) return;
    opened.current = true;
    const key = `bp:lvl:${season.id}:${viewer.id}`;
    const seen = Number(store.get(key) || 0);
    if (seen && state.level > seen) { effect(th.level_up_fx); say(t('toast.levelUp', { level: state.level })); }
    store.set(key, String(state.level));
    if (th.confetti_on_open) effect('confetti');
  }, [viewer, season.id, state.level, th.level_up_fx, th.confetti_on_open, effect, say, t]);

  const loadInventory = useCallback(async () => {
    if (!viewer) return;
    const r = await bp('inventory');
    if (r.ok) setInventory(r.data);
  }, [viewer]);
  useEffect(() => { loadInventory(); }, [loadInventory]);

  const claim = async (reward) => {
    if (!viewer || busy) return;
    setBusy(reward.id);
    ping('click');
    const r = await bp('claim', { method: 'POST', body: { season_id: season.id, reward_id: reward.id } });
    setBusy('');
    if (r.ok && r.data.ok) {
      if (r.data.state) setState(r.data.state);
      effect(th.claim_fx); ping('claim'); say(reward.claim?.message || t('toast.claimed', { name: loc(reward) }));
      loadInventory();
    } else {
      ping('error');
      const code = r.data?.code || r.data?.error;
      say(t.has(`claimErrors.${code}`) ? t(`claimErrors.${code}`) : t('claimErrors.generic'));
    }
  };

  const timeTarget = state.status === 'scheduled' ? season.starts_at : season.ends_at;
  const left = useTimeLeft(timeTarget, th.show_timer);
  const rewards = useMemo(() => [...season.rewards].sort((a, b) => a.level - b.level), [season.rewards]);
  const nextReward = rewards.find((r) => state.rewards[r.id] === 'locked' && r.level > state.level);
  const completion = useMemo(() => new Set((season.collections || []).map((c) => c.completion_reward_id).filter(Boolean)), [season.collections]);
  const order = th.order.length ? th.order : THEME_SECTIONS;
  const hidden = new Set(th.hide);

  const reward = (r, index) => {
    const st = state.rewards[r.id] || 'locked';
    const hideName = th.hide_locked_names && st === 'locked';
    return (
      <div key={r.id} className={`bp-reward bp-enter bp-state-${st}`} style={{ '--rc': RARITY_COLOR[r.rarity] || RARITY_COLOR.common, '--i': index }} onMouseEnter={() => ping('hover')}>
        <div className="bp-art">{st === 'locked' && hideName ? <WodyIcon name="question" size={40} /> : <BadgeMark badge={r.badge} image={r.art || r.icon} fallbackIcon={TYPE_ICON[r.type] || 'rewards'} size={56} />}</div>
        <div className="bp-tag">{t(`rarity.${r.rarity}`)} · {t('levels.levelN', { level: r.level })}</div>
        <div className="bp-name">{hideName ? t('reward.hidden') : loc(r)}</div>
        {!hideName && r.description ? <div className="bp-desc">{loc(r, 'description')}</div> : null}
        <div className="mt-auto flex items-center justify-between gap-2">
          <span className="bp-muted inline-flex items-center gap-1 text-xs">
            {st === 'claimed' ? <Check className="h-3.5 w-3.5" style={{ color: 'var(--bp-good)' }} aria-hidden="true" /> : st === 'locked' ? <Lock className="h-3.5 w-3.5" aria-hidden="true" /> : <Gift className="h-3.5 w-3.5" aria-hidden="true" />}
            {t(`state.${st}`)}
          </span>
          {st === 'available' && !completion.has(r.id) ? (
            <button type="button" className="bp-btn" disabled={!viewer || busy === r.id} onClick={() => claim(r)}>{busy === r.id ? t('reward.claiming') : (r.claim?.label || t('reward.claim'))}</button>
          ) : null}
        </div>
      </div>
    );
  };

  const ts = useTranslations('bpStudio');
  const featuredRewards = useMemo(() => rewards.filter((r) => ['epic', 'legendary', 'mythic', 'limited'].includes(r.rarity)).slice(0, 6), [rewards]);
  const secTitle = (type, fallback) => (studio?.config.sections.find((x) => x.type === type)?.title || fallback);
  const questsBlock = (key, list, title) => (list.length ? (

      <section key={key} className="bp-card bp-enter" aria-labelledby={`bp-${key}`}>
        <div className="bp-section-title"><h2 id={`bp-${key}`}>{title}</h2></div>
        <div className="bp-list">
          {list.map((q) => {
            const s = state.quests.find((x) => x.id === q.id) || { value: 0, target: q.target, done: false };
            return (
              <div key={q.id} className="bp-row"><div className="bp-row-head"><span className="bp-name">{loc(q)}</span>{s.done ? <span className="bp-done">{t('progress.done')}</span> : <span className="bp-muted text-xs">{s.value}/{s.target}</span>}</div>
                {q.description ? <span className="bp-desc">{loc(q, 'description')}</span> : null}<div className="bp-mini"><i style={{ width: `${Math.min(100, (s.value / s.target) * 100)}%` }} /></div>
                <span className="bp-muted text-xs">{t(`metric.${q.metric}`)} · {t(`period.${q.period || 'season'}`)}{q.xp_reward ? ` · +${q.xp_reward} XP` : ''}</span></div>
            );
          })}
        </div>
      </section>
  ) : null);

  const sections = {
    hero: (
      <section key="hero" className={`bp-card bp-hero bp-enter`} aria-labelledby="bp-title">
        {th.banner ? <div className="bp-hero-banner" style={{ backgroundImage: `url("${cssUrl(th.banner)}")` }} aria-hidden="true" /> : null}
        {th.logo ? <img className="bp-logo" src={proxiedImageUrl(th.logo)} alt="" referrerPolicy="no-referrer" /> : null}
        {studio?.config.hero.eyebrow ? <p className="bp-muted text-xs uppercase tracking-[0.2em]">{studio.config.hero.eyebrow}</p> : null}
        <h1 id="bp-title" className={`bp-h1 bp-title-${th.title_fx}`}>{studio?.config.hero.title || loc(season)}</h1>
        {(studio?.config.hero.subtitle || th.subtitle || season.description) ? <p className="bp-sub">{studio?.config.hero.subtitle || th.subtitle || loc(season, 'description')}</p> : null}
        <div className="bp-meta">
          <span className="bp-chip"><b>{t(`scope.${season.scope}`)}</b>{season.scope === 'guild' && guildName ? ` · ${guildName}` : ''}</span>
          <span className={`bp-chip bp-status bp-status-${state.status}`}><i className="bp-dot" aria-hidden="true" /><b>{t.has(`statusPublic.${state.status}`) ? t(`statusPublic.${state.status}`) : t(`status.${state.status}`)}</b></span>
          {th.show_timer && left && !left.done && (state.status === 'active' || state.status === 'scheduled') ? <span className="bp-chip" aria-live="off">{ts(state.status === 'scheduled' ? 'countdown.startsIn' : 'countdown.endsIn')} <b>{t('time.left', { d: left.d, h: left.h, m: left.m, s: left.s })}</b></span> : null}
          {season.earn?.multiplier && season.earn.multiplier !== 1 ? <span className="bp-chip">XP <b>x{season.earn.multiplier}</b></span> : null}
        </div>
        {th.hero_cta ? <p className="bp-muted text-sm">{th.hero_cta}</p> : null}
        {studio?.config.hero.cta_label && studio.config.hero.cta_url ? <a className="bp-btn mt-3 inline-flex" href={studio.config.hero.cta_url} target="_blank" rel="noopener noreferrer">{studio.config.hero.cta_label}</a> : null}
      </section>
    ),
    progress: (
      <section key="progress" className={`bp-card bp-progress bp-enter ${th.sticky_progress ? 'bp-sticky' : ''}`} aria-label={t('progress.title')}>
        {viewer ? (
          <>
            <div className="bp-progress-head">
              <span className="bp-level">{t('progress.level', { level: state.level })}</span>
              <span className="bp-muted text-sm">{state.xp.toLocaleString(locale)} XP{th.show_percent && state.need != null ? ` · ${t('progress.toNext', { xp: state.need.toLocaleString(locale) })}` : ''}</span>
            </div>
            <div className="flex items-center justify-center gap-4"><div className="w-full"><Progress style={th.progress_style} state={state} t={t} /></div></div>
            {th.show_next && nextReward ? <p className="bp-muted text-sm">{t('progress.next', { name: th.hide_locked_names ? t('reward.hidden') : loc(nextReward), level: nextReward.level })}</p> : null}
          </>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="bp-muted">{t('progress.signIn')}</p>
            <a className="bp-btn inline-flex items-center gap-2" href={loginHref}><LogIn className="h-4 w-4" aria-hidden="true" />{t('progress.signInButton')}</a>
          </div>
        )}
      </section>
    ),
    track: (
      <section key="track" className="bp-card bp-enter" aria-labelledby="bp-track">
        <div className="bp-section-title"><h2 id="bp-track">{t('sections.track')}</h2><span className="bp-muted text-sm">{t('progress.rewardsCount', { claimed: state.claimed.length, total: rewards.length })}</span></div>
        <div className={th.layout === 'grid' ? 'bp-grid' : th.layout === 'cards' ? 'bp-cards' : th.layout === 'timeline' ? 'bp-timeline' : 'bp-track'}>
          {rewards.map((r, i) => reward(r, i))}
        </div>
      </section>
    ),
    quests: questsBlock('quests', season.quests, t('sections.quests')),
    achievements: season.achievements.length ? (
      <section key="achievements" className="bp-card bp-enter" aria-labelledby="bp-ach">
        <div className="bp-section-title"><h2 id="bp-ach">{t('sections.achievements')}</h2></div>
        <div className="bp-cards">
          {season.achievements.map((a) => {
            const s = state.achievements.find((x) => x.id === a.id) || { done: false, progress: [] };
            return (
              <div key={a.id} className={`bp-row ${s.done ? '' : 'bp-state-locked'}`}><div className="bp-row-head"><span className="bp-name">{loc(a)}</span>{s.done ? <span className="bp-done">{t('progress.done')}</span> : <Lock className="h-4 w-4 bp-muted" aria-hidden="true" />}</div>
                {a.description ? <span className="bp-desc">{loc(a, 'description')}</span> : null}
                {s.progress.map((p, i) => <div key={i}><div className="bp-mini"><i style={{ width: `${Math.min(100, (p.value / p.target) * 100)}%` }} /></div><span className="bp-muted text-xs">{t(`metric.${p.metric}`)} {p.value}/{p.target}</span></div>)}</div>
            );
          })}
        </div>
      </section>
    ) : null,
    collections: season.collections.length ? (
      <section key="collections" className="bp-card bp-enter" aria-labelledby="bp-col">
        <div className="bp-section-title"><h2 id="bp-col">{t('sections.collections')}</h2></div>
        <div className="bp-cards">
          {season.collections.map((c) => {
            const s = state.collections.find((x) => x.id === c.id) || { have: 0, total: c.reward_ids.length };
            return (
              <div key={c.id} className="bp-row"><div className="bp-row-head"><span className="bp-name">{loc(c)}</span><span className="bp-muted text-xs">{s.have}/{s.total}</span></div>
                {c.description ? <span className="bp-desc">{loc(c, 'description')}</span> : null}<div className="bp-mini"><i style={{ width: `${s.total ? (s.have / s.total) * 100 : 0}%` }} /></div></div>
            );
          })}
        </div>
      </section>
    ) : null,
    showcase: viewer && inventory ? (
      <section key="showcase" className="bp-card bp-enter" aria-labelledby="bp-show">
        <div className="bp-section-title"><h2 id="bp-show">{t('sections.showcase')}</h2></div>
        {inventory.items.length === 0 ? <p className="bp-muted">{t('showcase.empty')}</p> : (
          <>
            <p className="bp-muted mb-3 text-sm">{t('showcase.intro')}</p>
            <div className="bp-grid">
              {inventory.items.map((it) => {
                const on = inventory.profile.showcase.includes(it.item_id);
                return (
                  <button key={it.item_id} type="button" aria-pressed={on} className={`bp-reward ${on ? 'bp-state-claimed' : ''}`} style={{ '--rc': RARITY_COLOR[it.rarity] || RARITY_COLOR.common }}
                    onClick={async () => {
                      const next = on ? inventory.profile.showcase.filter((x) => x !== it.item_id) : [...inventory.profile.showcase, it.item_id].slice(0, 6);
                      const r = await bp('profile', { method: 'PATCH', body: { showcase: next } });
                      if (r.ok) { setInventory({ ...inventory, profile: { ...inventory.profile, showcase: next } }); ping('click'); } else say(t('showcase.error'));
                    }}>
                    <div className="bp-art">{it.art || it.icon ? <img src={proxiedImageUrl(it.art || it.icon)} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <WodyIcon name={TYPE_ICON[it.type] || 'rewards'} size={40} />}</div>
                    <span className="bp-tag">{t(`rarity.${it.rarity}`)}</span>
                    <span className="bp-name">{it.i18n?.[locale]?.name || it.name}</span>
                    <span className="bp-muted text-xs">{on ? t('showcase.shown') : t('showcase.hidden')}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </section>
    ) : null,
    leaderboard: th.show_rank && leaderboard.length ? (
      <section key="leaderboard" className="bp-card bp-enter" aria-labelledby="bp-lb">
        <div className="bp-section-title"><h2 id="bp-lb">{t('sections.leaderboard')}</h2></div>
        <ol className="bp-list">
          {leaderboard.map((row, i) => (
            <li key={row.user_id} className="bp-row"><div className="bp-row-head"><span className="bp-name">#{i + 1} {row.name}</span><span className="bp-muted text-sm">{row.xp.toLocaleString(locale)} XP · {t('progress.level', { level: row.level })}</span></div></li>
          ))}
        </ol>
      </section>
    ) : null,

    // ---- Page Studio sections: only drawn on a studio page, and only when the season really has the data for them.
    overview: studio && (studio.config.overview.text || studio.config.overview.highlights.length) ? (
      <section key="overview" className="bp-card bp-enter" aria-labelledby="bp-overview">
        <div className="bp-section-title"><h2 id="bp-overview">{secTitle('overview', ts('sections.overview'))}</h2></div>
        {studio.config.overview.text ? <p className="bp-desc">{studio.config.overview.text}</p> : null}
        {studio.config.overview.highlights.length ? (
          <ul className="bp-cards mt-3">{studio.config.overview.highlights.map((h, i) => (
            <li key={i} className="bp-row flex items-center gap-3">{h.icon ? <WodyIcon name={h.icon} size={28} /> : null}<span className="bp-name">{h.text}</span></li>))}</ul>
        ) : null}
      </section>
    ) : null,
    countdown: studio && timeTarget && left ? (
      <section key="countdown" className="bp-card bp-enter text-center" aria-labelledby="bp-countdown">
        <div className="bp-section-title"><h2 id="bp-countdown">{secTitle('countdown', ts(state.status === 'scheduled' ? 'countdown.startsIn' : 'countdown.endsIn'))}</h2></div>
        {left.done ? <p className="bp-muted">{ts('countdown.over')}</p> : (
          <div className="flex flex-wrap items-stretch justify-center gap-3" role="timer" aria-live="off">
            {[['d', left.d], ['h', left.h], ['m', left.m], ['s', left.s]].map(([u, n]) => (
              <div key={u} className="bp-row min-w-[4.5rem] text-center"><span className="bp-level block text-2xl tabular-nums">{String(n).padStart(2, '0')}</span><span className="bp-muted text-xs">{ts(`countdown.${u}`)}</span></div>))}
          </div>
        )}
      </section>
    ) : null,
    featured: studio && featuredRewards.length ? (
      <section key="featured" className="bp-card bp-enter" aria-labelledby="bp-featured">
        <div className="bp-section-title"><h2 id="bp-featured">{secTitle('featured', ts('sections.featured'))}</h2></div>
        <div className="bp-grid">{featuredRewards.map((r, i) => reward(r, i))}</div>
      </section>
    ) : null,
    quests_daily: studio ? questsBlock('quests_daily', season.quests.filter((q) => q.period === 'day'), secTitle('quests_daily', ts('sections.questsDaily'))) : null,
    quests_weekly: studio ? questsBlock('quests_weekly', season.quests.filter((q) => q.period === 'week'), secTitle('quests_weekly', ts('sections.questsWeekly'))) : null,
    player: studio && viewer ? (
      <section key="player" className="bp-card bp-enter" aria-labelledby="bp-player">
        <div className="bp-section-title"><h2 id="bp-player">{secTitle('player', ts('sections.player'))}</h2></div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="bp-row min-w-[7rem] text-center"><span className="bp-level block text-2xl">{state.level}</span><span className="bp-muted text-xs">{ts('player.level')}</span></div>
          <div className="bp-row min-w-[7rem] text-center"><span className="bp-level block text-2xl tabular-nums">{state.xp.toLocaleString(locale)}</span><span className="bp-muted text-xs">XP</span></div>
          <div className="bp-row min-w-[7rem] text-center"><span className="bp-level block text-2xl tabular-nums">{state.claimed.length}/{rewards.length}</span><span className="bp-muted text-xs">{ts('player.claimed')}</span></div>
        </div>
        <p className="bp-muted mt-3 text-xs">{ts('player.private')}</p>
      </section>
    ) : null,
    statistics: studio && studio.stats ? (
      <section key="statistics" className="bp-card bp-enter" aria-labelledby="bp-stats">
        <div className="bp-section-title"><h2 id="bp-stats">{secTitle('statistics', ts('sections.statistics'))}</h2></div>
        <div className="bp-cards">
          {[['participants', 'users'], ['rewards_claimed', 'rewards'], ['achievements', 'trophy'], ['levels', 'level'], ['rewards', 'gift'], ['quests', 'quests']].filter(([k]) => Number(studio.stats[k]) > 0).map(([k, icon]) => (
            <div key={k} className="bp-row flex items-center gap-3"><WodyIcon name={icon} size={28} /><div><span className="bp-level block text-xl tabular-nums">{Number(studio.stats[k]).toLocaleString(locale)}</span><span className="bp-muted text-xs">{ts(`stats.${k}`)}</span></div></div>))}
        </div>
      </section>
    ) : null,
    faq: studio && studio.config.faq.length ? (
      <section key="faq" className="bp-card bp-enter" aria-labelledby="bp-faq">
        <div className="bp-section-title"><h2 id="bp-faq">{secTitle('faq', ts('sections.faq'))}</h2></div>
        <div className="bp-list">{studio.config.faq.map((f, i) => (
          <details key={i} className="bp-row"><summary className="bp-name cursor-pointer">{f.q}</summary><p className="bp-desc mt-2">{f.a}</p></details>))}</div>
      </section>
    ) : null,
    footer: studio ? (
      <footer key="footer" className="bp-card bp-enter text-center">
        {studio.config.footer.text ? <p className="bp-desc">{studio.config.footer.text}</p> : null}
        <div className="mt-2 flex flex-wrap justify-center gap-3 text-sm">
          {studio.config.footer.links.map((l) => <a key={l.url} className="underline" href={l.url} target="_blank" rel="noopener noreferrer">{l.label}</a>)}
          <Link href="/policies/battle-pass" className="underline">{t('rules.policy')}</Link>
        </div>
      </footer>
    ) : null,
    rules: (
      <section key="rules" className="bp-card bp-enter" aria-labelledby="bp-rules">
        <div className="bp-section-title"><h2 id="bp-rules">{t('sections.rules')}</h2></div>
        <ul className="bp-list">
          {season.earn?.message ? <li className="bp-row"><span className="bp-name">{t('rules.message')}</span><span className="bp-desc">{t('rules.messageText', { xp: season.earn.message.xp, seconds: season.earn.message.cooldown_seconds, day: season.earn.message.max_per_day })}</span></li> : null}
          {season.earn?.voice ? <li className="bp-row"><span className="bp-name">{t('rules.voice')}</span><span className="bp-desc">{t('rules.voiceText', { xp: season.earn.voice.xp_per_interval, minutes: Math.round(season.earn.voice.interval_seconds / 60), day: season.earn.voice.max_per_day })}</span></li> : null}
          <li className="bp-row"><span className="bp-name">{t('rules.privacy')}</span><span className="bp-desc">{t('rules.privacyText')}</span></li>
          {th.rules_note ? <li className="bp-row"><span className="bp-desc">{th.rules_note}</span></li> : null}
        </ul>
        <p className="bp-muted mt-3 text-xs"><Link href="/policies/battle-pass" className="underline">{t('rules.policy')}</Link></p>
      </section>
    ),
  };

  // Page Studio: the section list, titles and custom blocks come from the page configuration (components/battlepass/studio).
  const blockNode = (b) => {
    if (b.type === 'divider') return <hr key={b.id} className="border-white/10" />;
    if (b.type === 'button') return <div key={b.id} className="bp-card bp-enter text-center"><a className="bp-btn inline-flex" href={b.url} target="_blank" rel="noopener noreferrer">{b.label}</a></div>;
    if (b.type === 'image') return <figure key={b.id} className="bp-card bp-enter overflow-hidden p-0">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={proxiedImageUrl(b.url)} alt={b.alt || ''} loading="lazy" referrerPolicy="no-referrer" className="w-full" /></figure>;
    return <section key={b.id} className="bp-card bp-enter">{b.title ? <div className="bp-section-title"><h2>{b.title}</h2></div> : null}<p className="bp-desc whitespace-pre-line">{b.text}</p></section>;
  };
  const STUDIO_KEY = { challenges: 'achievements' };
  const studioList = studio ? studio.config.sections.filter((x) => x.on || x.type === 'hero').map((x) => (['text', 'image', 'button', 'divider'].includes(x.type) ? blockNode(x) : (sections[STUDIO_KEY[x.type] || x.type] ?? null))) : null;

  return (
    <div className={`bp-root ${themeClasses(th)}`} style={{ ...model.vars, '--bp-bg': 'none' }}>
      <style>{PASS_CSS}</style>
      <Backdrop model={model} />
      <div className="bp-wrap">
        <div className="bp-topbar">
          <Link href={backHref} className="bp-pill"><ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />{t('page.back')}</Link>
          {th.sound_pack !== 'none' || th.ambient ? (
            <button type="button" className="bp-pill" aria-pressed={sound} onClick={toggleSound}>
              {sound ? <Volume2 className="h-3.5 w-3.5" aria-hidden="true" /> : <VolumeX className="h-3.5 w-3.5" aria-hidden="true" />}{sound ? t('page.soundOn') : t('page.soundOff')}
            </button>
          ) : null}
          {th.ambient && !sound ? <span className="bp-muted text-xs">{t('page.ambientNote')}</span> : null}
        </div>
        <main id="main-content" className="contents">
          {studioList || order.filter((id) => !hidden.has(id) || id === 'hero').map((id) => sections[id] || null)}
          {season.scope === 'guild' && season.guild_id ? <MemberForm guildId={String(season.guild_id)} viewer={viewer} ping={ping} say={say} /> : null}
        </main>
      </div>
      {th.ambient ? <audio ref={ambient} loop preload="none" /> : null}
      <div className="bp-fx-layer" aria-hidden="true">
        {fx.map((f) => (
          <div key={f.id}>
            {f.kind === 'pulse' || f.kind === 'flash' ? <div className="bp-flash" /> : null}
            {f.kind === 'shockwave' ? <div className="bp-shock" /> : null}
            {f.parts.map((p, i) => <span key={i} className="bp-burst" style={{ left: '50%', top: '55%', '--dx': `${p.dx}px`, '--dy': `${p.dy}px`, '--r': p.r, background: p.c }} />)}
          </div>
        ))}
      </div>
      <div className="bp-toast" role="status" aria-live="polite" hidden={!toast}>{toast}</div>
    </div>
  );
}
