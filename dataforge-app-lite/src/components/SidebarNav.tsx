"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  ScanSearch,
  Megaphone,
  UserCog,
  UserCircle,
  LayoutGrid,
  CalendarDays,
  Bug,
  Settings,
  DollarSign,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { type Role } from "@/lib/rbac/roles";

interface NavChild {
  href: string;
  label: string;
  emoji: string;
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  children?: NavChild[];
}

interface NavSection {
  title?: string;
  items: NavItem[];
}

function buildSections(role: Role): NavSection[] {
  const scrapingChildren: NavChild[] = [
    { href: "/scraping?tab=domain",   label: "Scrape a Website",  emoji: "🌐" },
    { href: "/scraping?tab=google",   label: "Search by Google",  emoji: "🔍" },
  ];
  if (["boss", "admin"].includes(role)) {
    scrapingChildren.push({ href: "/scraping?tab=keywords", label: "Auto Keywords", emoji: "⚡" });
  }

  const scrapingItem: NavItem = {
    href: "/scraping",
    label: "Scraping",
    icon: ScanSearch,
    children: scrapingChildren,
  };

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
            { href: "/leads", label: "Leads", icon: Users },
            scrapingItem,
          ],
        },
        {
          title: "Marketing Department",
          items: [
            { href: "/marketing",                    label: "Marketing",   icon: Megaphone },
            { href: "/marketing/manage/badges",      label: "Badges",      icon: Settings  },
            { href: "/marketing/manage/tasks",       label: "Challenges",  icon: Settings  },
            { href: "/marketing/manage/commissions", label: "Commissions", icon: UserCog   },
            { href: "/admin/balloons",               label: "Balloon Pop", icon: Sparkles  },
          ],
        },
        {
          title: "Workspace",
          items: [
            { href: "/kanban",   label: "Kanban",      icon: LayoutGrid   },
            { href: "/calendar", label: "Calendar",    icon: CalendarDays },
            { href: "/reports",  label: "Reports",     icon: Settings     },
            { href: "/feedback", label: "Bug Reports", icon: Bug          },
          ],
        },
        {
          title: "Administration",
          items: [
            { href: "/admin/users", label: "Manage Users", icon: UserCog  },
            { href: "/settings",    label: "Settings",     icon: Settings },
          ],
        },
        {
          title: "Account",
          items: [
            { href: "/profile", label: "My Profile", icon: UserCircle },
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
            { href: "/leads", label: "Leads", icon: Users },
            scrapingItem,
          ],
        },
        {
          title: "Marketing Department",
          items: [
            { href: "/marketing",                     label: "Marketing",     icon: Megaphone    },
            { href: "/marketing/manage/badges",       label: "Badges",        icon: Settings     },
            { href: "/marketing/manage/tasks",        label: "Challenges",    icon: Settings     },
            { href: "/marketing/manage/commissions",  label: "Commissions",   icon: UserCog      },
            { href: "/admin/balloons",                label: "Balloon Pop",   icon: Sparkles     },
          ],
        },
        {
          title: "Workspace",
          items: [
            { href: "/kanban",   label: "Kanban",      icon: LayoutGrid   },
            { href: "/calendar", label: "Calendar",    icon: CalendarDays },
            { href: "/reports",  label: "Reports",     icon: Settings     },
            { href: "/feedback", label: "Bug Reports", icon: Bug          },
          ],
        },
        {
          title: "Administration",
          items: [
            { href: "/admin/users", label: "Manage Users", icon: UserCog },
          ],
        },
        {
          title: "Account",
          items: [
            { href: "/profile", label: "My Profile", icon: UserCircle },
          ],
        },
      ];

    case "team_lead":
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
            { href: "/marketing",              label: "Marketing",      icon: Megaphone    },
            { href: "/marketing/my-leads",     label: "My Leads",       icon: Users        },
            { href: "/my-commissions",         label: "My Commissions", icon: DollarSign   },
            { href: "/balloons",               label: "Balloon Pop",    icon: Sparkles     },
          ],
        },
        {
          title: "Workspace",
          items: [
            { href: "/kanban",   label: "Kanban",      icon: LayoutGrid   },
            { href: "/calendar", label: "Calendar",    icon: CalendarDays },
            { href: "/feedback", label: "Bug Reports", icon: Bug          },
          ],
        },
        {
          title: "Account",
          items: [
            { href: "/profile", label: "My Profile", icon: UserCircle },
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
            scrapingItem,
          ],
        },
        {
          title: "Workspace",
          items: [
            { href: "/kanban",   label: "Kanban",   icon: LayoutGrid },
            { href: "/calendar", label: "Calendar", icon: CalendarDays },
            { href: "/feedback", label: "Bug Reports", icon: Bug },
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

function NavLinkWithChildren({ href, label, icon: Icon, children }: NavItem) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isOnPage = pathname === href || pathname.startsWith(href + "/");
  const currentTab = searchParams.get("tab");

  return (
    <div className="flex flex-col">
      {/* Parent row — not clickable, just a label */}
      <div
        className={cn(
          "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm font-medium",
          isOnPage ? "text-blue-600" : "text-muted-foreground"
        )}
      >
        <Icon
          className={cn(
            "h-3.5 w-3.5 shrink-0",
            isOnPage ? "text-blue-600" : "text-muted-foreground"
          )}
        />
        {label}
      </div>

      {/* Sub-items — always visible */}
      <div className="ml-4 flex flex-col gap-0.5 border-l border-border pl-2.5">
        {children?.map((child) => {
          const childUrl = new URL(child.href, "http://x");
          const childTab = childUrl.searchParams.get("tab");
          const childPath = childUrl.pathname;
          const childActive = childTab
            ? isOnPage && currentTab === childTab
            : pathname === childPath;

          return (
            <Link
              key={child.href}
              href={child.href}
              className={cn(
                "flex items-center gap-2 rounded-md px-2 py-1 text-xs font-medium transition-all duration-150",
                childActive
                  ? "bg-blue-600/10 text-blue-600"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <span className="text-[11px]">{child.emoji}</span>
              {child.label}
              {childActive && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-blue-600" />
              )}
            </Link>
          );
        })}
      </div>
    </div>
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
          {section.items.map((item) =>
            item.children ? (
              <NavLinkWithChildren key={item.href} {...item} />
            ) : (
              <NavLink key={item.href} {...item} />
            )
          )}
        </div>
      ))}
    </nav>
  );
}
