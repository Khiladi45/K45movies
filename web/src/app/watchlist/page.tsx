import Link from "next/link";
import type { Metadata } from "next";
import { PageHeading } from "@/components/page-heading";

export const metadata: Metadata = { title: "Watchlist" };

export default function Watchlist() {
  return (
    <>
      <PageHeading title="Watchlist" />
      <div className="empty-panel">
        <p>Your watchlist is empty.</p>
        <Link href="/" className="primary-button mt-4">Browse titles</Link>
      </div>
    </>
  );
}
