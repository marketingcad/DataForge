"use client";

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
  sidebarTrigger?: ReactNode;
}

export function AppClientShell({
  children,
  userName,
  userEmail,
  sidebarTrigger,
}: AppClientShellProps) {
  return (
    <MigrationProvider>
      <div className="flex flex-col flex-1 overflow-hidden h-svh">

        {/* Header */}
        <header className="flex h-14 items-center gap-2 border-b px-4 bg-background shrink-0">
          {/* Sidebar toggle */}
          {sidebarTrigger}
          <Separator orientation="vertical" className="h-4" />

          {/* Spacer */}
          <div className="flex-1" />

          {/* Right side */}
          <div className="flex items-center gap-2">
            <MigrationStatusBadge />
            <FeedbackButton />
            <ThemeToggle />
            <NotificationBell />
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
