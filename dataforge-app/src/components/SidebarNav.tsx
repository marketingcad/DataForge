"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, ScanSearch } from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/leads",     label: "Leads",     icon: Users },
  { href: "/scraping",  label: "Scraping",  icon: ScanSearch },
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-0.5 px-3">
      {links.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "group flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all duration-150",
              active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            <Icon className={cn(
              "h-3.5 w-3.5 shrink-0 transition-colors",
              active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
            )} />
            {label}
            {active && (
              <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
