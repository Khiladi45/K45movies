import type { Metadata } from "next";
import { LayoutChoice } from "@/components/layout-choice";
import { PageHeading } from "@/components/page-heading";

export const metadata: Metadata = { title: "Settings" };

export default function Settings() {
  return (
    <>
      <PageHeading title="Settings" />
      <LayoutChoice />
    </>
  );
}
