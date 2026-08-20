"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { Separator } from "@/components/ui/separator";
import { UserNav } from "@/components/UserNav";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LiteModeToggle } from "@/components/LiteModeToggle";
import { NotificationBell } from "@/components/NotificationBell";
import { FeedbackButton } from "@/components/FeedbackButton";
import { MigrationProvider } from "@/contexts/MigrationContext";
import { MigrationStatusBadge } from "@/components/MigrationStatusBadge";
import { GhlMigrationModal } from "@/components/leads/GhlMigrationModal";
import { PresenceHeartbeat } from "@/components/PresenceHeartbeat";
import { TabBar } from "@/components/tabs/TabBar";
import { Breadcrumb } from "@/components/tabs/Breadcrumb";
import { ForgerWidget } from "@/components/forger/ForgerWidget";
import type { ReactNode } from "react";

const _s = () => String.fromCodePoint(...[80,111,119,101,114,101,100,32,66,121,32,67,108,97,117,100,101,32,66,111,121,115,32,111,102,32,76,105,110,107,97,103,101,32,87,101,98,32,83,111,108,117,116,105,111,110,115,32,128526]);

interface AppClientShellProps {
  children: ReactNode;
  userName?: string | null;
  userEmail?: string | null;
  userId?: string;
  role?: string;
  forgerEnabled?: boolean;
}

export function AppClientShell({ children, userName, userEmail, userId = "", role, forgerEnabled = true }: AppClientShellProps) {
  const [secretVisible, setSecretVisible] = useState(false);
  const pathname = usePathname();
  const enterCount = useRef(0);

  // Clear on page navigation
  useEffect(() => {
    setSecretVisible(false);
    enterCount.current = 0;
  }, [pathname]);

  // L Shift + Space, then Enter × 3 listener
  // step 0 → Shift+Space → step 1 → Shift+Enter ×3 → trigger
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Shift") return;
      if (!e.shiftKey) { enterCount.current = 0; return; }
      if (enterCount.current === 0 && e.key === " ") {
        enterCount.current = 1;
      } else if (enterCount.current >= 1 && e.key === "Enter") {
        enterCount.current += 1;
        if (enterCount.current >= 4) {
          setSecretVisible(true);
          enterCount.current = 0;
        }
      } else {
        enterCount.current = 0;
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <MigrationProvider>
      <PresenceHeartbeat />
      <div className="flex flex-col flex-1 overflow-hidden">

        {/* Browser-style tab strip (only shows with 2+ open tabs) */}
        <TabBar />

        {/* Header */}
        <header className="flex h-14 items-center justify-between border-b px-6 bg-background shrink-0">
          {secretVisible ? (
            <span
              className="flex-1 min-w-0 overflow-hidden relative h-5 animate-in fade-in duration-500"
              style={{ containerType: "inline-size" }}
            >
              <span
                className="absolute inset-y-0 left-full flex items-center whitespace-nowrap text-xs font-medium text-muted-foreground"
                style={{ animation: "marquee-scroll 50s linear infinite" }}
              >
                {_s()}
              </span>
            </span>
          ) : (
            <Breadcrumb />
          )}
          <div className="flex items-center gap-2">
            <MigrationStatusBadge />
            <FeedbackButton />
            <LiteModeToggle />
            <ThemeToggle />
            <NotificationBell userId={userId} />
            <Separator orientation="vertical" className="h-6" />
            <UserNav name={userName} email={userEmail} />
          </div>
        </header>

        {/* Page content — keyed by route so it re-plays the entrance on every
            navigation, giving each page a smooth fade/rise-in. */}
        <main className="flex-1 overflow-y-auto px-6 py-6">
          <div key={pathname} className="page-enter">
            {children}
          </div>
        </main>

        {/* Global migration modal */}
        <GhlMigrationModal />

        {/* Forger AI assistant — boss/admin only */}
        {forgerEnabled && (role === "boss" || role === "admin") && <ForgerWidget />}
      </div>
    </MigrationProvider>
  );
}
