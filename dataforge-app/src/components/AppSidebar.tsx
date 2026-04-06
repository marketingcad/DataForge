"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
    { label: "Yesterday", href: "/marketing?period=yesterday" },
    { label: "This Week", href: "/marketing?period=week" },
    { label: "This Month", href: "/marketing?period=month" },
  ];

  const achievementsSub: SubItem[] = [
    { label: "Badges", href: "/marketing/manage/badges" },
    { label: "Challenges", href: "/marketing/manage/tasks" },
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
            { label: "Leads", href: "/leads", emoji: "👥" },
            { label: "Scraping", href: "/scraping", emoji: "🔍" },
          ],
        },
        {
          title: "Marketing",
          items: [
            { label: "Marketing", href: "/marketing", emoji: "📣", sub: marketingSub },
            { label: "Achievements", emoji: "🏅", sub: achievementsSub },
          ],
        },
        {
          title: "Workspace",
          items: [
            { label: "Kanban", href: "/kanban", emoji: "📋" },
            { label: "Calendar", href: "/calendar", emoji: "📅" },
            { label: "Reports", href: "/reports", emoji: "📊" },
          ],
        },
        {
          title: "Administration",
          items: [
            { label: "Manage Users", href: "/admin/users", emoji: "👤" },
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
            { label: "Marketing", href: "/marketing", emoji: "📣", sub: marketingSub },
            { label: "My Leads", href: "/marketing/my-leads", emoji: "📋" },
            { label: "My Profile", href: "/marketing/profile", emoji: "👤" },
          ],
        },
        {
          title: "Workspace",
          items: [
            { label: "Kanban", href: "/kanban", emoji: "📌" },
            { label: "Calendar", href: "/calendar", emoji: "📅" },
            { label: "Reports", href: "/reports", emoji: "📊" },
          ],
        },
      ];
    default:
      return [
        { items: [{ label: "Dashboard", href: "/dashboard", emoji: "🏠" }] },
        {
          title: "Leads",
          items: [
            { label: "Leads", href: "/leads", emoji: "👥" },
            { label: "Scraping", href: "/scraping", emoji: "🔍" },
          ],
        },
        {
          title: "Workspace",
          items: [
            { label: "Kanban", href: "/kanban", emoji: "📌" },
            { label: "Calendar", href: "/calendar", emoji: "📅" },
            { label: "Reports", href: "/reports", emoji: "📊" },
          ],
        },
      ];
  }
}

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname.startsWith(href.split("?")[0]);
}

/* ── collapsible nav item ─────────────────────────────────────────── */

function CollapsibleNavItem({ item, pathname }: { item: NavItem; pathname: string }) {
  const subActive = item.sub ? item.sub.some((s) => isActive(pathname, s.href)) : false;
  const [open, setOpen] = useState(subActive);

  return (
    <SidebarMenuItem>
      {/* @ts-ignore - Bypass internal sidebar tooltip errors */}
      <SidebarMenuButton
        {...({ isActive: subActive } as any)}
        onClick={() => setOpen((o) => !o)}
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

      {open && item.sub && (
        <SidebarMenuSub>
          {item.sub.map((s) => {
            const active = isActive(pathname, s.href);
            return (
              <SidebarMenuSubItem key={s.href}>
                {/* @ts-ignore - Bypass asChild error */}
                <SidebarMenuSubButton {...({ asChild: true } as any)}>
                  <Link
                    href={s.href}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none",
                      active 
                        ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" 
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                    )}
                  >
                    {s.label}
                  </Link>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            );
          })}
        </SidebarMenuSub>
      )}
    </SidebarMenuItem>
  );
}

/* ── main sidebar ─────────────────────────────────────────────────── */

export function AppSidebar({ role }: { role: Role }) {
  const pathname = usePathname();
  const sections = buildSections(role);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            {/* @ts-ignore */}
            <SidebarMenuButton size="lg" {...({ asChild: true } as any)}>
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

      <SidebarContent>
        {sections.map((section, si) => (
          <SidebarGroup key={si}>
            {section.title && <SidebarGroupLabel>{section.title}</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) =>
                  item.sub ? (
                    <CollapsibleNavItem key={item.label} item={item} pathname={pathname} />
                  ) : (
                    <SidebarMenuItem key={item.href}>
                      {/* @ts-ignore */}
                      <SidebarMenuButton
                        {...({ 
                          asChild: true, 
                          isActive: isActive(pathname, item.href!) 
                        } as any)}
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

      <SidebarFooter>
        <p className="px-2 py-1 text-[10px] text-muted-foreground/40 text-center">
          DataForge v1.0
        </p>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}