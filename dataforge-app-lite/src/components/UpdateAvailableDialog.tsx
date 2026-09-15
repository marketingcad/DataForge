"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

type UpdateState = { ready: boolean; version: string | null; current: string };

type DesktopBridge = {
  isDesktop?: boolean;
  getUpdateState?: () => Promise<UpdateState>;
  installUpdateNow?: () => Promise<boolean>;
  onUpdateReady?: (cb: (state: UpdateState) => void) => () => void;
};

// Remembers which version the user already dismissed, so acknowledging an update
// doesn't re-prompt on every reload. Keyed by version: a NEWER update still asks.
const DISMISS_KEY = "df-update-dismissed";

function desktopBridge(): DesktopBridge | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { dataforgeDesktop?: DesktopBridge }).dataforgeDesktop;
}

/**
 * Desktop-only prompt, shown once an update has already downloaded in the
 * background. Renders nothing in the browser build — the bridge is absent there.
 *
 * The prominent action is the SAFE one. electron-updater runs with
 * autoInstallOnAppQuit, so "Install on quit" requires no action at all; it just
 * acknowledges. "Restart now" is secondary because it stops a running scrape
 * (see electron/updater.js installNow).
 */
export function UpdateAvailableDialog() {
  const [state, setState] = useState<UpdateState | null>(null);
  const [open, setOpen] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    const api = desktopBridge();
    if (!api?.isDesktop || !api.getUpdateState) return;

    let cancelled = false;

    const show = (next: UpdateState) => {
      if (cancelled || !next?.ready || !next.version) return;
      let dismissed: string | null = null;
      try {
        dismissed = localStorage.getItem(DISMISS_KEY);
      } catch {
        /* localStorage unavailable — prompting again is the safe failure */
      }
      if (dismissed === next.version) return;
      setState(next);
      setOpen(true);
    };

    // An update can land before this ever mounts: the first feed check runs 30s
    // after launch, and the window reloads on navigation. So ask for the current
    // state as well as subscribing to future pushes.
    api.getUpdateState()
      .then(show)
      .catch(() => {
        /* the app must never fail to render because an update check did */
      });

    const unsubscribe = api.onUpdateReady?.(show);
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  function dismiss() {
    if (state?.version) {
      try {
        localStorage.setItem(DISMISS_KEY, state.version);
      } catch {
        /* ignore */
      }
    }
    setOpen(false);
  }

  async function restartNow() {
    setInstalling(true);
    try {
      await desktopBridge()?.installUpdateNow?.();
      // On success the app is quitting, so there is nothing to reset.
    } catch {
      setInstalling(false);
    }
  }

  if (!state?.ready || !state.version) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) dismiss();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-blue-600" />
            DataForge {state.version} is ready
          </DialogTitle>
          <DialogDescription>
            You&apos;re on {state.current}. The update has already downloaded and installs
            automatically the next time you close DataForge.
          </DialogDescription>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          If a scrape is running, restarting now stops it. Leads already collected are
          saved, and the keyword retries within 3 minutes.
        </p>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={restartNow} disabled={installing}>
            {installing ? "Restarting…" : "Restart now"}
          </Button>
          <Button
            onClick={dismiss}
            disabled={installing}
            className="bg-blue-600 text-white hover:bg-blue-700"
          >
            Install on quit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
