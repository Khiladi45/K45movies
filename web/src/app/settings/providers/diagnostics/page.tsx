import type { Metadata } from "next";
import { PageHeading } from "@/components/page-heading";
import { BackLink } from "@/components/catalog-ui";
import { ProviderDiagnostics } from "@/components/provider-diagnostics";

export const metadata: Metadata = { title: "Provider diagnostics" };
export default function Page() {
  return <><BackLink href="/settings" /><PageHeading title="Provider diagnostics" /><ProviderDiagnostics /></>;
}
