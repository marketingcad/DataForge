"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import {
  Database,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  LayoutDashboard,
  Users,
  ScanSearch,
  Megaphone,
  Trophy,
  Medal,
  LayoutGrid,
  CalendarDays,
  BarChart2,
  UserCog,
  MonitorSmartphone,
  Settings,
  Bookmark,
  UserCircle,
  Bug,
  DollarSign,
  Globe,
  Wand2,
  Sparkles,
  NotebookPen,
  ScrollText,
  BookOpen,
  SquareArrowOutUpRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/rbac/roles";
import { isHrefDisabled } from "@/lib/features";
import { useTabs } from "@/contexts/TabsContext";

// Cookie that remembers whether the sidebar was collapsed, so the app reopens
// in the same state the user left it. A cookie (not localStorage) is used so
// the SERVER can read it and render the correct width on the very first paint —
// otherwise the sidebar would flash expanded, then animate to collapsed.
const SIDEBAR_COLLAPSED_KEY = "df-sidebar-collapsed";

type SubItem = { label: string; href: string };
type NavItem = { label: string; href?: string; icon: React.ElementType; sub?: SubItem[] };
type Section = { title?: string; items: NavItem[] };

function buildSections(role: Role): Section[] {
  const marketingSub: SubItem[] = [
    { label: "Today",      href: "/marketing?period=today"      },
    { label: "This Week",  href: "/marketing?period=week"       },
    { label: "This Month", href: "/marketing?period=month"      },
    { label: "Notes",      href: "/marketing/notes"             },
    { label: "Scripts",    href: "/marketing/scripts"           },
  ];
  const marketingAdminSub: SubItem[] = [
    { label: "Overview",   href: "/marketing"                   },
    { label: "Notes",      href: "/marketing/notes"             },
    { label: "Scripts",    href: "/marketing/scripts"           },
  ];
  const achievementsSub: SubItem[] = [
    { label: "Badges",       href: "/marketing/manage/badges"      },
    { label: "Challenges",   href: "/marketing/manage/tasks"       },
    { label: "Commissions",  href: "/marketing/manage/commissions" },
    { label: "Balloon Pop",  href: "/balloons"                     },
  ];
  const scrapingSub: SubItem[] = [
    { label: "Scrape a Website", href: "/scraping?tab=domain"   },
    ...( ["boss", "admin", "team_lead", "lead_specialist"].includes(role)
      ? [{ label: "Auto Keywords", href: "/scraping?tab=keywords" }]
      : []
    ),
  ];

  switch (role) {
    case "boss":
    case "admin":
      return [
        { items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard }] },
        {
          title: "Workspace",
          items: [
            { label: "Kanban",      href: "/kanban",   icon: LayoutGrid   },
            { label: "Calendar",    href: "/calendar", icon: CalendarDays },
            { label: "Reports",     href: "/reports",  icon: BarChart2    },
            { label: "Bug Reports", href: "/feedback", icon: Bug          },
          ],
        },
        {
          title: "Marketing",
          items: [
            { label: "Metrics", icon: Megaphone, sub: marketingAdminSub },
            { label: "Achievements", icon: Trophy,    sub: achievementsSub },
          ],
        },
        {
          title: "Leads",
          items: [
            { label: "Leads",    href: "/leads",   icon: Users      },
            { label: "Scraping", icon: ScanSearch, sub: scrapingSub },
          ],
        },
        {
          title: "Admin",
          items: [
            { label: "Users",        href: "/admin/users",    icon: UserCog  },
            ...(role === "boss" ? [{ label: "Fleet", href: "/admin/fleet", icon: MonitorSmartphone }] : []),
            // Settings lives under Account for every role — don't duplicate it here.
            { label: "How It Works", href: "/how-it-works",  icon: BookOpen },
          ],
        },
        {
          title: "Account",
          items: [
            { label: "My Profile",   href: "/profile",       icon: UserCircle },
            // How It Works is admin-only content — it's listed under Admin above.
            { label: "Settings",     href: "/settings",      icon: Settings   },
          ],
        },
      ];

    case "team_lead":
    case "sales_rep":
      return [
        { items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard }] },
        {
          title: "Marketing",
          items: [
            { label: "Marketing",      icon: Megaphone,  sub: marketingSub                      },
            { label: "My Leads",       href: "/marketing/my-leads",    icon: Bookmark            },
            { label: "My Commissions", href: "/my-commissions",        icon: DollarSign          },
            { label: "Balloon Pop",    href: "/balloons",              icon: Sparkles            },
          ],
        },
        {
          title: "Workspace",
          items: [
            { label: "Kanban",      href: "/kanban",   icon: LayoutGrid   },
            { label: "Calendar",    href: "/calendar", icon: CalendarDays },
            { label: "Reports",     href: "/reports",  icon: BarChart2    },
            { label: "Bug Reports", href: "/feedback", icon: Bug          },
          ],
        },
        {
          title: "Account",
          items: [
            { label: "My Profile",   href: "/profile",       icon: UserCircle },
            { label: "Settings",     href: "/settings",      icon: Settings   },
          ],
        },
      ];

    default:
      return [
        { items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard }] },
        {
          title: "Leads",
          items: [
            { label: "Leads",    href: "/leads",   icon: Users      },
            { label: "Scraping", icon: ScanSearch, sub: scrapingSub },
          ],
        },
        {
          title: "Workspace",
          items: [
            { label: "Kanban",      href: "/kanban",   icon: LayoutGrid   },
            { label: "Calendar",    href: "/calendar", icon: CalendarDays },
            { label: "Reports",     href: "/reports",  icon: BarChart2    },
            { label: "Bug Reports", href: "/feedback", icon: Bug          },
          ],
        },
        {
          title: "Account",
          items: [
            { label: "My Profile",   href: "/profile",       icon: UserCircle },
            { label: "Settings",     href: "/settings",      icon: Settings   },
          ],
        },
      ];
  }
}

