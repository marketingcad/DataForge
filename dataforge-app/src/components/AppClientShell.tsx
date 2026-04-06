"use client";

import Link from "next/link";
import { Database } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { UserNav } from "@/components/UserNav";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NotificationBell } from "@/components/NotificationBell";
import { FeedbackButton } from "@/components/FeedbackButton";
import { MigrationProvider } from "@/contexts/MigrationContext";
import { MigrationStatusBadge } from "@/components/MigrationStatusBadge";
import { GhlMigrationModal } from "@/components/leads/GhlMigrationModal";

interface AppClientShellProps {
  children: React.ReactNode;
  userName?: string | null;
  userEmail?: string | null;
}

/**
 * Client wrapper for the main content area.
 * Provides MigrationContext so both the header badge and any page modal
 * can read/write migration state across page navigations.
 */
export function AppClientShell({ children, userName, userEmail }: AppClientShellProps) {
  return (
    <MigrationProvider>
      <div className="flex flex-col flex-1 overflow-hidden">

        {/* Header */}
        <header className="flex h-14 items-center justify-between border-b px-6 bg-background shrink-0">
          {/* Mobile: brand */}
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold text-sm md:hidden">
            <Database className="h-5 w-5 text-blue-600" />
            DataForge
          </Link>
          <div className="hidden md:block" />

          {/* Right side */}
          <div className="flex items-center gap-2">
            {/* Migration status indicator — visible when running in background */}
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

        {/* Global migration modal — fixed overlay */}
        <GhlMigrationModal />
      </div>
    </MigrationProvider>
  );
}
