import type { Metadata } from "next";
import { PageHeading } from "@/components/page-heading";
import { BackLink } from "@/components/catalog-ui";
import { SettingsAppearance } from "@/components/settings-appearance";

export const metadata: Metadata = { title: "Appearance" };
export default function Page() {
  return <><BackLink href="/settings" /><PageHeading title="Appearance" /><SettingsAppearance /></>;
}
