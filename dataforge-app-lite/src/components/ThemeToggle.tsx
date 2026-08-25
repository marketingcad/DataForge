"use client";

import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

type Mode = "dark" | "light";

const MODES: { id: Mode; label: string; Icon: typeof Moon }[] = [
  { id: "dark", label: "Night", Icon: Moon },
  { id: "light", label: "Day", Icon: Sun },
];

/** Server renders the neutral default; the client swaps in the real value. */
const subscribeToNothing = () => () => {};
const mountedOnClient = () => true;
const mountedOnServer = () => false;

/**
 * Night / Day mode switch — a segmented control rather than a single toggling
 * icon, so the current mode is visible without having to interpret which icon
 * means "current" and which means "switch to". Night is the default, which is why
 * the app's ThemeProvider defaults to dark rather than following the OS.
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  // useSyncExternalStore rather than a mounted flag set in an effect: next-themes
  // has no value during SSR, and setting state in an effect triggers a cascading
  // render (and trips react-hooks/set-state-in-effect).
  const mounted = useSyncExternalStore(subscribeToNothing, mountedOnClient, mountedOnServer);

  const active: Mode = !mounted ? "dark" : theme === "light" ? "light" : "dark";
  const index = MODES.findIndex((m) => m.id === active);

  return (
    <div
      role="radiogroup"
      aria-label="Appearance"
      className="relative flex items-center rounded-full border bg-muted/40 p-0.5"
      suppressHydrationWarning
    >
      {/* Sliding pill behind the active icon. */}
      <span
        aria-hidden
        className="absolute top-0.5 bottom-0.5 w-7 rounded-full bg-background shadow-sm transition-transform duration-300 ease-out"
        style={{ left: 2, transform: `translateX(${index * 28}px)` }}
      />
      {MODES.map(({ id, label, Icon }) => {
        const isActive = active === id;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={isActive}
            aria-label={label}
            title={label}
            onClick={() => setTheme(id)}
            className={cn(
              "relative z-10 flex h-7 w-7 items-center justify-center rounded-full transition-colors",
              isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        );
      })}
    </div>
  );
}
