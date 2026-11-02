'use client';
import { useState } from 'react';
import Image from 'next/image';
import { BookOpen } from 'lucide-react';

// Cover picture of a blog post. The picture is a link the owner pasted, so the site that hosts it can be slow
// or refuse the resizing server. Instead of leaving a broken picture, it first retries the original file
// directly in the browser and, if that fails too, shows the same placeholder a post without a cover gets.
export function BlogCover({ src, sizes, priority = false, quality = 90 }) {
  const [stage, setStage] = useState(0); // 0 optimized, 1 original file, 2 placeholder
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
