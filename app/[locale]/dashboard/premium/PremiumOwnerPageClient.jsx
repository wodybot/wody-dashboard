'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { discordCdnUrl } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TopNav, Footer } from '@/components/nav';
import { OWNER_ID } from '@/lib/content';
import {
  Crown, Sparkles, Key, Copy, Plus, Loader2, RefreshCw, ArrowLeft,
  Server, Users, ShieldCheck, ShieldAlert, Megaphone, Trash2, Ban, Undo2, MessageSquare,
  LayoutGrid, ChevronRight,
} from 'lucide-react';

const UPDATE_TAGS = ['Feature', 'Fix', 'Announcement', 'Update'];

// Section config for the panel's nav (sidebar on desktop, horizontal tab
// strip on mobile). Kept as plain data so the nav and the content switch
// stay in sync from one source instead of two separate hardcoded lists.
const SECTIONS = [
  { id: 'overview', label: 'Overview', icon: LayoutGrid },
  { id: 'keys', label: 'License Keys', icon: Key },
  { id: 'premium-servers', label: 'Premium Servers', icon: Crown },
  { id: 'all-servers', label: 'All Servers', icon: Server },
  { id: 'enforcement', label: 'Server Enforcement', icon: ShieldAlert },
  { id: 'updates', label: 'Announcements', icon: Megaphone },
];

