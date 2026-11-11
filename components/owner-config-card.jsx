'use client';

import { useState } from 'react';
import { Loader2, ShieldCheck, RefreshCw, CheckCircle2, XCircle, AlertTriangle, MinusCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const STATE = {
  ok: ['OK', 'bg-emerald-500/15 text-emerald-400'],
  missing: ['Missing', 'bg-red-500/15 text-red-400'],
  invalid: ['Invalid', 'bg-red-500/15 text-red-400'],
  placeholder: ['Placeholder', 'bg-amber-500/15 text-amber-400'],
  unset: ['Not set', 'bg-secondary text-muted-foreground'],
};
const LIVE = {
  ok: [CheckCircle2, 'text-emerald-400'],
  fail: [XCircle, 'text-red-400'],
  warn: [AlertTriangle, 'text-amber-400'],
  skipped: [MinusCircle, 'text-muted-foreground'],
};

function Row({ item }) {
  const [label, cls] = STATE[item.state] || STATE.unset;
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-border/50 bg-secondary/20 px-3 py-2">
      <div className="min-w-0">
        <div className="truncate font-mono text-xs">{item.name}{item.required && <span className="ml-1 text-red-400" title="Required">*</span>}</div>
        <div className="text-[11px] leading-snug text-muted-foreground">{item.info}</div>
      </div>
      <span className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${cls}`}>{label}</span>
    </div>
  );
}

function Group({ name, items }) {
  return (
    <div>
      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{name}</div>
      <div className="grid gap-2 md:grid-cols-2">{items.map((i) => <Row key={i.name} item={i} />)}</div>
    </div>
  );
}

function LiveRow({ c }) {
  const [Icon, cls] = LIVE[c.state] || LIVE.skipped;
  return (
    <div className="flex items-start gap-2 rounded-lg border border-border/50 bg-secondary/20 px-3 py-2">
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${cls}`} />
      <div className="min-w-0">
        <div className="text-xs font-medium">{c.label}</div>
        <div className="text-[11px] leading-snug text-muted-foreground">{c.detail}</div>
      </div>
    </div>
  );
}

export default function OwnerConfigCard({ status, onReload }) {
  const [live, setLive] = useState(null);
  const [running, setRunning] = useState(false);

  const runLive = async () => {
    setRunning(true);
    try {
      const r = await fetch('/api/owner/config-live', { cache: 'no-store' });
      setLive(r.ok ? await r.json() : { checks: [{ id: 'x', label: 'Live checks', state: 'fail', detail: 'The request failed.' }] });
    } catch {
      setLive({ checks: [{ id: 'x', label: 'Live checks', state: 'fail', detail: 'The request failed.' }] });
    } finally { setRunning(false); }
  };

  const checks = [...(status?.bot?.compare || []).map((c) => ({ ...c })), ...(live?.checks || [])];
  const failing = checks.filter((c) => c.state === 'fail').length;

  return (
    <Card className="p-4 sm:p-5 bg-card/60 border-border/50">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-4 w-4 text-[#e08a4e]" /> Configuration</div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="h-9 min-w-[10.5rem] justify-center" onClick={onReload}><RefreshCw className="mr-1.5 h-3.5 w-3.5" />Recheck</Button>
          <Button size="sm" className="h-9 min-w-[10.5rem] justify-center" onClick={runLive} disabled={running}>{running ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />}Test connections</Button>
        </div>
      </div>
      <p className="mb-3 mt-1 text-xs text-muted-foreground">
        Presence and format of every setting on the dashboard and on the bot. <b>Test connections</b> calls Discord, the database and each service with the configured keys. Values are never shown. * = required.
      </p>
      {!status ? <Loader2 className="h-4 w-4 animate-spin" /> : (
        <div className="space-y-5">
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 font-semibold text-emerald-400">{status.summary.ok} OK</span>
            <span className={`rounded-full px-2.5 py-1 font-semibold ${status.summary.problems ? 'bg-red-500/15 text-red-400' : 'bg-secondary text-muted-foreground'}`}>{status.summary.problems} to fix</span>
            {failing > 0 && <span className="rounded-full bg-red-500/15 px-2.5 py-1 font-semibold text-red-400">{failing} failed checks</span>}
          </div>

          {checks.length > 0 && (
            <div>
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Checks{live?.ran_at ? '' : ' (press Test connections for the live ones)'}</div>
              <div className="grid gap-2 md:grid-cols-2">{checks.map((c) => <LiveRow key={c.id} c={c} />)}</div>
            </div>
          )}

          <div className="space-y-4">
            <div className="text-sm font-semibold">Dashboard (Vercel)</div>
            {status.groups.map((g) => <Group key={g.name} name={g.name} items={g.items} />)}
          </div>

          <div className="space-y-4">
            <div className="text-sm font-semibold">Bot (Bot-Hosting){status.bot?.updated_at ? <span className="ml-2 text-[11px] font-normal text-muted-foreground">reported {new Date(status.bot.updated_at).toLocaleString()}</span> : null}</div>
            {!status.bot ? (
              <p className="text-xs text-muted-foreground">The bot has not reported its configuration yet. It does so a few seconds after starting, so restart the bot with the latest version and press Recheck.</p>
            ) : Object.entries(status.bot.items.reduce((m, i) => { (m[i.group] ||= []).push(i); return m; }, {})).map(([name, items]) => <Group key={name} name={name} items={items} />)}
          </div>
        </div>
      )}
    </Card>
  );
}
