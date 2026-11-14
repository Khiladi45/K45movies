import type { Metadata } from "next";
import { SearchResults } from "@/components/catalog-pages";
import { PageHeading } from "@/components/page-heading";
import { SearchForm } from "@/components/search-form";

export const metadata: Metadata = { title: "Search" };

export default async function Search({ searchParams }: PageProps<"/search">) {
  const { q } = await searchParams;
  const query = typeof q === "string" ? q.trim().slice(0, 120) : "";
  return <>
    <PageHeading title="Search" />
    <SearchForm key={query} initial={query} />
    <SearchResults q={query} />
  </>;
}
