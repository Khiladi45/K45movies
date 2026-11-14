import type { Metadata } from "next";
import { Watchlist } from "@/components/catalog-pages";
import { PageHeading } from "@/components/page-heading";

export const metadata: Metadata = { title: "Watchlist" };

export default function Page() {
  return <><PageHeading title="Watchlist" /><Watchlist /></>;
}
