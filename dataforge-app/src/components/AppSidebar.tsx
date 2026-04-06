"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Database, ChevronRight, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/rbac/roles";

/* ── types ─────────────────────────────────────────────────────── */
type SubItem = { label: string; href: string };
type NavItem = {
  label: string;
  href?: string;
  emoji: string;
  sub?: SubItem[];
};
type Section = { title?: string; items: NavItem[] };

/* ── nav config ─────────────────────────────────────────────────── */
function buildSections(role: Role): Section[] {
  const marketingSub: SubItem[] = [
    { label: "Yesterday",  href: "/marketing?period=yesterday" },
    { label: "This Week",  href: "/marketing?period=week"      },
    { label: "This Month", href: "/marketing?period=month"     },
  ];
  const achievementsSub: SubItem[] = [
    { label: "Badges",      href: "/marketing/manage/badges"      },
    { label: "Challenges",  href: "/marketing/manage/tasks"       },
    { label: "Commissions", href: "/marketing/manage/commissions" },
  ];

  switch (role) {
    case "boss":
    case "admin":
      return [
        { items: [{ label: "Dashboard", href: "/dashboard", emoji: "🏠" }] },
        {
          title: "Leads",
          items: [
            { label: "Leads",    href: "/leads",    emoji: "👥" },
            { label: "Scraping", href: "/scraping", emoji: "🔍" },
          ],
        },
        {
          title: "Marketing",
          items: [
            { label: "Marketing",    emoji: "📣", sub: marketingSub },
            { label: "Achievements", emoji: "🏅", sub: achievementsSub },
          ],
        },
        {
          title: "Workspace",
          items: [
            { label: "Kanban",   href: "/kanban",   emoji: "📌" },
            { label: "Calendar", href: "/calendar", emoji: "📅" },
            { label: "Reports",  href: "/reports",  emoji: "📊" },
          ],
        },
        {
          title: "Admin",
          items: [
            { label: "Users",    href: "/admin/users", emoji: "👤" },
            ...(role === "boss" ? [{ label: "Settings", href: "/settings", emoji: "⚙️" }] : []),
          ],
        },
      ];

    case "sales_rep":
      return [
        { items: [{ label: "Dashboard", href: "/dashboard", emoji: "🏠" }] },
        {
          title: "Marketing",
          items: [
            { label: "Marketing",   emoji: "📣", sub: marketingSub },
            { label: "My Leads",    href: "/marketing/my-leads",  emoji: "📋" },
            { label: "My Profile",  href: "/marketing/profile",   emoji: "👤" },
          ],
        },
        {
          title: "Workspace",
          items: [
            { label: "Kanban",   href: "/kanban",   emoji: "📌" },
            { label: "Calendar", href: "/calendar", emoji: "📅" },
            { label: "Reports",  href: "/reports",  emoji: "📊" },
          ],
        },
      ];

    default: // lead_specialist, lead_data_analyst
      return [
        { items: [{ label: "Dashboard", href: "/dashboard", emoji: "🏠" }] },
        {
          title: "Leads",
          items: [
            { label: "Leads",    href: "/leads",    emoji: "👥" },
            { label: "Scraping", href: "/scraping", emoji: "🔍" },
          ],
        },
        {
          title: "Workspace",
          items: [
            { label: "Kanban",   href: "/kanban",   emoji: "📌" },
            { label: "Calendar", href: "/calendar", emoji: "📅" },
            { label: "Reports",  href: "/reports",  emoji: "📊" },
          ],
        },
      ];
  }
}

/* ── helpers ────────────────────────────────────────────────────── */
function isActive(pathname: string, href: string) {
  const base = href.split("?")[0];
  if (base === "/dashboard") return pathname === "/dashboard";
  return pathname.startsWith(base);
}
function anySubActive(pathname: string, sub: SubItem[]) {
  return sub.some((s) => isActive(pathname, s.href));
}

/* ── collapsible item ───────────────────────────────────────────── */
function CollapsibleItem({
  item,
  pathname,
  collapsed,
}: {
  item: NavItem;
  pathname: string;
  collapsed: boolean;
}) {
  const subActive = anySubActive(pathname, item.sub!);
  const [open, setOpen] = useState(subActive);

  return (
    <li>
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left",
          subActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
        )}
      >
        <span className="text-base shrink-0">{item.emoji}</span>
        {!collapsed && (
          <>
            <span className="flex-1 truncate">{item.label}</span>
            <ChevronRight
              className={cn(
                "h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform duration-200",
                open && "rotate-90"
              )}
            />
          </>
        )}
      </button>

      {!collapsed && open && (
        <ul className="mt-0.5 ml-3 pl-3 border-l border-sidebar-border/50 space-y-0.5">
          {item.sub!.map((s) => (
            <li key={s.href}>
              <Link
                href={s.href}
                className={cn(
                  "block px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                  isActive(pathname, s.href)
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )}
              >
                {s.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

/* ── main sidebar ───────────────────────────────────────────────── */
export function AppSidebar({ role }: { role: Role }) {
  const pathname = usePathname();
  const sections = buildSections(role);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col border-r bg-sidebar text-sidebar-foreground shrink-0 transition-[width] duration-200",
        collapsed ? "w-14" : "w-56"
      )}
    >
      {/* Brand */}
      <div
        className={cn(
          "flex h-14 items-center border-b shrink-0 px-3 gap-2.5",
          collapsed ? "justify-center" : "px-4 justify-between"
        )}
      >
        <Link href="/dashboard" className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-600 shrink-0">
            <Database className="h-4 w-4 text-white" />
          </div>
          {!collapsed && (
            <span className="font-bold text-base tracking-tight truncate">DataForge</span>
          )}
        </Link>
        {!collapsed && (
          <button
            onClick={() => setCollapsed(true)}
            className="shrink-0 text-sidebar-foreground/40 hover:text-sidebar-foreground transition-colors"
            title="Collapse sidebar"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto py-3 space-y-4">
        {sections.map((section, si) => (
          <div key={si}>
            {section.title && !collapsed && (
              <p className="px-4 mb-1 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/30">
                {section.title}
              </p>
            )}
            <ul className={cn("space-y-0.5", collapsed ? "px-1.5" : "px-2")}>
              {section.items.map((item) =>
                item.sub ? (
                  <CollapsibleItem
                    key={item.label}
                    item={item}
                    pathname={pathname}
                    collapsed={collapsed}
                  />
                ) : (
                  <li key={item.href}>
                    <Link
                      href={item.href!}
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                        collapsed && "justify-center px-0",
                        isActive(pathname, item.href!)
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                      )}
                    >
                      <span className="text-base shrink-0">{item.emoji}</span>
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </Link>
                  </li>
                )
              )}
            </ul>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className={cn("border-t py-3 flex items-center", collapsed ? "justify-center px-2" : "px-4 justify-between")}>
        {!collapsed && (
          <p className="text-[10px] text-sidebar-foreground/30">DataForge v1.0</p>
        )}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="text-sidebar-foreground/30 hover:text-sidebar-foreground transition-colors"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>
    </aside>
  );
}
