import type { Metadata } from "next";
import { PageHeading } from "@/components/page-heading";
import { ProviderSettings } from "@/components/provider-settings";

export const metadata: Metadata = { title: "Providers" };
export default function Page() {
  return <><PageHeading title="Providers" /><ProviderSettings /></>;
}
