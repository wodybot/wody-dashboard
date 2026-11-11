'use client';
import { useState } from 'react';
import { Trophy, BarChart3 } from 'lucide-react';
import { Link } from '@/i18n/navigation';

const ICONS = { battlepass: Trophy, leaderboard: BarChart3 };
const BASE = 'inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors';

/** Quiet secondary links under the hero buttons. A feature the server has not set up stays visible but greyed, and explains itself when pressed. */
export default function ServerLinks({ items }) {
  const [open, setOpen] = useState(null);
  const current = items.find((i) => i.key === open);
  return (
    <div className="mt-3 w-full max-w-2xl">
      <div className="flex flex-wrap gap-2">
        {items.map((i) => {
          const Icon = ICONS[i.key] || Trophy;
          if (i.href) {
            return (
              <Link key={i.key} href={i.href} className={`${BASE} border-white/25 bg-white/5 text-white/90 hover:bg-white/10 hover:text-white`}>
                <Icon className="h-4 w-4" aria-hidden="true" />{i.label}
              </Link>
            );
          }
          return (
            <button key={i.key} type="button" aria-disabled="true" aria-expanded={open === i.key} onClick={() => setOpen(open === i.key ? null : i.key)}
              className={`${BASE} cursor-pointer border-white/10 bg-white/[0.03] text-white/40 hover:text-white/55`}>
              <Icon className="h-4 w-4" aria-hidden="true" />{i.label}
            </button>
          );
        })}
      </div>
      {current ? <p role="status" className="mt-2 text-sm text-white/65">{current.note}</p> : null}
    </div>
  );
}
