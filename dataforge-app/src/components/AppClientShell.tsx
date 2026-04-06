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
}

export function AppClientShell({ children, userName, userEmail }: AppClientShellProps) {
  return (
    <MigrationProvider>
      <div className="flex flex-col flex-1 overflow-hidden">

        {/* Header */}
        <header className="flex h-14 items-center justify-between border-b px-6 bg-background shrink-0">
          <div className="flex-1" />
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
