"use client";

import { type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Bookmark, House, PanelLeft, Puzzle, Search, Settings } from "lucide-react";
import { useAppearance } from "@/lib/appearance";
import { SearchDialog } from "./search-dialog";

const navigation = [
  { href: "/", label: "Home", icon: House },
  { href: "/watchlist", label: "Watchlist", icon: Bookmark },
  { href: "/providers", label: "Providers", icon: Puzzle },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function SiteShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const collapsed = useAppearance((state) => state.sidebarCollapsed);
  const toggleSidebar = useAppearance((state) => state.toggleSidebar);

  return (
    <div className="site-shell" data-collapsed={collapsed}>
      <a className="skip-link" href="#main">Skip to content</a>
      <header className="site-header">
        <button type="button" className="icon-button sidebar-toggle" onClick={toggleSidebar}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-controls="primary-nav"
          aria-expanded={!collapsed}>
          <PanelLeft size={20} aria-hidden="true" />
        </button>
        <Link href="/" className="brand">
          <Image src="/brand.png" alt="" width={32} height={32} priority />
          <span>K45movies</span>
        </Link>
        <SearchDialog>
          <Search size={17} aria-hidden="true" />
          <span>Search titles</span>
          <kbd>Ctrl K</kbd>
        </SearchDialog>
      </header>
      <nav className="site-nav" id="primary-nav" aria-label="Primary">
        {navigation.map(({ href, label, icon: Icon }) => {
          const current = pathname === href || (href !== "/" && pathname.startsWith(href + "/"));
          return (
            <Link key={href} href={href} aria-current={current ? "page" : undefined}
              aria-label={label} title={collapsed ? label : undefined}>
              <Icon size={20} aria-hidden="true" />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="site-content">
        <main id="main" tabIndex={-1}>{children}</main>
        <footer className="site-footer">
          <a href="https://github.com/Khiladi45/K45movies/tree/feat/website">Source</a>
        </footer>
      </div>
    </div>
  );
}