function isActive(pathname: string, search: string, href: string) {
  const [base, query] = href.split("?");
  const normalizedBase = base === "/dashboard" ? "/dashboard" : base;
  if (base === "/dashboard" && pathname !== "/dashboard") return false;
  if (!pathname.startsWith(normalizedBase)) return false;
  if (query) {
    const hrefParams = new URLSearchParams(query);
    const currentParams = new URLSearchParams(search);
    for (const [k, v] of hrefParams.entries()) {
      if (currentParams.get(k) !== v) return false;
    }
  }
  return true;
}

function anySubActive(pathname: string, search: string, sub: SubItem[]) {
  return sub.some((s) => isActive(pathname, search, s.href));
}

const SUB_ICONS: Record<string, React.ElementType> = {
  "Yesterday":        CalendarDays,
  "This Week":        CalendarDays,
  "This Month":       CalendarDays,
  "Overview":         Megaphone,
  "Notes":            NotebookPen,
  "Scripts":          ScrollText,
  "Badges":           Medal,
  "Challenges":       Trophy,
  "Commissions":      DollarSign,
  "Balloon Pop":      Sparkles,
  "Scrape a Website": Globe,
  "Search by Google": ScanSearch,
  "Auto Keywords":    Wand2,
};

// Hover-revealed "open in new tab" affordance shown on each nav row.
function OpenInTab({ href }: { href: string }) {
  const { openTab } = useTabs();
  return (
    <button
      type="button"
      tabIndex={-1}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); openTab(href); }}
      title="Open in new tab"
      className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground opacity-0 transition-all hover:bg-sidebar-accent hover:text-foreground group-hover/nav:opacity-100 active:scale-90"
    >
      <SquareArrowOutUpRight className="h-2.5 w-2.5" />
    </button>
  );
}

