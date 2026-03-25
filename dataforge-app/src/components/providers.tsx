"use client";

import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { NotificationProvider } from "@/lib/notifications";
import { TooltipProvider } from "@/components/ui/tooltip";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <TooltipProvider>
        <NotificationProvider>
          {children}
          <Toaster position="bottom-right" />
        </NotificationProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
}
