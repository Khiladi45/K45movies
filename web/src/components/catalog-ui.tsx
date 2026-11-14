"use client";

import Link from "next/link";
import { Film, ChevronRight, Bookmark, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useLibrary, type SavedTitle } from "@/lib/library";

export type Card = { href: string; title: string; image?: string; note?: string };

export function Artwork({ src, className = "" }: { src?: string; className?: string }) {
  return (
    <span className={"artwork " + className}>
      <Film size={26} aria-hidden="true" />
      {src && (
        // Provider artwork has runtime-selected hosts and unknown dimensions.
        // eslint-disable-next-line @next/next/no-img-element
        <img key={src} src={src} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={(event) => { event.currentTarget.hidden = true; }} />
      )}
    </span>
  );
}

export function CardGrid({ items, rail = false }: { items: Card[]; rail?: boolean }) {
  return (
    <ul className={rail ? "poster-rail" : "poster-grid"}>
      {items.map((item) => (
        <li key={item.href} className="min-w-0">
          <Link href={item.href} className="poster-card" prefetch={false}>
            <Artwork src={item.image} className="aspect-[2/3] rounded-xl" />
            <span className="mt-2 block truncate text-sm font-semibold" title={item.title}>{item.title}</span>
            {item.note && <span className="mt-0.5 block truncate text-xs text-muted">{item.note}</span>}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function CatalogSkeleton() {
  return (
    <div className="poster-grid motion-safe:animate-pulse" role="status" aria-label="Loading titles">
      {Array.from({ length: 6 }, (_, i) => <div key={i} className="aspect-[2/3] rounded-xl bg-surface" />)}
    </div>
  );
}

export function QueryMessage({ children, retry }: { children: ReactNode; retry?: () => void }) {
  return <div className="empty-panel" role={retry ? "alert" : "status"}>
    {children}
    {retry && <button className="secondary-button mt-3" type="button" onClick={retry}>Retry</button>}
  </div>;
}

export function Rail({ title, href, children }: { title: string; href?: string; children: ReactNode }) {
  return (
    <section className="mt-8">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-xl font-semibold sm:text-2xl">{title}</h2>
        {href && <Link className="inline-flex items-center gap-1 text-sm text-accent" href={href}>View all <ChevronRight size={16} /></Link>}
      </div>
      {children}
    </section>
  );
}

export function BackLink({ href = "/" }: { href?: string }) {
  const router = useRouter();
  return <Link href={href} className="secondary-button mb-5" onClick={(event) => {
    const navigation = (window as Window & {
      navigation?: {
        currentEntry?: { index: number };
        entries: () => { index: number; url?: string }[];
      };
    }).navigation;
    const previous = navigation?.entries().find((entry) => entry.index === (navigation.currentEntry?.index ?? 0) - 1);
    const sameSite = (previous?.url ?? (navigation ? "" : document.referrer)).startsWith(location.origin + "/");
    if (!event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && sameSite) {
      event.preventDefault();
      router.back();
    }
  }}><ArrowLeft size={16} /> Back</Link>;
}

export function SaveButton({ entry }: { entry: SavedTitle }) {
  const saved = useLibrary((state) => state.watchlist.some(({ href }) => href === entry.href));
  const toggle = useLibrary((state) => state.toggleSaved);
  return <button className="secondary-button" type="button" aria-pressed={saved} onClick={() => toggle(entry)}>
    <Bookmark size={16} aria-hidden="true" fill={saved ? "currentColor" : "none"} />
    {saved ? "In watchlist" : "Add to watchlist"}
  </button>;
}
