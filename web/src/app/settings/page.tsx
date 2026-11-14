import type { Metadata } from "next";
import { PageHeading } from "@/components/page-heading";
import { SettingsEntry } from "@/components/settings-entry";

export const metadata: Metadata = { title: "Settings" };
export default function Page() {
  return <><PageHeading title="Settings" /><SettingsEntry /></>;
}
