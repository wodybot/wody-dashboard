'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check, ChevronsUpDown, Plus, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import IconText, { Icon } from '@/components/icon-text';

const trigger = 'flex h-10 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-left text-sm transition hover:border-[#e6cd8c]/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50';

function dot(color) {
  if (!color) return null;
  const hex = `#${Number(color).toString(16).padStart(6, '0')}`;
  return <span className="mr-1.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full align-middle" style={{ background: hex }} aria-hidden="true" />;
}

export const channelOptions = (channels, types = [0, 5]) => (Array.isArray(channels) ? channels : [])
  .filter((c) => types.includes(c.type))
  .map((c) => ({ id: String(c.id), label: c.name, prefix: c.type === 2 ? '{wy:speaker}' : c.type === 4 ? '{wy:folder}' : '#' }));

export const roleOptions = (roles) => (Array.isArray(roles) ? roles : [])
  .filter((r) => !r.managed)
  .map((r) => ({ id: String(r.id), label: r.name, prefix: '@', color: r.color }));

function Label({ o }) {
  return <span className="flex min-w-0 items-center truncate">{dot(o.color)}<span className="mr-1 text-muted-foreground"><IconText text={o.prefix} size={14} /></span><span className="truncate">{o.label}</span></span>;
}

function OptionList({ options, isOn, onPick, multi, empty }) {
  const t = useTranslations('guildSettings.common');
  return (
    <Command>
      <CommandInput placeholder={t('searchPlaceholder')} />
      <CommandList className="max-h-64">
        <CommandEmpty>{empty || t('noResults')}</CommandEmpty>
        <CommandGroup>
          {options.map((o) => (
            <CommandItem key={o.id} value={`${o.label} ${o.id}`} onSelect={() => onPick(o.id)} className="cursor-pointer gap-2">
              <Check className={`h-4 w-4 shrink-0 ${isOn(o.id) ? 'opacity-100 text-[#e6cd8c]' : 'opacity-0'}`} aria-hidden="true" />
              <Label o={o} />
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  );
}

/** Single choice with search. */
export function SearchableSelect({ value, onChange, options, placeholder, includeNone = true, noneLabel, disabled = false, empty }) {
  const t = useTranslations('guildSettings.common');
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.id === String(value));
  const all = useMemo(() => (includeNone ? [{ id: '__none', label: noneLabel || t('none'), prefix: '' }, ...options] : options), [options, includeNone, noneLabel, t]);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" disabled={disabled} className={trigger} aria-haspopup="listbox" aria-expanded={open}>
          {current ? <Label o={current} /> : <span className="truncate text-muted-foreground">{placeholder}</span>}
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-[16rem] p-0">
        <OptionList options={all} empty={empty} isOn={(id) => (id === '__none' ? !current : id === String(value))} onPick={(id) => { onChange(id === '__none' ? null : id); setOpen(false); }} />
      </PopoverContent>
    </Popover>
  );
}

/** Several choices: what is already added is shown first as removable chips; the search list sits below. */
export function MultiPicker({ value, onChange, options, placeholder, disabled = false, max, empty }) {
  const t = useTranslations('guildSettings.common');
  const [open, setOpen] = useState(false);
  const selected = Array.isArray(value) ? value.map(String) : [];
  const byId = useMemo(() => new Map(options.map((o) => [o.id, o])), [options]);
  const chips = selected.map((id) => byId.get(id)).filter(Boolean);
  const full = max != null && selected.length >= max;
  const toggle = (id) => {
    if (selected.includes(id)) onChange(selected.filter((x) => x !== id));
    else if (!full) onChange([...selected, id]);
  };
  return (
    <div className={`space-y-2 ${disabled ? 'pointer-events-none opacity-50' : ''}`}>
      {chips.length ? (
        <ul className="flex flex-wrap gap-1.5" aria-label={placeholder}>
          {chips.map((o) => (
            <li key={o.id} className="inline-flex max-w-full items-center gap-1 rounded-full border border-[#e6cd8c]/40 bg-[#e6cd8c]/10 py-0.5 pl-2.5 pr-1 text-xs font-medium">
              <Label o={o} />
              <button type="button" onClick={() => toggle(o.id)} className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground transition hover:bg-white/15 hover:text-foreground" aria-label={`${t('remove')}: ${o.label}`}><X className="h-3 w-3" aria-hidden="true" /></button>
            </li>
          ))}
          {chips.length > 1 ? <li><button type="button" onClick={() => onChange([])} className="rounded-full px-2 py-0.5 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">{t('clearAll')}</button></li> : null}
        </ul>
      ) : <p className="text-xs text-muted-foreground">{placeholder}</p>}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button type="button" disabled={disabled || full} className={trigger}>
            <span className="inline-flex items-center gap-2 text-muted-foreground"><Plus className="h-4 w-4" aria-hidden="true" />{full ? t('limitReached', { max }) : t('addMore')}</span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" aria-hidden="true" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-[16rem] p-0">
          <OptionList options={options} multi empty={empty} isOn={(id) => selected.includes(id)} onPick={toggle} />
        </PopoverContent>
      </Popover>
    </div>
  );
}
