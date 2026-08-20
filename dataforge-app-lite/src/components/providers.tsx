"use client";

import { useEffect } from "react";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { NotificationProvider } from "@/lib/notifications";
import { TooltipProvider } from "@/components/ui/tooltip";

export const ACCENT_LS_KEY = "df-accent";

/** Reads the saved accent from localStorage on mount and applies it to <html>. */
function AccentInitializer() {
  useEffect(() => {
    try {
      const saved = localStorage.getItem(ACCENT_LS_KEY);
      if (saved) document.documentElement.setAttribute("data-accent", saved);
    } catch { /* ignore SSR / privacy-mode errors */ }
  }, []);
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <AccentInitializer />
      <TooltipProvider>
        <NotificationProvider>
          {children}
          <Toaster position="bottom-right" />
        </NotificationProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
}
