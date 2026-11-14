import type { Metadata } from "next";
import { PageHeading } from "@/components/page-heading";
import { BackLink } from "@/components/catalog-ui";
import { SettingsPreferences } from "@/components/settings-preferences";

export const metadata: Metadata = { title: "Playback preferences" };
export default function Page() {
  return <><BackLink href="/settings" /><PageHeading title="Playback preferences" /><SettingsPreferences /></>;
}
