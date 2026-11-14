"use client";

import { useRouter } from "next/navigation";
import { useLibrary } from "@/lib/library";

export function SearchForm({ initial = "" }: { initial?: string }) {
  const router = useRouter();
  return <form action="/search" className="mb-6 flex max-w-xl gap-2" onSubmit={(event) => {
    event.preventDefault();
    const q = String(new FormData(event.currentTarget).get("q") ?? "").trim();
    if (q.length < 2) return;
    useLibrary.getState().addSearch(q);
    router.push("/search?" + new URLSearchParams({ q }));
  }}>
    <input className="field min-w-0 flex-1" name="q" type="search" aria-label="Title"
      placeholder="Movie or series" minLength={2} maxLength={120} defaultValue={initial} required />
    <button className="primary-button" type="submit">Search</button>
  </form>;
}
