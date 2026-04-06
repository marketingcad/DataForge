"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Database, ChevronRight } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/rbac/roles";

/* ── nav structure ───────────────────────────────────────────────── */

type SubItem = { label: string; href: string };
type NavItem = {
  label: string;
  href?: string;
  emoji: string;
  sub?: SubItem[];
};
type Section = { title?: string; items: NavItem[] };

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
        {
          items: [
            { label: "Dashboard", href: "/dashboard", emoji: "🏠" },
          ],
        },
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
            {
              label: "Marketing",
              href: "/marketing",
              emoji: "📣",
              sub: marketingSub,
            },
            {
              label: "Achievements",
              emoji: "🏅",
              sub: achievementsSub,
            },
          ],
        },
        {
          title: "Workspace",
          items: [
            { label: "Kanban",   href: "/kanban",   emoji: "📋" },
            { label: "Calendar", href: "/calendar", emoji: "📅" },
            { label: "Reports",  href: "/reports",  emoji: "📊" },
          ],
        },
        {
          title: "Administration",
          items: [
            { label: "Manage Users", href: "/admin/users", emoji: "👤" },
            ...(role === "boss"
              ? [{ label: "Settings", href: "/settings", emoji: "⚙️" }]
              : []),
          ],
        },
      ];

    case "sales_rep":
      return [
        {
          items: [
            { label: "Dashboard", href: "/dashboard", emoji: "🏠" },
          ],
        },
        {
          title: "Marketing",
          items: [
            {
              label: "Marketing",
              href: "/marketing",
              emoji: "📣",
              sub: marketingSub,
            },
            { label: "My Leads",   href: "/marketing/my-leads",  emoji: "📋" },
            { label: "My Profile", href: "/marketing/profile",   emoji: "👤" },
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

    case "lead_specialist":
    case "lead_data_analyst":
    default:
      return [
        {
          items: [
            { label: "Dashboard", href: "/dashboard", emoji: "🏠" },
          ],
        },
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

/* ── helpers ──────────────────────────────────────────────────────── */

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname.startsWith(href.split("?")[0]);
}

function anySubActive(pathname: string, sub: SubItem[]) {
  return sub.some((s) => isActive(pathname, s.href));
}

/* ── collapsible nav item ─────────────────────────────────────────── */

function CollapsibleNavItem({ item, pathname }: { item: NavItem; pathname: string }) {
  const subActive = item.sub ? anySubActive(pathname, item.sub) : false;
  const [open, setOpen] = useState(subActive);

  return (
    <SidebarMenuItem>
      {/* Parent row — click to toggle sub-menu */}
      <SidebarMenuButton
        tooltip={item.label}
        isActive={subActive}
        onClick={() => setOpen((o) => !o)}
        // If item has its own href, navigate on click too — handled via link inside
      >
        <span>{item.emoji}</span>
        <span>{item.label}</span>
        <ChevronRight
          className={cn(
            "ml-auto h-3.5 w-3.5 text-muted-foreground transition-transform duration-200",
            open && "rotate-90"
          )}
        />
      </SidebarMenuButton>

      {/* Sub-items */}
      {open && (
        <SidebarMenuSub>
          {item.sub!.map((s) => (
            <SidebarMenuSubItem key={s.href}>
              <SidebarMenuSubButton asChild isActive={isActive(pathname, s.href)}>
                <Link href={s.href}>{s.label}</Link>
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
          ))}
        </SidebarMenuSub>
      )}
    </SidebarMenuItem>
  );
}

/* ── main sidebar ─────────────────────────────────────────────────── */

export function AppSidebar({ role }: { role: Role }) {
  const pathname  = usePathname();
  const sections  = buildSections(role);

  return (
    <Sidebar collapsible="icon">
      {/* Brand */}
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/dashboard">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-600 shrink-0">
                  <Database className="h-4 w-4 text-white" />
                </div>
                <span className="font-bold text-base tracking-tight">DataForge</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* Navigation */}
      <SidebarContent>
        {sections.map((section, si) => (
          <SidebarGroup key={si}>
            {section.title && (
              <SidebarGroupLabel>{section.title}</SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) =>
                  item.sub ? (
                    <CollapsibleNavItem
                      key={item.label}
                      item={item}
                      pathname={pathname}
                    />
                  ) : (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        tooltip={item.label}
                        isActive={isActive(pathname, item.href!)}
                      >
                        <Link href={item.href!}>
                          <span>{item.emoji}</span>
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter>
        <p className="px-2 py-1 text-[10px] text-muted-foreground/40 text-center">
          DataForge v1.0
        </p>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
