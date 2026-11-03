'use client';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { ImagePlus, Loader2, Trash2, UploadCloud } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { proxiedImageUrl } from '@/lib/utils';

export const IMAGE_ACCEPT = 'image/png,image/jpeg,image/webp,image/gif';
const ERRORS = {
  image_too_large: 'The image is too big. The limit is 4 MB.',
  image_invalid: 'This file is not a PNG, JPG, WebP or GIF image.',
  image_dimensions: 'The image is too small or too large (16 to 8000 px).',
  forbidden: 'Only the owner can upload images.',
};

/** Uploads one file to the server and resolves with its stored path (or null after showing the error). */
export async function uploadSiteImageFile(file) {
  if (!file) return null;
  if (file.size > 4 * 1024 * 1024) { toast.error(ERRORS.image_too_large); return null; }
  const form = new FormData();
  form.append('file', file);
  try {
    const res = await fetch('/api/site-image', { method: 'POST', body: form });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json.url) return json.url;
    toast.error(ERRORS[json.error] || 'The upload failed. Try again.');
  } catch {
    toast.error('The upload failed. Check your connection and try again.');
  }
  return null;
}

/** Upload from the computer or paste a link; the file is stored on the server. */
export function OwnerImageField({ label, value, onChange, hint, aspect = 'aspect-[16/9]', compact = false }) {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);

  async function pick(file) {
    setBusy(true);
    const url = await uploadSiteImageFile(file);
    setBusy(false);
    if (url) onChange(url);
  }

  return (
    <div>
      {label ? <Label className="mb-1.5 block">{label}</Label> : null}
      <div className={`flex gap-3 ${compact ? 'items-center' : 'flex-col sm:flex-row'}`}>
        <div
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f) pick(f); }}
          className={`relative shrink-0 overflow-hidden rounded-xl border border-dashed ${drag ? 'border-[#e6cd8c] bg-[#e6cd8c]/10' : 'border-border/70 bg-background/40'} ${compact ? 'h-16 w-24' : `w-full sm:w-56 ${aspect}`}`}
        >
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={proxiedImageUrl(value)} alt="" className="h-full w-full object-cover" />
          ) : (
            <button type="button" onClick={() => input.current?.click()} className="flex h-full w-full flex-col items-center justify-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">
              <UploadCloud className="h-5 w-5" aria-hidden="true" />
              {compact ? null : <span>Drop an image or click</span>}
            </button>
          )}
          {busy ? <div className="absolute inset-0 flex items-center justify-center bg-black/55"><Loader2 className="h-5 w-5 animate-spin" /></div> : null}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" className="gap-1.5" disabled={busy} onClick={() => input.current?.click()}>
              <ImagePlus className="h-3.5 w-3.5" />{value ? 'Replace' : 'Upload from computer'}
            </Button>
            {value ? <Button type="button" size="sm" variant="ghost" className="gap-1.5 text-red-400" onClick={() => onChange('')}><Trash2 className="h-3.5 w-3.5" />Remove</Button> : null}
            <input ref={input} type="file" accept={IMAGE_ACCEPT} className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) pick(f); }} />
          </div>
          <Input value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder="or paste an image link (https://...)" className="h-8 text-xs" />
          <p className="text-[11px] text-muted-foreground">{hint || 'PNG, JPG, WebP or GIF, up to 4 MB. Uploaded files are stored on the Wody server.'}</p>
        </div>
      </div>
    </div>
  );
}
