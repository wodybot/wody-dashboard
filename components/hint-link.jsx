'use client';
import { ArrowUpRight } from 'lucide-react';
import { Link } from '@/i18n/navigation';

const BASE = 'group/hint inline-flex max-w-full items-center gap-2 rounded-full border border-[#e6cd8c]/40 bg-[#e6cd8c]/10 px-3.5 py-1.5 text-xs font-semibold text-[#f3e1b0] no-underline transition hover:border-[#e6cd8c] hover:bg-[#e6cd8c]/20 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e6cd8c]';

export default function HintLink({ href, onClick, icon: Icon, children, className = '', external = false }) {
  const body = (
    <>
      {Icon ? <Icon className="h-3.5 w-3.5 shrink-0 text-[#e6cd8c]" aria-hidden="true" /> : null}
      <span className="min-w-0 truncate">{children}</span>
      <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-[#e6cd8c] transition-transform group-hover/hint:-translate-y-0.5 group-hover/hint:translate-x-0.5" aria-hidden="true" />
    </>
  );
  if (href && external) return <a href={href} target="_blank" rel="noopener noreferrer" className={`${BASE} ${className}`}>{body}</a>;
  if (href) return <Link href={href} className={`${BASE} ${className}`}>{body}</Link>;
  return <button type="button" onClick={onClick} className={`${BASE} ${className}`}>{body}</button>;
}
