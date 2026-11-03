'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Briefcase, IdCard, UserRound } from 'lucide-react';
import { Link } from '@/i18n/navigation';

const ICONS = { profile: UserRound, passport: IdCard, collab: Briefcase };

export function TrioShowcase({ tabs, slots, children }) {
  const [active, setActive] = useState(0);
  const [visible, setVisible] = useState(false);
  const [held, setHeld] = useState(false);
  const root = useRef(null);

  useEffect(() => {
    const el = root.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setVisible(true); return undefined; }
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const keys = tabs.map((x) => x.key);
    const read = () => {
      const h = window.location.hash.replace('#', '');
      const idx = keys.indexOf(h === 'collab-home' ? 'collab' : h);
      if (idx >= 0) setActive(idx);
    };
    read();
    window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
  }, []);

  const n = tabs.length;
  const paused = !visible || held;
  const current = tabs[active];

  function onKey(e) {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); setActive((active + 1) % n); }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); setActive((active + n - 1) % n); }
  }

  return (
    <div ref={root} className="trio-grid" data-active={tabs[active].key} onPointerEnter={() => setHeld(true)} onPointerLeave={() => setHeld(false)} onFocus={() => setHeld(true)} onBlur={() => setHeld(false)}>
      <div className="trio-copy">
        {children}
        <div role="tablist" aria-orientation="vertical" className="trio-tabs" onKeyDown={onKey}>
          {tabs.map((tab, i) => {
            const Icon = ICONS[tab.key];
            const on = i === active;
            return (
              <button
                key={tab.key}
                role="tab"
                id={`trio-tab-${tab.key}`}
                aria-selected={on}
                aria-controls={`trio-panel-${tab.key}`}
                tabIndex={on ? 0 : -1}
                type="button"
                className="trio-tab"
                data-on={on ? 'true' : 'false'}
                onClick={() => setActive(i)}
              >
                <span className="trio-tab-icon"><Icon className="h-4 w-4" aria-hidden="true" /></span>
                <span className="trio-tab-text">
                  <span className="trio-tab-name">{tab.name}</span>
                  <span className="trio-tab-blurb">{tab.blurb}</span>
                </span>
                {on ? (
                  <span className="trio-bar" aria-hidden="true">
                    <span className="trio-bar-fill" data-paused={paused ? 'true' : 'false'} onAnimationEnd={() => setActive((v) => (v + 1) % n)} />
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
        {current.external ? (
          <a href={current.href} target="_blank" rel="noopener noreferrer" className="trio-cta">{current.cta}<ArrowRight className="h-4 w-4" aria-hidden="true" /></a>
        ) : (
          <Link href={current.href} className="trio-cta">{current.cta}<ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
        )}
      </div>

      <div className="trio-stage" aria-live="off">
        <span className="trio-orbit trio-orbit-a" aria-hidden="true" />
        <span className="trio-orbit trio-orbit-b" aria-hidden="true" />
        {tabs.map((tab, i) => {
          const rel = (i - active + n) % n;
          const pos = rel === 0 ? 'front' : rel === 1 ? 'right' : 'left';
          return (
            <div
              key={tab.key}
              role="tabpanel"
              id={`trio-panel-${tab.key}`}
              aria-labelledby={`trio-tab-${tab.key}`}
              aria-hidden={rel !== 0}
              className="trio-card"
              data-pos={pos}
              onClick={rel !== 0 ? () => setActive(i) : undefined}
            >
              {slots[i]}
            </div>
          );
        })}
      </div>
    </div>
  );
}
