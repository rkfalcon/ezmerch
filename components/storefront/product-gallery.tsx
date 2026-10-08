"use client";

import { useState, type ReactNode } from 'react';
import type { GalleryImage } from '@/lib/lineup/gallery';

export function ProductGallery({ images, title, children }: {images:GalleryImage[];title:string;children:ReactNode}) {
  const [selected, setSelected] = useState<string | null>(null);
  const image = images.find(i => i.url === selected) ?? images[0];
  return <div className="min-w-0 space-y-3">
    <div className="relative aspect-square overflow-hidden rounded-lg bg-muted">
      {image ? <img src={image.url} alt={`${title} — ${image.style}`} className="h-full w-full object-contain" /> : <div className="flex h-full items-center justify-center text-6xl">{title.charAt(0)}</div>}
      {children}
    </div>
    {images.length > 1 && <div role="group" aria-label="Product images" className="flex gap-2 overflow-x-auto p-1">
      {images.map(i => <button type="button" key={i.url} aria-label={`View ${i.style}`} aria-pressed={i.url === image.url}
        onClick={() => setSelected(i.url)} className={`w-20 shrink-0 rounded-md border p-1 focus-visible:outline-2 focus-visible:outline-offset-2 ${i.url === image.url ? 'border-primary ring-2 ring-primary' : 'border-border'}`}>
        <img src={i.url} alt={i.style} loading="lazy" className="aspect-square w-full rounded object-contain" />
      </button>)}
    </div>}
  </div>;
}
