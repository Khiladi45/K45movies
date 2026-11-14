import type { Metadata } from "next";
import { PageHeading } from "@/components/page-heading";

export const metadata: Metadata = { title: "Providers" };

export default function Providers() {
  return (
    <>
      <PageHeading title="Providers" />
      <p className="empty-panel">Provider management will be available when the catalog is connected.</p>
    </>
  );
}
