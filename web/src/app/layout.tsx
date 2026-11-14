import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SiteShell } from "@/components/site-shell";
import { CatalogContext } from "@/components/catalog-context";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "K45movies", template: "%s | K45movies" },
  description: "Browse movies and series by provider or title.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <CatalogContext><SiteShell>{children}</SiteShell></CatalogContext>
      </body>
    </html>
  );
}
