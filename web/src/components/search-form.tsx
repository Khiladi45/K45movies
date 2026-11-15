"use client";

import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { useAppearance } from "@/lib/appearance";
import { useLibrary } from "@/lib/library";

export function SearchForm({ initial = "" }: { initial?: string }) {
  const router = useRouter();
  const layout = useAppearance((state) => state.layout);
  return <form action="/search" className="search-form" onSubmit={(event) => {
    event.preventDefault();
    const q = String(new FormData(event.currentTarget).get("q") ?? "").trim();
    if (q.length < 2) return;
    useLibrary.getState().addSearch(q);
    router.push("/search?" + new URLSearchParams({ q }));
  }}>
    <Search size={19} aria-hidden="true" className="ml-2 shrink-0 text-muted" />
    <input className="field min-w-0 flex-1" name="q" type="search" aria-label="Title"
      placeholder={layout === "youtube" ? "Search YouTube videos" : "Search movies and series"} minLength={2} maxLength={120} defaultValue={initial} required />
    <button className="primary-button" type="submit">Search</button>
  </form>;
}