async function safeJson(url, options) {
  try {
    const res = await fetch(url, options);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function StatusBadge({ status }) {
  const map = {
    active: { label: 'Active', className: 'bg-green-500/15 text-green-400 border-green-500/30' },
    revoked: { label: 'Revoked', className: 'bg-red-500/15 text-red-400 border-red-500/30' },
    // An expired key is functionally dead the same way a revoked one is
    // it can no longer back any server so it gets the same "invalidated"
    // treatment, just labeled distinctly so it's clear it wasn't a manual
    // revoke by the owner.
    expired: { label: 'Expired', className: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30' },
    exhausted: { label: 'Exhausted', className: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' },
  };
  const s = map[status] || { label: status, className: '' };
  return <Badge variant="outline" className={`text-[10px] ${s.className}`}>{s.label}</Badge>;
}

export default function PremiumOwnerPageClient() {
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [checked, setChecked] = useState(false);
  const [section, setSection] = useState('overview');

  const [genDays, setGenDays] = useState(30);
  const [genLimit, setGenLimit] = useState(1);
  const [genNote, setGenNote] = useState('');
  const [genBusy, setGenBusy] = useState(false);

  const [keys, setKeys] = useState([]);
  const [keysLoading, setKeysLoading] = useState(true);

  const [servers, setServers] = useState([]);
  const [serversLoading, setServersLoading] = useState(true);
  const [removingGuild, setRemovingGuild] = useState(null);

  const [allServers, setAllServers] = useState([]);
  const [allServersLoading, setAllServersLoading] = useState(true);
  const [guildBans, setGuildBans] = useState([]);
  const [guildBansLoading, setGuildBansLoading] = useState(true);
  const [banMessage, setBanMessage] = useState('');
  const [banBusy, setBanBusy] = useState(null);

  const [updTitle, setUpdTitle] = useState('');
  const [updTag, setUpdTag] = useState('Feature');
  const [updBody, setUpdBody] = useState('');
  const [updBusy, setUpdBusy] = useState(false);
  const [updates, setUpdates] = useState([]);
  const [updatesLoading, setUpdatesLoading] = useState(true);
  const [deletingUpdate, setDeletingUpdate] = useState(null);

  // Server truth, not a client-side hint: every list below only ever
  // renders after /api/premium/me confirms this session's Discord user id
  // matches the owner id, and every API route it calls re-checks that
  // same thing independently server-side, so hiding this page's UI is a
  // convenience, not the actual access control.
  const [user, setUser] = useState(null);

  useEffect(() => {
    (async () => {
      const r = await safeJson('/api/premium/me');
      if (!r?.is_owner) {
        router.replace('/dashboard');
        return;
      }
      setMe(r);
      const u = await safeJson('/api/auth/me');
      setUser(u?.user || null);
      setChecked(true);
      loadKeys();
      loadServers();
      loadAllServers();
      loadGuildBans();
      loadUpdates();
    })();
  }, []);

  async function loadKeys() {
    setKeysLoading(true);
    const r = await safeJson('/api/premium/keys');
    setKeys(r?.keys || []);
    setKeysLoading(false);
  }

  async function loadServers() {
    setServersLoading(true);
    const r = await safeJson('/api/premium/servers');
    setServers(r?.servers || []);
    setServersLoading(false);
  }

  async function loadAllServers() {
    setAllServersLoading(true);
    const r = await safeJson('/api/premium/all-servers');
    setAllServers(r?.servers || []);
    setAllServersLoading(false);
  }

  async function loadGuildBans() {
    setGuildBansLoading(true);
    const r = await safeJson('/api/owner/guild-bans');
    setGuildBans(r?.bans || []);
    setGuildBansLoading(false);
  }

  function isGuildBanned(guildId) {
    return guildBans.some((b) => String(b.guild_id) === String(guildId) && b.active);
  }

  async function setGuildBan(guild, action) {
    const label = guild.name || guild.id;
    if (action === 'ban' && !confirm(`Ban ${label}? The owner will be notified and Wody will leave the server.`)) return;
    if (action === 'unban' && !confirm(`Unban ${label}? The server will be allowed to use Wody again.`)) return;
    setBanBusy(guild.id);
    try {
      const r = await fetch(`/api/owner/guild-bans/${guild.id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action === 'ban' ? { message: banMessage } : {}),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || 'failed');
      if (action === 'ban') {
        toast.success('Server banned', {
          description: j.dm_sent ? 'The server owner was notified before the bot left.' : 'The ban was saved. The owner could not be reached by DM.',
        });
      } else {
        toast.success('Server unbanned');
      }
      setBanMessage('');
      loadGuildBans();
      loadAllServers();
    } catch {
      toast.error(action === 'ban' ? 'Failed to ban server' : 'Failed to unban server');
    } finally {
      setBanBusy(null);
    }
  }


  async function loadUpdates() {
    setUpdatesLoading(true);
    const r = await safeJson('/api/updates');
    setUpdates(r?.items || []);
    setUpdatesLoading(false);
  }

  async function postUpdate() {
    if (!updTitle.trim() || !updBody.trim()) {
      toast.error('Title and body are required');
      return;
    }
    setUpdBusy(true);
    const r = await fetch('/api/updates', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: updTitle, tag: updTag, body: updBody }),
    });
    setUpdBusy(false);
    if (r.ok) {
      const saved = await r.json().catch(() => null);
      toast.success('Update posted', {
        description: saved?.discord_posted
          ? 'Live on the public Updates page and posted to the Discord updates channel.'
          : 'Live on the public Updates page. Posting to the Discord updates channel failed; check the bot has access to that channel.',
      });
      setUpdTitle('');
      setUpdBody('');
      loadUpdates();
    } else {
      toast.error('Failed to post update');
    }
  }

  async function deleteUpdate(id, title) {
    if (!confirm(`Delete "${title}"? This removes it from the public Updates page immediately.`)) return;
    setDeletingUpdate(id);
    try {
      const r = await fetch(`/api/updates/${id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error('failed');
      toast.success('Update deleted');
      loadUpdates();
    } catch {
      toast.error('Failed to delete update');
    } finally {
      setDeletingUpdate(null);
    }
  }

  async function generate() {
    setGenBusy(true);
    const r = await fetch('/api/premium/generate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ days: genDays, activations_limit: genLimit, note: genNote }),
    });
    setGenBusy(false);
    if (r.ok) {
      const k = await r.json();
      toast.success('Key generated', { description: k.key });
      setGenNote('');
      loadKeys();
    } else {
      toast.error('Failed to generate key');
    }
  }

  async function revoke(key) {
    if (!confirm(`Revoke key ${key}? Any server active on it loses premium immediately.`)) return;
    const r = await fetch(`/api/premium/keys/${key}/revoke`, { method: 'POST' });
    if (r.ok) {
      const j = await r.json().catch(() => ({}));
      toast.success('Key revoked', {
        description: j.servers_removed ? `${j.servers_removed} server${j.servers_removed === 1 ? '' : 's'} removed from premium` : undefined,
      });
      loadKeys();
      loadServers();
    } else {
      toast.error('Failed to revoke key');
    }
  }

  async function removeServer(guildId, label) {
    if (!confirm(`Remove premium from ${label || guildId}? Backups and Temporary Voice are disabled immediately. This can't be undone.`)) return;
    setRemovingGuild(guildId);
    try {
      const r = await fetch(`/api/premium/servers/${guildId}/remove`, { method: 'POST' });
      if (!r.ok) throw new Error('failed');
      const j = await r.json().catch(() => ({}));
      toast.success('Premium removed', {
        description: j.keys_revoked ? `${j.keys_revoked} key(s) revoked automatically` : (label || guildId),
      });
      loadServers();
      loadKeys();
      loadAllServers();
    } catch {
      toast.error('Failed to remove premium');
    } finally {
      setRemovingGuild(null);
    }
  }

  if (!checked) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const activeSection = SECTIONS.find((s) => s.id === section) || SECTIONS[0];

  return (
    <div className="min-h-screen flex flex-col">
      <TopNav user={user} showDashboardLink hideOwnerPanelLink className="lg:hidden" />

      <main id="main-content" className="flex-1 w-full">
        {/* Header */}
        <div className="border-b border-border/50 bg-card/30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
            <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-4">
              <ArrowLeft className="w-3.5 h-3.5" /> Back to dashboard
            </Link>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-1.5 rounded-full border border-[#a04820]/40 bg-[#a04820]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#e08a4e] mb-3">
                  <Crown className="w-3 h-3" /> Owner-only access
                </div>
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
                  Owner <span className="gradient-text-shimmer">Panel</span>
                </h1>
                <p className="text-sm text-muted-foreground max-w-xl mt-2">
                  Only Discord account {OWNER_ID} can open this page. From here you manage license keys, premium servers, server bans, and public announcements.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile / tablet section tabs, horizontal scroll strip, hidden on desktop in favor of the sidebar */}
        <div className="lg:hidden sticky top-0 z-20 border-b border-border/50 bg-background/90 backdrop-blur-md">
          <div className="flex gap-1.5 overflow-x-auto scrollbar-thin px-4 sm:px-6 py-2.5">
            {SECTIONS.map((s) => {
              const Icon = s.icon;
              const active = s.id === section;
              return (
                <button
                  key={s.id}
                  onClick={() => setSection(s.id)}
                  className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-medium whitespace-nowrap transition-colors ${
                    active
                      ? 'bg-[#a04820]/20 text-[#e08a4e] border border-[#a04820]/40'
                      : 'text-muted-foreground border border-transparent hover:text-foreground hover:bg-card/60'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" /> {s.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex gap-8">
          {/* Desktop sidebar */}
          <aside className="hidden lg:block w-60 shrink-0">
            <nav className="sticky top-8 space-y-1">
              {SECTIONS.map((s) => {
                const Icon = s.icon;
                const active = s.id === section;
                return (
                  <button
                    key={s.id}
                    onClick={() => setSection(s.id)}
                    className={`w-full flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-medium text-left transition-colors ${
                      active
                        ? 'bg-[#a04820]/15 text-[#e08a4e] border border-[#a04820]/40'
                        : 'text-muted-foreground border border-transparent hover:text-foreground hover:bg-card/60'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="flex-1">{s.label}</span>
                    {active && <ChevronRight className="w-3.5 h-3.5 shrink-0" />}
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* Content */}
          <div className="flex-1 min-w-0 space-y-6">
            <div className="hidden lg:flex items-center gap-2 text-sm text-muted-foreground">
              <activeSection.icon className="w-4 h-4" />
              <span className="font-semibold text-foreground">{activeSection.label}</span>
            </div>

            {section === 'overview' && (
              <div className="space-y-6">
                <div className="grid sm:grid-cols-3 gap-3">
                  <Card className="p-4 bg-card/60 border-border/50">
                    <div className="text-xs text-muted-foreground mb-1">Active keys</div>
                    <div className="text-2xl font-bold text-[#e08a4e]">
                      {keysLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : keys.filter((k) => k.status === 'active').length}
                    </div>
                  </Card>
                  <Card className="p-4 bg-card/60 border-border/50">
                    <div className="text-xs text-muted-foreground mb-1">Servers with premium</div>
                    <div className="text-2xl font-bold text-[#e08a4e]">
                      {serversLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : servers.length}
                    </div>
                  </Card>
                  <Card className="p-4 bg-card/60 border-border/50">
                    <div className="text-xs text-muted-foreground mb-1">Total servers with Wody</div>
                    <div className="text-2xl font-bold">
                      {allServersLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : allServers.length}
                    </div>
                  </Card>
                </div>

                {/* Quick links into the other sections, same data already
                    loaded above, just a shortcut so Overview doesn't feel
                    like a dead end. */}
                <div className="grid sm:grid-cols-2 gap-3">
                  {SECTIONS.filter((s) => s.id !== 'overview').map((s) => {
                    const Icon = s.icon;
                    return (
                      <button
                        key={s.id}
                        onClick={() => setSection(s.id)}
                        className="group flex items-center gap-3 rounded-xl border border-border/50 bg-card/40 p-4 text-left hover:border-[#a04820]/40 hover:bg-card/60 transition-colors"
                      >
                        <div className="w-9 h-9 rounded-lg bg-[#a04820]/10 border border-[#a04820]/30 flex items-center justify-center shrink-0 text-[#e08a4e]">
                          <Icon className="w-4 h-4" />
                        </div>
                        <span className="flex-1 text-sm font-medium">{s.label}</span>
                        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground shrink-0" />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {section === 'keys' && (
              <div className="space-y-6">
                {/* Generate key */}
                <Card className="p-6 bg-card/60 border-[#a04820]/40 relative overflow-hidden">
                  <div className="absolute -top-16 -left-16 w-48 h-48 rounded-full bg-[#a04820]/15 blur-3xl pointer-events-none" />
                  <div className="relative">
                  <div className="font-semibold mb-1 flex items-center gap-2 text-[#e08a4e]">
                    <Sparkles className="w-4 h-4" /> Generate premium key
                  </div>
                  <div className="grid sm:grid-cols-3 gap-3 mb-3 mt-3">
                    <div>
                      <Label>Days valid</Label>
                      <Input type="number" min={1} max={3650} value={genDays} onChange={(e) => setGenDays(Number(e.target.value))} />
                    </div>
                    <div>
                      <Label>Activation limit</Label>
                      <Input type="number" min={1} max={100} value={genLimit} onChange={(e) => setGenLimit(Number(e.target.value))} />
                    </div>
                    <div>
                      <Label>Note (optional)</Label>
                      <Input value={genNote} onChange={(e) => setGenNote(e.target.value)} placeholder="e.g. Youtuber ABC" />
                    </div>
                  </div>
                  <Button onClick={generate} disabled={genBusy} className="gradient-primary">
                    {genBusy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                    Generate key
                  </Button>
                  </div>
                </Card>

                {/* Keys list */}
                <Card className="p-6 bg-card/60">
                  <div className="flex items-center justify-between mb-3">
                    <div className="font-semibold flex items-center gap-2"><Key className="w-4 h-4" /> Generated keys</div>
                    <Button variant="outline" size="sm" onClick={loadKeys}><RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh</Button>
                  </div>
                  {keysLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : keys.length === 0 ? (
                    <div className="text-xs text-muted-foreground">No keys yet.</div>
                  ) : (
                    <div className="space-y-2 max-h-96 overflow-y-auto scrollbar-thin pr-1">
                      {keys.map((k) => (
                        <div key={k._id} className="rounded-lg border border-border/50 p-3 flex flex-wrap items-center gap-3 text-sm">
                          <code className="font-mono text-[#e08a4e]">{k.key}</code>
                          <button onClick={() => { navigator.clipboard.writeText(k.key); toast.success('Copied'); }} title="Copy" className="text-muted-foreground hover:text-foreground">
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <div className="text-xs text-muted-foreground flex-1 min-w-[160px] truncate">
                            {k.activations_used || 0}/{k.activations_limit || 1} used · exp {k.expires_at ? new Date(k.expires_at).toLocaleDateString('en-US') : 'N/A'}
                            {k.note ? ` · ${k.note}` : ''}
                          </div>
                          <StatusBadge status={k.status} />
                          {k.status === 'active' && (
                            <button onClick={() => revoke(k.key)} className="text-xs text-destructive hover:underline shrink-0">
                              revoke
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </div>
            )}

            {section === 'premium-servers' && (
              <Card className="p-6 bg-card/60">
                <div className="flex items-center justify-between mb-1">
                  <div className="font-semibold flex items-center gap-2"><Crown className="w-4 h-4 text-[#e08a4e]" /> Servers with premium active</div>
                  <Button variant="outline" size="sm" onClick={loadServers}><RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh</Button>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  When a key is revoked or expires, the server drops off this list automatically. No need to remove it by hand.
                </p>
                {serversLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : servers.length === 0 ? (
                  <div className="text-xs text-muted-foreground">No server has premium active right now.</div>
                ) : (
                  <div className="space-y-2 max-h-[32rem] overflow-y-auto scrollbar-thin pr-1">
                    {servers.map((s) => (
                      <div key={s._id} className="rounded-lg border border-border/50 p-3 flex items-center gap-3 text-sm">
                        {s.guild_icon_url ? (
                          <img src={discordCdnUrl(s.guild_icon_url)} alt="" className="w-9 h-9 rounded-lg shrink-0" />
                        ) : (
                          <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                            <Server className="w-4 h-4 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{s.guild_name || `Unknown server (${s.guild_id})`}</div>
                          <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-0.5">
                            <span>ID {s.guild_id}</span>
                            {s.member_count != null && (
                              <span className="inline-flex items-center gap-1"><Users className="w-3 h-3" /> {s.member_count.toLocaleString('en-US')}</span>
                            )}
                            <span>{s.expires_at ? `expires ${new Date(s.expires_at).toLocaleDateString('en-US')}` : 'no expiration'}</span>
                            <span className="font-mono">{s.key_value}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => removeServer(s.guild_id, s.guild_name)}
                          disabled={removingGuild === s.guild_id}
                          className="text-xs text-destructive hover:underline shrink-0"
                        >
                          {removingGuild === s.guild_id ? 'removing…' : 'remove premium'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )}

            {section === 'all-servers' && (
              <Card className="p-6 bg-card/60">
                <div className="flex items-center justify-between mb-1">
                  <div className="font-semibold flex items-center gap-2"><Server className="w-4 h-4" /> All servers with Wody</div>
                  <Button variant="outline" size="sm" onClick={loadAllServers}><RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh</Button>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  Every server, not just the premium ones, sorted by member count.
                </p>
                {allServersLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : allServers.length === 0 ? (
                  <div className="text-xs text-muted-foreground">Couldn't load the server list.</div>
                ) : (
                  <div className="space-y-2 max-h-[32rem] overflow-y-auto scrollbar-thin pr-1">
                    {allServers.map((g) => (
                      <div key={g.id} className="rounded-lg border border-border/50 p-3 flex items-center gap-3 text-sm">
                        {g.icon_url ? (
                          <img src={discordCdnUrl(g.icon_url)} alt="" className="w-9 h-9 rounded-lg shrink-0" />
                        ) : (
                          <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                            <Server className="w-4 h-4 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium flex items-center gap-2 min-w-0">
                            <span className="truncate min-w-0">{g.name}</span>
                            {g.premium && <Badge className="text-[10px] bg-yellow-500/15 text-yellow-400 border-yellow-500/30 shrink-0">Premium</Badge>}
                          </div>
                          <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-0.5">
                            <span>ID {g.id}</span>
                            {g.member_count != null && (
                              <span className="inline-flex items-center gap-1"><Users className="w-3 h-3" /> {g.member_count.toLocaleString('en-US')} members</span>
                            )}
                            {g.online_count != null && <span>{g.online_count.toLocaleString('en-US')} online</span>}
                          </div>
                        </div>
                        {g.premium ? (
                          <ShieldCheck className="w-4 h-4 text-yellow-400 shrink-0" />
                        ) : (
                          <ShieldAlert className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )}

            {section === 'enforcement' && (
              <Card className="p-6 bg-card/60 border-red-500/30 relative overflow-hidden">
                <div className="absolute -top-20 -right-20 w-56 h-56 rounded-full bg-red-500/10 blur-3xl pointer-events-none" />
                <div className="relative space-y-4">
                  <div>
                    <div className="font-semibold flex items-center gap-2 text-red-400">
                      <ShieldAlert className="w-4 h-4" /> Server enforcement
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Owner-only server bans. A ban is stored server-side, the server owner is notified when possible, and Wody leaves the server.
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="guild-ban-message" className="flex items-center gap-2"><MessageSquare className="w-3.5 h-3.5" /> Message to server owner (optional)</Label>
                    <Textarea id="guild-ban-message" value={banMessage} onChange={(e) => setBanMessage(e.target.value)} maxLength={1800}
                      placeholder="Explain why the server is being blocked…" className="mt-2 min-h-20" />
                  </div>
                  {allServersLoading || guildBansLoading ? (
                    <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
                  ) : allServers.length === 0 ? (
                    <div className="text-sm text-muted-foreground py-4">No servers found.</div>
                  ) : (
                    <div className="max-h-[520px] overflow-y-auto space-y-2 pr-1">
                      {allServers.map((guild) => {
                        const banned = isGuildBanned(guild.id);
                        const busy = banBusy === guild.id;
                        return (
                          <div key={guild.id} className={`flex items-center gap-3 rounded-xl border p-3 ${banned ? 'border-red-500/30 bg-red-500/5' : 'border-border/50 bg-background/20'}`}>
                            {guild.icon_url ? <img src={discordCdnUrl(guild.icon_url)} alt="" className="w-10 h-10 rounded-xl" /> : <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center"><Server className="w-4 h-4" /></div>}
                            <div className="min-w-0 flex-1">
                              <div className="font-medium text-sm truncate">{guild.name}</div>
                              <div className="text-xs text-muted-foreground truncate">{guild.id}{banned ? ' · Banned' : ''}</div>
                            </div>
                            {banned ? (
                              <Button size="sm" variant="outline" onClick={() => setGuildBan(guild, 'unban')} disabled={busy} className="gap-1.5 border-green-500/30 text-green-400 hover:bg-green-500/10">
                                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Undo2 className="w-3.5 h-3.5" />} Unban
                              </Button>
                            ) : (
                              <Button size="sm" variant="outline" onClick={() => setGuildBan(guild, 'ban')} disabled={busy} className="gap-1.5 border-red-500/30 text-red-400 hover:bg-red-500/10">
                                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Ban className="w-3.5 h-3.5" />} Ban server
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Banned servers, listed on their own, independent of the list
                      above. As soon as a ban goes through, Wody leaves the server
                      (see the /owner/guild-bans/:id/ban route), which means that
                      server disappears from allServers (Wody's current guild
                      list) immediately. Without this separate section sourced
                      straight from the guild_bans collection, an enforced ban
                      became invisible in the UI the moment it actually took
                      effect, the only place left to prove it was even banned was
                      the database itself, with no way to review or undo it from
                      here. Shown for every ban with active:true regardless of
                      whether Wody is currently in that server. */}
                  <div className="pt-2 border-t border-border/40">
                    <div className="flex items-center gap-2 mt-4 mb-3">
                      <Ban className="w-3.5 h-3.5 text-red-400" />
                      <span className="text-sm font-semibold">Banned servers</span>
                      {!guildBansLoading && (
                        <Badge variant="outline" className="text-[10px] border-red-500/30 text-red-400">
                          {guildBans.filter((b) => b.active).length}
                        </Badge>
                      )}
                    </div>
                    {guildBansLoading ? (
                      <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
                    ) : guildBans.filter((b) => b.active).length === 0 ? (
                      <div className="text-sm text-muted-foreground py-2">No servers are currently banned.</div>
                    ) : (
                      <div className="space-y-2">
                        {guildBans.filter((b) => b.active).map((ban) => {
                          const busy = banBusy === ban.guild_id;
                          // A banned server that Wody already left has no live
                          // Discord data to show, fall back to what was captured
                          // at the moment it was banned (see the ban route), and
                          // only as a last resort (bans made before that capture
                          // existed) to the bare id.
                          const label = ban.name || `Server ${ban.guild_id}`;
                          return (
                            <div key={ban._id || ban.guild_id} className="flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/5 p-3">
                              {ban.icon_url ? <img src={discordCdnUrl(ban.icon_url)} alt="" className="w-10 h-10 rounded-xl" /> : <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center"><Server className="w-4 h-4" /></div>}
                              <div className="min-w-0 flex-1">
                                <div className="font-medium text-sm truncate">{label}</div>
                                <div className="text-xs text-muted-foreground truncate">
                                  {ban.guild_id}
                                  {ban.banned_at ? ` · Banned ${new Date(ban.banned_at).toLocaleDateString()}` : ''}
                                </div>
                              </div>
                              <Button size="sm" variant="outline" onClick={() => setGuildBan({ id: ban.guild_id, name: ban.name }, 'unban')} disabled={busy} className="gap-1.5 border-green-500/30 text-green-400 hover:bg-green-500/10">
                                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Undo2 className="w-3.5 h-3.5" />} Unban
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            )}

            {section === 'updates' && (
              <div className="space-y-6">
                {/* Post an update (public /updates page) */}
                <Card className="p-6 bg-card/60 border-[#a04820]/40 relative overflow-hidden">
                  <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-[#a04820]/15 blur-3xl pointer-events-none" />
                  <div className="relative">
                    <div className="font-semibold mb-1 flex items-center gap-2 text-[#e08a4e]">
                      <Megaphone className="w-4 h-4" /> Post an update
                    </div>
                    <p className="text-xs text-muted-foreground mb-4">
                      Published instantly to the public <a href="/updates" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">Updates page</a>.
                    </p>
                    <div className="grid sm:grid-cols-[1fr_180px] gap-3 mb-3">
                      <div>
                        <Label>Title</Label>
                        <Input value={updTitle} onChange={(e) => setUpdTitle(e.target.value)} placeholder="e.g. Reaction Roles v2 is live" maxLength={150} />
                      </div>
                      <div>
                        <Label>Tag</Label>
                        <Select value={updTag} onValueChange={setUpdTag}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {UPDATE_TAGS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="mb-3">
                      <Label>Body</Label>
                      <Textarea
                        value={updBody}
                        onChange={(e) => setUpdBody(e.target.value)}
                        placeholder="What changed, what it fixes, or what's new..."
                        maxLength={5000}
                        rows={5}
                      />
                    </div>
                    <Button onClick={postUpdate} disabled={updBusy} className="gradient-primary">
                      {updBusy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                      Post update
                    </Button>
                  </div>
                </Card>

                {/* Posted updates */}
                <Card className="p-6 bg-card/60">
                  <div className="flex items-center justify-between mb-3">
                    <div className="font-semibold flex items-center gap-2"><Megaphone className="w-4 h-4" /> Posted updates</div>
                    <Button variant="outline" size="sm" onClick={loadUpdates}><RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh</Button>
                  </div>
                  {updatesLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : updates.length === 0 ? (
                    <div className="text-xs text-muted-foreground">No updates posted yet.</div>
                  ) : (
                    <div className="space-y-2 max-h-96 overflow-y-auto scrollbar-thin pr-1">
                      {updates.map((u) => (
                        <div key={u._id} className="rounded-lg border border-border/50 p-3 flex items-start gap-3 text-sm">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <span className="font-medium truncate">{u.title}</span>
                              <Badge variant="outline" className="text-[10px]">{u.tag || 'Update'}</Badge>
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              {u.created_at ? new Date(u.created_at).toLocaleDateString('en-US') : ''} · {u.body}
                            </div>
                          </div>
                          <button
                            onClick={() => deleteUpdate(u._id, u.title)}
                            disabled={deletingUpdate === u._id}
                            title="Delete"
                            className="text-muted-foreground hover:text-destructive shrink-0"
                          >
                            {deletingUpdate === u._id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </div>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
