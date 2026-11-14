import type { Metadata } from "next";
import { PageHeading } from "@/components/page-heading";

export const metadata: Metadata = { title: "Search" };

export default async function Search({ searchParams }: PageProps<"/search">) {
  const { q } = await searchParams;
  const query = typeof q === "string" ? q.trim().slice(0, 120) : "";

  return (
    <>
      <PageHeading title="Search" />
      <form action="/search" className="mb-6 flex max-w-xl gap-2">
        <input className="field min-w-0 flex-1" name="q" type="search" aria-label="Title"
          placeholder="Movie or series" maxLength={120} defaultValue={query} required />
        <button className="primary-button" type="submit">Search</button>
      </form>
      {query && <p className="empty-panel">Catalog search will be available when the data source is connected.</p>}
    </>
  );
}
