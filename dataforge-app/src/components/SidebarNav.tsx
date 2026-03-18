"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, ScanSearch, Megaphone, UserCog } from "lucide-react";
import { cn } from "@/lib/utils";
import { canAccessDepartment, canManageUsers, type Role } from "@/lib/rbac/roles";

const ALL_LINKS = [
  { href: "/dashboard",   label: "Dashboard", icon: LayoutDashboard, dept: null,       adminOnly: false },
  { href: "/leads",       label: "Leads",     icon: Users,           dept: "leads",    adminOnly: false },
  { href: "/scraping",    label: "Scraping",  icon: ScanSearch,      dept: "leads",    adminOnly: false },
  { href: "/marketing",   label: "Marketing", icon: Megaphone,       dept: "marketing",adminOnly: false },
  { href: "/admin/users", label: "Users",     icon: UserCog,         dept: null,       adminOnly: true  },
] as const;

export function SidebarNav({ role }: { role: Role }) {
  const pathname = usePathname();

  const links = ALL_LINKS.filter((link) => {
    if (link.adminOnly && !canManageUsers(role)) return false;
    if (link.dept && !canAccessDepartment(role, link.dept as "leads" | "marketing")) return false;
    return true;
  });

  return (
    <nav className="flex flex-col gap-0.5 px-3">
      {links.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "group flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-all duration-150",
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
