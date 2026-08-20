"use client";

import {
  createContext, useContext, useCallback, useEffect, useMemo, useState,
} from "react";
import { usePathname, useSearchParams, useRouter } from "next/navigation";

// ─── Types ────────────────────────────────────────────────────────────────────
export type Crumb = { path: string; label: string };
export type Tab = { id: string; title: string; path: string };

const STORAGE_KEY = "df-tabs";

// Every trail starts here, so there's always a way back up to the top level.
const ROOT_PATH = "/dashboard";

// Known routes → friendly labels for breadcrumbs / tab titles. Longest-prefix
// match wins; anything unknown is prettified from its last path segment.
const ROUTE_LABELS: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/leads": "Leads",
  "/leads/new": "New Lead",
  "/leads/list": "Leads List",
  "/scraping": "Scraping",
  "/scraping/keywords": "Auto Keywords",
  "/reports": "Reports",
  "/settings": "Settings",
  "/kanban": "Kanban",
  "/calendar": "Calendar",
  "/feedback": "Bug Reports",
  "/marketing": "Marketing",
  "/marketing/notes": "Notes",
  "/marketing/scripts": "Scripts",
  "/marketing/my-leads": "My Leads",
  "/marketing/manage/badges": "Badges",
  "/marketing/manage/tasks": "Challenges",
  "/marketing/manage/commissions": "Commissions",
  "/marketing/profile": "Agent Profile",
  "/my-commissions": "My Commissions",
  "/balloons": "Balloon Pop",
  "/admin/users": "Users",
  "/admin/fleet": "Fleet",
  "/admin/balloons": "Balloon Admin",
  "/profile": "My Profile",
  "/how-it-works": "How It Works",
  "/chat": "Chat",
};