function CollapsibleItem({
  item,
  pathname,
  search,
  collapsed,
  defaultOpen = false,
}: {
  item: NavItem;
  pathname: string;
  search: string;
  collapsed: boolean;
  defaultOpen?: boolean;
}) {
  const subActive = anySubActive(pathname, search, item.sub!);
  const [open, setOpen] = useState(defaultOpen || subActive);
  const Icon = item.icon;
  const { openTab } = useTabs();

  return (
    <li>
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left",
          subActive
            ? "bg-sidebar-accent text-foreground font-semibold"
            : "text-foreground hover:bg-sidebar-accent"
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        {!collapsed && (
          <>
            <span className="flex-1 truncate">{item.label}</span>
            <ChevronRight className={cn("h-3.5 w-3.5 shrink-0 transition-transform duration-200", open && "rotate-90")} />
          </>
        )}
      </button>

      {!collapsed && open && (
        <ul className="mt-0.5 ml-3 border-l border-border/100 space-y-0.5">
          {item.sub!.map((s) => {
            const SubIcon = SUB_ICONS[s.label];
            const active = isActive(pathname, search, s.href);
            return (
              <li key={s.href} className="group/nav relative">
                <Link
                  href={s.href}
                  onDoubleClick={(e) => { e.preventDefault(); openTab(s.href); }}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 pr-8 rounded-lg text-xs font-medium transition-colors",
                    active
                      ? "bg-sidebar-accent text-foreground font-semibold"
                      : "text-foreground/70 hover:bg-sidebar-accent hover:text-foreground"
                  )}
                >
                  {SubIcon && <SubIcon className="h-3.5 w-3.5 shrink-0" />}
                  {s.label}
                </Link>
                <OpenInTab href={s.href} />
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}

export function AppSidebar({
  role,
  disabledFeatures = [],
  initialCollapsed = false,
}: {
  role: Role;
  disabledFeatures?: string[];
  initialCollapsed?: boolean;
}) {
  const pathname     = usePathname();
  const searchParams = useSearchParams();
  const search       = searchParams.toString();
  const { openTab }  = useTabs();

  // Hide nav items/subitems for features the boss has disabled.
  const sections = buildSections(role)
    .map((section) => ({
      ...section,
      items: section.items
        .map((item) => {
          if (item.sub) {
            const sub = item.sub.filter((s) => !isHrefDisabled(s.href, disabledFeatures));
            return sub.length ? { ...item, sub } : null;
          }
          if (item.href && isHrefDisabled(item.href, disabledFeatures)) return null;
          return item;
        })
        .filter((i): i is NavItem => i !== null),
    }))
    .filter((section) => section.items.length > 0);
  // Seeded from the server-read cookie so the FIRST paint already has the right
  // width — no flash of the expanded sidebar animating shut.
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [mounted, setMounted]     = useState(false);
  useEffect(() => setMounted(true), []);

  // Persist every change to the cookie so the next launch opens in the same
  // state (read by the server layout on the next render).
  useEffect(() => {
    if (!mounted) return;
    document.cookie = `${SIDEBAR_COLLAPSED_KEY}=${collapsed ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
  }, [collapsed, mounted]);

  const activePath   = mounted ? pathname : "";
  const activeSearch = mounted ? search   : "";

  return (

    <aside
      className={cn(
        "hidden md:flex flex-col border-r bg-sidebar text-foreground shrink-0 transition-[width] duration-200",
        collapsed ? "w-14" : "w-56"
      )}
    >

      {/* Brand */}
      <div className={cn("flex h-14 items-center border-b shrink-0 gap-2.5", collapsed ? "justify-center px-3" : "px-4 justify-between")}>
        <Link href="/dashboard" className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-600 shrink-0">
            <Database className="h-4 w-4 text-white" />
          </div>
          {!collapsed && <span className="font-bold text-base tracking-tight truncate">DataForge</span>}
        </Link>
        {!collapsed && (
          <button onClick={() => setCollapsed(true)} className="shrink-0 opacity-100 hover:opacity-40 transition-opacity" title="Collapse sidebar">
            <PanelLeftClose className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto py-3 space-y-4">
        {sections.map((section, si) => (
          <div key={si}>
            {section.title && !collapsed && (
              <p className="px-4 mb-1 text-[10px] font-bold uppercase tracking-widest opacity-40">
                {section.title}
              </p>
            )}
            <ul className={cn("space-y-0.5", collapsed ? "px-1.5" : "px-2")}>
              {section.items.map((item) => {
                const Icon = item.icon;
                return item.sub ? (
                  <CollapsibleItem
                    key={item.label}
                    item={item}
                    pathname={activePath}
                    search={activeSearch}
                    collapsed={collapsed}
                    defaultOpen={true}
                  />
                ) : (
                  <li key={item.href} className="group/nav relative">
                    <Link
                      href={item.href!}
                      title={collapsed ? item.label : undefined}
                      onDoubleClick={(e) => { e.preventDefault(); openTab(item.href!); }}
                      className={cn(
                        "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                        collapsed ? "justify-center px-0" : "pr-8",
                        isActive(activePath, activeSearch, item.href!)
                          ? "bg-sidebar-accent text-foreground font-semibold"
                          : "text-foreground hover:bg-sidebar-accent"
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </Link>
                    {!collapsed && <OpenInTab href={item.href!} />}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className={cn("border-t py-3 flex items-center", collapsed ? "justify-center px-2" : "px-4 justify-between")}>
        {!collapsed && <p className="text-[10px]">DataForge v1.0</p>}
        <button
          onClick={() => setCollapsed((c) => !c)} 
          className="opacity-100 hover:opacity-40 transition-opacity"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>
    </aside>
  );
}

