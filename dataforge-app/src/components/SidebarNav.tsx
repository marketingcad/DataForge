"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  ScanSearch,
  Megaphone,
  UserCog,
  UserCircle,
  LayoutGrid,
  CalendarDays,
  Flag,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { type Role } from "@/lib/rbac/roles";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
}

interface NavSection {
  title?: string;
  items: NavItem[];
}

function buildSections(role: Role): NavSection[] {
  switch (role) {
    case "boss":
      return [
        {
          items: [
            { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
          ],
        },
        {
          title: "Leads Department",
          items: [
            { href: "/leads",    label: "Leads",    icon: Users },
            { href: "/scraping", label: "Scraping", icon: ScanSearch },
          ],
        },
        {
          title: "Marketing Department",
          items: [
            { href: "/marketing",                    label: "Marketing",    icon: Megaphone },
            { href: "/marketing/manage/badges",      label: "Badges",       icon: Settings },
            { href: "/marketing/manage/tasks",       label: "Challenges",   icon: Flag },
            { href: "/marketing/manage/commissions", label: "Commissions",  icon: UserCog },
          ],
        },
        {
          title: "Workspace",
          items: [
            { href: "/kanban",   label: "Kanban",   icon: LayoutGrid },
            { href: "/calendar", label: "Calendar", icon: CalendarDays },
            { href: "/feedback", label: "Reports",  icon: Flag },
          ],
        },
        {
          title: "Administration",
          items: [
            { href: "/admin/users", label: "Manage Users", icon: UserCog },
            { href: "/settings",    label: "Settings",     icon: Settings },
          ],
        },
      ];

    case "admin":
      return [
        {
          items: [
            { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
          ],
        },
        {
          title: "Leads Department",
          items: [
            { href: "/leads",    label: "Leads",    icon: Users },
            { href: "/scraping", label: "Scraping", icon: ScanSearch },
          ],
        },
        {
          title: "Marketing Department",
          items: [
            { href: "/marketing",                    label: "Marketing",   icon: Megaphone },
            { href: "/marketing/manage/badges",      label: "Badges",      icon: Settings },
            { href: "/marketing/manage/tasks",       label: "Challenges",  icon: Flag },
            { href: "/marketing/manage/commissions", label: "Commissions", icon: UserCog },
          ],
        },
        {
          title: "Workspace",
          items: [
            { href: "/kanban",   label: "Kanban",   icon: LayoutGrid },
            { href: "/calendar", label: "Calendar", icon: CalendarDays },
            { href: "/feedback", label: "Reports",  icon: Flag },
          ],
        },
        {
          title: "Administration",
          items: [
            { href: "/admin/users", label: "Manage Users", icon: UserCog },
          ],
        },
      ];

    case "sales_rep":
      return [
        {
          items: [
            { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
          ],
        },
        {
          title: "Marketing Department",
          items: [
            { href: "/marketing",         label: "Marketing",  icon: Megaphone },
            { href: "/marketing/profile", label: "My Profile", icon: UserCircle },
          ],
        },
        {
          title: "Workspace",
          items: [
            { href: "/kanban",   label: "Kanban",   icon: LayoutGrid },
            { href: "/calendar", label: "Calendar", icon: CalendarDays },
            // { href: "/chat",     label: "Chat",     icon: MessageSquare }, // hidden — WIP
            { href: "/feedback", label: "Reports",  icon: Flag },
          ],
        },
      ];

    case "lead_data_analyst":
      return [
        {
          items: [
            { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
          ],
        },
        {
          title: "Leads Department",
          items: [
            { href: "/leads",    label: "Leads",    icon: Users },
            { href: "/scraping", label: "Scraping", icon: ScanSearch },
          ],
        },
        {
          title: "Workspace",
          items: [
            { href: "/kanban",   label: "Kanban",   icon: LayoutGrid },
            { href: "/calendar", label: "Calendar", icon: CalendarDays },
            { href: "/feedback", label: "Reports",  icon: Flag },
          ],
        },
      ];

    case "lead_specialist":
    default:
      return [
        {
          items: [
            { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
            { href: "/leads",     label: "Leads",     icon: Users },
            { href: "/scraping",  label: "Scraping",  icon: ScanSearch },
          ],
        },
        {
          title: "Workspace",
          items: [
            { href: "/kanban",   label: "Kanban",   icon: LayoutGrid },
            { href: "/calendar", label: "Calendar", icon: CalendarDays },
            // { href: "/chat",     label: "Chat",     icon: MessageSquare }, // hidden — WIP
            { href: "/feedback", label: "Reports",  icon: Flag },
          ],
        },
      ];
  }
}

function NavLink({ href, label, icon: Icon }: NavItem) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(href + "/");

  return (
    <Link
      href={href}
      className={cn(
        "group flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-all duration-150",
        active
          ? "bg-blue-600/10 text-blue-600"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      )}
    >
      <Icon
        className={cn(
          "h-3.5 w-3.5 shrink-0 transition-colors",
          active ? "text-blue-600" : "text-muted-foreground group-hover:text-foreground"
        )}
      />
      {label}
      {active && (
        <span className="ml-auto h-1.5 w-1.5 rounded-full bg-blue-600" />
      )}
    </Link>
  );
}

export function SidebarNav({ role }: { role: Role }) {
  const effectiveRole: Role = role ?? "lead_specialist";
  const sections = buildSections(effectiveRole);

  return (
    <nav className="flex flex-col gap-4 px-3">
      {sections.map((section, i) => (
        <div key={i} className="flex flex-col gap-0.5">
          {section.title && (
            <p className="px-2.5 mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
              {section.title}
            </p>
          )}
          {section.items.map((item) => (
            <NavLink key={item.href} {...item} />
          ))}
        </div>
      ))}
    </nav>
  );
}
