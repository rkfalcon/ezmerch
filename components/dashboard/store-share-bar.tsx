import Link from "next/link";
import { CopyButton } from "@/components/dashboard/copy-button";
import { storeSharingGuide, type SharingStore } from "@/lib/sharing/guide";
export function StoreShareBar({ store }: { store: SharingStore }) {
  const { url } = storeSharingGuide(store);
  return (
    <section
      aria-label="Share your store"
      className="mb-6 rounded-lg border bg-muted/30 p-3"
    >
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 basis-full sm:flex-1 sm:basis-auto">
          <p className="text-xs font-medium text-muted-foreground">
            Your store link · {store.name}
          </p>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm underline break-all"
          >
            {url}
          </a>
        </div>
        <CopyButton text={url} label="Copy store link" />
        <Link href="/dashboard/store/share" className="text-sm underline">
          Add to your website &amp; email instructions
        </Link>
      </div>
    </section>
  );
}
