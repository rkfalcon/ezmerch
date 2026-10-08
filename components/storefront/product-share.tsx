"use client";

import { useState } from 'react';
import { flushSync } from 'react-dom';
import { Share2, Copy, Mail, MessageCircle, Camera, Globe } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { productShare } from '@/lib/product-share';

export function ProductShare({ store, product }: { store: { name: string; slug: string }; product: { id: string; title: string } }) {
  const share = productShare(store, product);
  const [open, setOpen] = useState(false);
  const [manualCopy, setManualCopy] = useState(false);
  const [message, setMessage] = useState('');
  const [nativeShare, setNativeShare] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(share.caption); setMessage('Caption and link copied.'); }
    catch { setManualCopy(true); setMessage('Copy the caption and link from the field below.'); }
  }
  async function more() {
    // Release menu focus/pointer handling before iOS suspends the browser.
    // Keep this synchronous so native sharing retains the click activation.
    flushSync(() => setOpen(false));
    try {
      await navigator.share({ title: share.title, text: share.text, url: share.url });
    } catch (error) {
      if (!(error instanceof Error && error.name === 'AbortError')) setMessage('Sharing is unavailable. Use Copy caption + link instead.');
    }
  }
  const item = 'min-h-11 gap-2';
  return <div className="absolute bottom-3 right-3">
    <DropdownMenu modal={false} open={open} onOpenChange={(nextOpen) => { setOpen(nextOpen); setNativeShare(typeof navigator.share === 'function'); }}>
      <DropdownMenuTrigger className="flex min-h-11 items-center gap-2 rounded-full border bg-background px-4 text-sm text-foreground shadow-md" aria-label="Share product">
        <Share2 size={18} /> Share
      </DropdownMenuTrigger>
      {open && <DropdownMenuContent align="end" side="top" className="w-60">
        <DropdownMenuItem className={item} render={<a href={share.x} target="_blank" rel="noopener noreferrer" />}><span aria-hidden="true">𝕏</span> Share on X</DropdownMenuItem>
        <DropdownMenuItem className={item} render={<a href={share.facebook} target="_blank" rel="noopener noreferrer" />}
          onClick={(event) => {
            // Avoid the mobile Facebook universal link dropping the share payload.
            if (typeof navigator.share === 'function' && window.matchMedia('(pointer: coarse)').matches) {
              event.preventDefault();
              setMessage('Choose Facebook in the share sheet. If it is missing, use Copy caption + link and paste it into a Facebook post.');
              void more();
            }
          }}><Globe size={16} /> Share on Facebook</DropdownMenuItem>
        <DropdownMenuItem className={item} onClick={async () => {
          flushSync(() => setOpen(false));
          try {
            await navigator.clipboard.writeText(share.caption);
            setMessage('Caption and product link copied. Open Instagram and paste them into a message.');
          } catch {
            setManualCopy(true);
            setMessage('Copy the caption and product link below, then paste them into an Instagram message.');
          }
        }}><Camera size={16} /> Instagram · copy link</DropdownMenuItem>
        <DropdownMenuItem className={item} render={<a href={share.email} />}><Mail size={16} /> Email</DropdownMenuItem>
        <DropdownMenuItem className={item} onClick={() => {
          const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
          window.location.href = `sms:${ios ? '&' : '?'}body=${encodeURIComponent(share.caption)}`;
        }}><MessageCircle size={16} /> Text message</DropdownMenuItem>
        <DropdownMenuItem className={item} onClick={copy}><Copy size={16} /> Copy caption + link</DropdownMenuItem>
        {nativeShare && <DropdownMenuItem className={item} onClick={() => more()}><Share2 size={16} /> More sharing options</DropdownMenuItem>}
      </DropdownMenuContent>}
    </DropdownMenu>
    {message && <div className="absolute bottom-14 right-0 w-64 rounded border bg-background p-3 text-sm shadow">
      <p role="status">{message}</p>
      {manualCopy && <textarea aria-label="Caption and product link" readOnly value={share.caption} className="mt-2 h-28 w-full rounded border p-2" onFocus={event => event.target.select()} />}
      <button className="mt-2 min-h-11 underline" onClick={() => { setMessage(''); setManualCopy(false); }}>Dismiss</button>
    </div>}
  </div>;
}
