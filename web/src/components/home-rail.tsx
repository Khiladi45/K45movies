"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { CardGrid, CatalogSkeleton, Rail, type Card } from "./catalog-ui";

export function HomeRailViewport({ children }: { children: ReactNode }) {
  const frame = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  useEffect(() => {
    const row = frame.current?.querySelector<HTMLElement>(".poster-rail");
    if (!row) return;
    const update = () => {
      const left = row.scrollLeft > 1;
      const right = row.scrollLeft + row.clientWidth < row.scrollWidth - 2;
      setEdges((current) => current.left === left && current.right === right ? current : { left, right });
    };
    const observer = new ResizeObserver(update);
    observer.observe(row);
    for (const item of row.children) observer.observe(item);
    row.addEventListener("scroll", update, { passive: true });
    update();
    return () => { observer.disconnect(); row.removeEventListener("scroll", update); };
  }, [children]);

  function advance(direction: number) {
    const row = frame.current?.querySelector<HTMLElement>(".poster-rail");
    row?.scrollBy({ left: direction * row.clientWidth * 0.85,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }

  return <div ref={frame} className="home-rail-view" data-left={edges.left} data-right={edges.right}>
    {children}
    {edges.left && <button className="home-rail-arrow home-rail-back" type="button" aria-label="Scroll titles backward" onClick={() => advance(-1)}><ChevronLeft aria-hidden="true" /></button>}
    {edges.right && <button className="home-rail-arrow home-rail-next" type="button" aria-label="Scroll titles forward" onClick={() => advance(1)}><ChevronRight aria-hidden="true" /></button>}
  </div>;
}

export function HomeShelf({ title, href, wide = false, items, pending, children }: {
  title: string; href?: string; wide?: boolean; items?: Card[]; pending?: boolean; children?: ReactNode;
}) {
  return <div className="home-shelf" data-wide={wide}>
    <Rail title={title} href={href}>
      {children ?? (pending ? <CatalogSkeleton rail wide={wide} /> :
        <HomeRailViewport><CardGrid rail wide={wide} items={items ?? []} /></HomeRailViewport>)}
    </Rail>
  </div>;
}
