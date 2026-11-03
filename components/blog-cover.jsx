'use client';
import { useState } from 'react';
import Image from 'next/image';
import { BookOpen } from 'lucide-react';

export function BlogCover({ src, sizes, priority = false, quality = 90 }) {
  const [stage, setStage] = useState(0);
  if (stage >= 2) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#3d1e0d] to-[#1a0e08]">
        <BookOpen className="h-8 w-8 text-[#c46a2d]/50" aria-hidden="true" />
      </div>
    );
  }
  if (stage === 1) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" onError={() => setStage(2)} />;
  }
  return <Image src={src} alt="" fill sizes={sizes} quality={quality} priority={priority} className="object-cover" onError={() => setStage(1)} />;
}