export function labelForPath(loc: string): string {
  const path = loc.split("?")[0];
  if (ROUTE_LABELS[path]) return ROUTE_LABELS[path];
  const keys = Object.keys(ROUTE_LABELS).sort((a, b) => b.length - a.length);
  for (const k of keys) {
    if (path === k) return ROUTE_LABELS[k];
    if (path.startsWith(k + "/")) return `${ROUTE_LABELS[k]} · Details`;
  }
  const seg = path.split("/").filter(Boolean).pop() ?? "Home";
  return seg.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// Sub-pages that live on a query param rather than their own route. These read
// as one more level down: /scraping?tab=keywords → Scraping › Auto Keywords.
const QUERY_CHILDREN: Record<string, { param: string; labels: Record<string, string> }> = {
  "/scraping":  { param: "tab",    labels: { domain: "Scrape a Website", google: "Search by Google", keywords: "Auto Keywords" } },
  "/marketing": { param: "period", labels: { today: "Today", week: "This Week", month: "This Month" } },
};

/**
 * The breadcrumb for a location, derived purely from the URL — one crumb per
 * level of the route hierarchy, e.g. /scraping?tab=keywords becomes
 * Dashboard › Scraping › Auto Keywords.
 *
 * Deliberately NOT a visit history: it never grows as the user moves around, so
 * it can't accumulate duplicates, needs no cap, and is always correct after a
 * reload without anything being stored.
 */
export function buildTrail(loc: string): Crumb[] {
  const [path, query] = loc.split("?");
  const crumbs: Crumb[] = [{ path: ROOT_PATH, label: labelForPath(ROOT_PATH) }];

  let acc = "";
  for (const seg of path.split("/").filter(Boolean)) {
    acc += `/${seg}`;
    if (acc === ROOT_PATH) continue;   // already the root crumb
    if (ROUTE_LABELS[acc]) {
      crumbs.push({ path: acc, label: ROUTE_LABELS[acc] });
    } else if (acc === path) {
      // Leaf with no mapping (a record detail page) — label it from the segment.
      crumbs.push({ path: acc, label: labelForPath(acc) });
    }
    // Unlabelled intermediate segments (e.g. /marketing/manage) aren't real
    // pages, so they're skipped rather than shown as dead crumbs.
  }

  const child = QUERY_CHILDREN[path];
  if (child && query) {
    const value = new URLSearchParams(query).get(child.param);
    const label = value ? child.labels[value] : undefined;
    if (label) crumbs.push({ path: loc, label });
  }

  return crumbs;
}

function newId(): string {
  try { return crypto.randomUUID(); } catch { return `t${Math.random().toString(36).slice(2)}`; }
}

// ─── Context ──────────────────────────────────────────────────────────────────
type TabsCtx = {
  tabs: Tab[];
  activeId: string;
  activeTab: Tab | undefined;
  /** Breadcrumb for the current location, derived from the route hierarchy. */
  trail: Crumb[];
  mounted: boolean;
  openTab: (loc: string) => void;
  closeTab: (id: string) => void;
  switchTab: (id: string) => void;
  goToCrumb: (index: number) => void;
  back: () => void;
};

const TabsContext = createContext<TabsCtx | null>(null);

export function useTabs(): TabsCtx {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error("useTabs must be used within <TabsProvider>");
  return ctx;
}

export function TabsProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const search = searchParams.toString();
  const location = pathname + (search ? `?${search}` : "");

  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeId, setActiveId] = useState("");
  const [mounted, setMounted] = useState(false);

  // The trail is computed from the URL, so navigation needs no bookkeeping —
  // there's nothing to guard against appending a stray crumb.
  const navigate = useCallback((target: string) => {
    if (target !== location) router.push(target);
  }, [location, router]);

  const trail = useMemo(() => buildTrail(location), [location]);

  // ── Restore persisted tabs (or seed one from the current location) ──────────
  useEffect(() => {
    let restored: { tabs: Tab[]; activeId: string } | null = null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) restored = JSON.parse(raw);
    } catch { /* ignore */ }

    if (restored?.tabs?.length) {
      // Keep only the fields we own now — older saved tabs carry a `trail` array
      // from when breadcrumbs were a stored visit history.
      setTabs(restored.tabs.map((t) => ({ id: t.id, title: t.title, path: t.path })));
      const active = restored.tabs.find((t) => t.id === restored!.activeId) ?? restored.tabs[0];
      setActiveId(active.id);
      if (active.path) navigate(active.path);
    } else {
      const id = newId();
      setTabs([{ id, title: labelForPath(location), path: location }]);
      setActiveId(id);
    }
    setMounted(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Persist on every change ─────────────────────────────────────────────────
  useEffect(() => {
    if (!mounted) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ tabs, activeId })); } catch { /* ignore */ }
  }, [tabs, activeId, mounted]);

  // ── Track navigation → keep the active tab pointed at the current page ──────
  useEffect(() => {
    if (!mounted || !activeId) return;
    setTabs((prev) => prev.map((t) => t.id === activeId
      ? { ...t, path: location, title: labelForPath(location) } : t));
  }, [location, mounted, activeId]);

  const openTab = useCallback((loc: string) => {
    const id = newId();
    setTabs((prev) => [...prev, { id, title: labelForPath(loc), path: loc }]);
    setActiveId(id);
    navigate(loc);
  }, [navigate]);

  const switchTab = useCallback((id: string) => {
    const tab = tabs.find((t) => t.id === id);
    if (!tab) return;
    setActiveId(id);
    navigate(tab.path);
  }, [tabs, navigate]);

  const closeTab = useCallback((id: string) => {
    const idx = tabs.findIndex((t) => t.id === id);
    if (idx === -1) return;
    const next = tabs.filter((t) => t.id !== id);

    if (next.length === 0) {
      // Never leave zero tabs — reset to a fresh Dashboard tab.
      const nid = newId();
      setTabs([{ id: nid, title: labelForPath(ROOT_PATH), path: ROOT_PATH }]);
      setActiveId(nid);
      navigate(ROOT_PATH);
      return;
    }

    setTabs(next);
    if (id === activeId) {
      const neighbor = next[Math.min(idx, next.length - 1)];
      setActiveId(neighbor.id);
      navigate(neighbor.path);
    }
  }, [tabs, activeId, navigate]);

  // Jumping to a crumb just navigates — the trail recomputes from the new URL.
  const goToCrumb = useCallback((index: number) => {
    const crumb = trail[index];
    if (crumb) navigate(crumb.path);
  }, [trail, navigate]);

  /** Up one level in the hierarchy (not browser history). */
  const back = useCallback(() => {
    if (trail.length >= 2) navigate(trail[trail.length - 2].path);
  }, [trail, navigate]);

  // ── Backspace = go back one crumb (ignoring text fields) ────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Backspace" || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" ||
                 el.tagName === "SELECT" || el.isContentEditable)) return;
      e.preventDefault();
      back();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [back]);

  const activeTab = tabs.find((t) => t.id === activeId);

  return (
    <TabsContext.Provider
      value={{ tabs, activeId, activeTab, trail, mounted, openTab, closeTab, switchTab, goToCrumb, back }}
    >
      {children}
    </TabsContext.Provider>
  );
}
