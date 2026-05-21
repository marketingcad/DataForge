"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { Separator } from "@/components/ui/separator";
import { UserNav } from "@/components/UserNav";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NotificationBell } from "@/components/NotificationBell";
import { FeedbackButton } from "@/components/FeedbackButton";
import { MigrationProvider } from "@/contexts/MigrationContext";
import { MigrationStatusBadge } from "@/components/MigrationStatusBadge";
import { GhlMigrationModal } from "@/components/leads/GhlMigrationModal";
import type { ReactNode } from "react";

interface AppClientShellProps {
  children: ReactNode;
  userName?: string | null;
  userEmail?: string | null;
  userId?: string;
}

export function AppClientShell({ children, userName, userEmail, userId = "" }: AppClientShellProps) {
  const [secretVisible, setSecretVisible] = useState(false);
  const pathname = usePathname();
  const enterCount = useRef(0);

  // Clear on page navigation
  useEffect(() => {
    setSecretVisible(false);
    enterCount.current = 0;
  }, [pathname]);

  // Shift + Enter × 3 listener
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Shift") return;
      if (e.key === "Enter" && e.shiftKey) {
        enterCount.current += 1;
        if (enterCount.current >= 3) {
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
      <div className="flex flex-col flex-1 overflow-hidden">

        {/* Header */}
        <header className="flex h-14 items-center justify-between border-b px-6 bg-background shrink-0">
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            {secretVisible && (
              <span className="text-xs font-medium text-muted-foreground animate-in fade-in duration-500 mr-1">
                Powered By Claude Boys of Linkage Web Solutions 😎
              </span>
            )}
            <MigrationStatusBadge />
            <FeedbackButton />
            <ThemeToggle />
            <NotificationBell userId={userId} />
            <Separator orientation="vertical" className="h-6" />
            <UserNav name={userName} email={userEmail} />
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto px-6 py-6">
          {children}
        </main>

        {/* Global migration modal */}
        <GhlMigrationModal />
      </div>
    </MigrationProvider>
  );
}
