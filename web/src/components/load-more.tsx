"use client";

import { useEffect, useRef } from "react";

export function LoadMore({ pending, load }: { pending: boolean; load: () => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  const loadRef = useRef(load);

  useEffect(() => { loadRef.current = load; }, [load]);
  useEffect(() => {
    if (pending || !ref.current || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        observer.disconnect();
        loadRef.current();
      }
    }, { rootMargin: "0px 0px 120px" });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [pending]);

  return <button ref={ref} type="button" className="secondary-button mt-6" disabled={pending} onClick={load}>
    {pending ? "Loading…" : "Load more"}
  </button>;
}
