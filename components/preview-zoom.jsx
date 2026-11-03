'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Maximize2, Search } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';

const LENS = 210;
const POWER = 2.4;

function Lens({ box, point, children }) {
  const r = LENS / 2;
  return (
    <div aria-hidden="true" className="pointer-events-none absolute z-30 overflow-hidden rounded-full border-2 border-[#e6cd8c] bg-[#313338] shadow-[0_10px_40px_rgba(0,0,0,0.55)]"
      style={{ width: LENS, height: LENS, left: point.x - r, top: point.y - r }}>
      <div style={{ position: 'absolute', left: 0, top: 0, width: box.w, transformOrigin: '0 0', transform: `translate(${r - point.x * POWER}px, ${r - point.y * POWER}px) scale(${POWER})` }}>
        {children}
      </div>
    </div>
  );
}

export default function PreviewZoom({ children, className = '' }) {
  const t = useTranslations('guildSettings.kit.zoom');
  const ref = useRef(null);
  const [open, setOpen] = useState(false);
  const [size, setSize] = useState(1.25);
  const [lens, setLens] = useState(null);
  const [box, setBox] = useState({ w: 0 });
  const [lensOn, setLensOn] = useState(true);

  const move = useCallback((e) => {
    if (e.pointerType && e.pointerType !== 'mouse') return;
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setBox({ w: rect.width });
    setLens({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }, []);
  const leave = useCallback(() => setLens(null), []);
  useEffect(() => { if (open) setLens(null); }, [open]);

  return (
    <div className={`group/zoom relative min-w-0 ${className}`}>
      <div ref={ref} className="relative min-w-0" onPointerMove={lensOn ? move : undefined} onPointerLeave={leave} style={{ cursor: lensOn ? 'zoom-in' : undefined }}>
        {children}
        {lensOn && lens && box.w > 0 ? <Lens box={box} point={lens}>{children}</Lens> : null}
      </div>
      <div className="absolute right-2 top-2 z-20 flex gap-1 opacity-80 transition-opacity group-hover/zoom:opacity-100 focus-within:opacity-100">
        <button type="button" onClick={() => { setLensOn((v) => !v); setLens(null); }} aria-pressed={lensOn} title={t('lens')}
          className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border text-xs backdrop-blur-none transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e6cd8c] ${lensOn ? 'border-[#e6cd8c] bg-[#e6cd8c] text-[#1a1208]' : 'border-white/20 bg-[#1e1f22] text-[#dbdee1] hover:border-[#e6cd8c]/70'}`}>
          <Search className="h-4 w-4" aria-hidden="true" /><span className="sr-only">{t('lens')}</span>
        </button>
        <button type="button" onClick={() => setOpen(true)} title={t('open')}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/20 bg-[#1e1f22] px-2.5 text-xs font-semibold text-[#f2f3f5] transition hover:border-[#e6cd8c]/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e6cd8c]">
          <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />{t('open')}
        </button>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[min(1100px,96vw)] gap-3 border-[#e6cd8c]/30 bg-[#1e1f22] p-3 sm:p-5">
          <DialogTitle className="text-base font-bold">{t('title')}</DialogTitle>
          <DialogDescription className="sr-only">{t('hint')}</DialogDescription>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <label htmlFor="pz-size" className="shrink-0 font-medium">{t('size')}</label>
            <input id="pz-size" type="range" min={100} max={200} step={5} value={Math.round(size * 100)} onChange={(e) => setSize(Number(e.target.value) / 100)} className="w-full max-w-xs accent-[#e6cd8c]" />
            <span className="w-10 tabular-nums">{Math.round(size * 100)}%</span>
          </div>
          <div className="overflow-auto rounded-xl">
            <div style={{ zoom: size }}>{children}</div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
